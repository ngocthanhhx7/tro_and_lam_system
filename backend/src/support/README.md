# P07 Support and reviews

The support route fragment is exported by `support.routes.js`; `createSupportPorts()` exposes the support, review, and human handoff ports. Mount the fragment under `/api/v1` after providing the P02 identity middleware. The shared Express composition file stays coordinator-owned.

## Routes and actors

The API implements contact leads, account tickets and messages, order return requests, attachment upload/finalize/download, review create/edit/list, public product reviews, staff support/return/contact queues, admin review moderation, and assistant handoff. The frozen contracts in `doc/contracts/openapi.yaml` define request paths and DTOs. Guest ticket and return access depends on the matching P02 guest order proof; a ticket's `orderId` must match the proof. Customers can see customer-visible ticket messages, while staff can also see internal notes. Staff assignment is limited to self-assignment except for admins.

Frontend route fragments are in `fondend/src/routes/modules/support.routes.jsx`. Product detail pages can add the exported `PublicProductReviews` component. The app route composition and shared catalog pages remain coordinator-owned.

## Required ports and configuration

| Port/config | Purpose |
| --- | --- |
| P02 `identityMiddleware` | Actor, capability, CSRF, and guest order proof checks |
| P05 `commerce.getOwnedOrder` | Verify order owner, delivery status, product eligibility, and return transitions |
| P05 `requestReturn`, `transitionReturnOrder`, `completeReturn` | Change order lifecycle and return inventory in the caller's transaction |
| P09 `operations.appendOutbox`, `appendAudit`, `enqueueMail` | Persist staff/customer notifications, redacted audit, and retryable mail events |
| P04 `catalog.getPublishedProductsByIds` | Keep reviews limited to public product pages |
| P10 `assistantTranscript.assertConversationOwner` | Required authorization check before any transcript lookup |
| `storage` adapter | Private upload URLs, private reads for MIME/size verification, and short-lived private download URLs |
| `supportInbox` | Server-selected recipient for contact lead mail; never accepted from a public request |
| `returnWindowMs` | Return eligibility window; defaults to 7 days pending owner policy approval |

Support writes use the service repository transaction and pass the same session to P05 and P09 writes. Do not wire a fake port into production. With mail/storage/commerce dependencies unavailable, the affected operation returns a service error instead of reporting provider success. Contact leads persist together with an outbox mail event; SMTP delivery and retries belong to P09's worker.

## Attachments and review media

Private attachments accept JPEG, PNG, and WebP up to 5 MiB. Finalization reads the object from private storage, validates its byte signature and exact size, hashes it, and only then marks it ready. Customer downloads require ownership or access to the linked customer-visible ticket. Internal ticket attachments stay staff-only. Customer and staff support forms can attach up to five images to a ticket message; customer and internal attachments remain separated by the server's visibility checks.

Development defaults to the local private filesystem adapter at `.data/private-support-attachments`, separate from the publicly served product-media folder. It issues short-lived HMAC-signed, same-origin upload/download URLs, accepts each upload capability once, and serves original files with `private, no-store` and `nosniff`. `SUPPORT_STORAGE_DRIVER=disabled` preserves the explicit unavailable fallback. The local adapter is rejected in production; no production object-store provider is configured in this checkout.

Production still requires the owner to choose a private object-store service and configure its credentials through the deployment secret manager, then provide the backend adapter with the private bucket/container, server endpoint/region as applicable, and a narrowly scoped service identity. The adapter needs short-lived signed PUT/GET URLs, private server-side reads for finalization, deletion for rejected/expired uploads, a 5 MiB request ceiling, and a lifecycle/backup/retention policy. The owner must approve retention and RPO/RTO under R11. Staging must verify browser CORS for signed PUTs, object privacy, magic-byte/size/hash validation, signed download expiry, cleanup, and customer/staff owner/internal-note ACLs through real storage. No provider-specific environment-variable names are defined until the owner selects a provider; never put credentials in Git, frontend `VITE_*` variables, or chat.

Text reviews are implemented end to end. Review photo uploads have metadata and consent validation, but this checkout has no customer upload UI, sanitized derivative generator, or derivative revocation adapter. Therefore review photos remain private and are not returned by public review APIs; do not manually set `publicDerivativeUrl` or `consentToPublishAt`. Enable public review images only after a sanitized derivative and revocation workflow is implemented and tested. A review becomes public only after an admin publishes it.

## Return policy decision

The backend currently applies the 7-day return window described as a proposed v1 policy in `doc/planning/10-decisions-and-readiness.md`. This is a configurable service value, not an owner-confirmed business policy. Confirm the window and eligible conditions before launch; do not describe the default as an official promise.

## Checks and migration

Run the support acceptance suite from the repository root:

```powershell
node --test backend/tests/support/support-review.test.js
```

The unit suite uses deterministic domain ports; it does not prove Mongo replica-set transactions, a production object store, SMTP delivery, or real hosting. The integrated local attachment flow can be run with a dedicated loopback P11 replica-set URI using `npm run test:e2e -- --grep "P07 customer and staff upload, finalize, link, and download private attachments"`; global teardown drops its test database and removes only the run's temporary media folders.

After backup and duplicate-key preflight on a non-production database, create or verify the additive indexes with:

```powershell
node backend/src/support/migrate-support-indexes.js
```

The script only calls Mongoose `createIndexes()` for support, attachment, and review models. It does not delete collections/indexes, rewrite records, or resolve duplicate data. Resolve collisions through a separately reviewed recovery procedure. Rollback means rolling back application code; index removal requires a separate database migration review.

## Coordinator integration

- Mount `createSupportRouteFragment(...)` at the API root after P02 middleware and provide the real P04, P05, P09, P10, and storage ports.
- Add `supportRoutes` from `support.routes.jsx` to the existing frontend route composition.
- Add `PublicProductReviews` to the P04 product detail view.
- Configure `supportInbox`, `returnWindowMs`, and a production private storage adapter after the owner selects a provider. Do not add credentials to Git.
- OpenAPI remains coordinator-owned; this package keeps to the frozen `doc/contracts` routes and field names.
