# P03 account, addresses and carts

## Ownership and model rules

- Addresses belong to the authenticated `userId`. The address DTO uses only the frozen fields: `recipientName`, `phone`, `line1`, optional `line2/ward/province/postalCode/location`, `countryCode`, `formattedAddress`, `isDefault`, and `version`.
- `Address` declares a unique partial index on `{ userId, isDefault }` for `isDefault: true`. Mutations which select a default use a MongoDB transaction. Deleting the default promotes the oldest remaining address; deleting the last address leaves no default.
- A cart has exactly one owner: `userId` or a SHA-256 `guestTokenHash`. The raw 256-bit guest token is sent only in a narrow `HttpOnly` cookie. The cart model has separate unique owner indexes and an expiry TTL index.
- Login merge adds matching product quantities once, clamps each quantity to the contract maximum of 99, returns any clamp adjustments, and marks the consumed guest cart until its TTL expires. A retry using the same guest cookie returns the account cart without adding quantities again.
- Current purchasable product names, SKU and prices come from the P04 `getCheckoutProducts(ids, { session })` port. P04's frozen port does not expose inventory availability; this package does not invent stock status. Checkout must revalidate price and availability through its server quote.

## Backend exports and routes

- `createAccountRouter({ ports, config })` — Express route fragment for mounting below `/api/v1`.
- `createAccountService({ ports, config })` — service API and the P03 ports `getOwnedAddress(userId, addressId, { session })` and `getCart(actor)` for P05. It also exposes `removeCommittedItems(actor, items, { session })` for P05 to remove only committed cart lines in its transaction.
- `AccountRepository` — Mongoose repository. `ensureAccountIndexes()` idempotently creates address and cart indexes for an explicit migration/operations step.
- `hashGuestCartToken(token)` — hashes the raw opaque guest cookie token; callers must never persist/log the raw token.

| Method and path (under `/api/v1`) | Auth | Purpose |
| --- | --- | --- |
| `GET /account/addresses` | active customer/staff/admin | List own addresses |
| `POST /account/addresses` | active customer/staff/admin + CSRF | Create address |
| `PATCH /account/addresses/:id` | owner + CSRF | Partial update with `expectedVersion` |
| `DELETE /account/addresses/:id?expectedVersion=` | owner + CSRF | Delete; promotes fallback when applicable |
| `POST /account/addresses/:id/default` | owner + CSRF | Select default with `expectedVersion` |
| `POST /locations/reverse` | active customer/staff/admin + CSRF | Reverse-geocode an explicitly requested location through an injected provider adapter |
| `GET /cart` | guest or active session | Read priced cart and issue guest cookie where needed |
| `PUT /cart/items/:productId` | guest or active session + CSRF | Set quantity 1–99 with `expectedVersion` |
| `DELETE /cart/items/:productId?expectedVersion=` | guest or active session + CSRF | Remove line |
| `POST /cart/merge` | active session + CSRF | Idempotently merge the guest cookie cart |

## Integration requests to the coordinator

1. Mount `createAccountRouter` as a domain fragment with the same identity service, `csrfSecret`, cookie settings and exact allowed origins used by P02. Inject P04's catalog service as `ports.catalogService`.
2. Add `accountRoutes` to the app route composition. `CartPage` is public; the address page uses P02's `IdentityRouteGuard`.
3. On successful P02 login/invitation acceptance, call `accountApi.getCart()` and then `accountApi.mergeGuestCart(accountCart.version)` before navigating. The cart page also performs this safely when an authenticated user visits it; the explicit post-login hook avoids delaying merge until then.
4. Inject a real configured geocoder as `ports.geocoder = { configured: true, reverse({ lat, lng, timeoutMs }) }`. No provider is faked or selected here. Without an adapter, reverse-geocoding returns `503 GEO_UNAVAILABLE`; manual address entry still saves and coordinates are stored only if the user opts in.
5. Run `ensureAccountIndexes()` from an explicit, repeatable database migration/operations step before enabling these routes. Review any legacy default-address duplicates before creating the unique partial index. Keep new collections/indexes during application rollback; no destructive data migration is included.

## Configuration, tests and limitations

The router accepts `csrfSecret`, `sessionCookieName`, `guestCartCookieName`, `cookiePath`, `secureCookies`, `sameSite`, `allowedOrigins`, and `cartTtlMs` in configuration. No provider secret or credential is part of this package. A geocoder credential, provider, data disclosure text and quota policy remain owner-configured.

`backend/tests/account/` exercises service behavior with a deterministic in-memory repository and route behavior through Supertest. These tests do not establish MongoDB transaction/index races; run the two-default concurrency case against the configured Atlas replica set before release. `tests/e2e/p03-geolocation.spec.js` adds integrated browser evidence for an actual Playwright geolocation success followed by the real unconfigured backend's `GEO_UNAVAILABLE` response, manual address save and checkout selection, plus a browser geolocation timeout test that stubs only the browser API. It does not claim a configured or live geocoder result. Keyboard and mobile flows remain owner UAT. The contract checkout port has no inventory status, so stock-based cart merge clamping remains P05 checkout's responsibility.
