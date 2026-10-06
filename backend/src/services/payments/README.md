# P06 · Payments

P06 owns the PayOS adapter, payment attempt/event ledger, manual refund ledger, bounded reconciliation job, API route fragment, and payment UI. It does not mount itself into `app.js` or `AppRoutes.jsx`; the coordinator composes those roots after merging P05 and P09.

## Frozen routes

- `POST /orders/:id/payment-attempts` — resolve the exact order actor using `ports.resolveOrderActor(req, orderId)`, then call P05 `getPaymentContext` inside the transaction. Requires `Idempotency-Key` and CSRF. A guest resolver must enforce `guest.payment.create`; a blocked session error propagates without guest fallback.
- `GET /orders/:id/payment` — actor resolver enforces `guest.order.read` for guest proof or the signed-in owner. Returns only the frozen payment status DTO.
- `POST /payments/payos/webhook` — verifies the PayOS body signature, stores a digest-only event, applies a P05 verified-payment fact in the same database transaction, and returns 2xx only after persistence.
- `POST /staff/orders/:id/refund-requests` — requires `refunds.request`, idempotency key, full outstanding balance, and an expected order version.
- `GET /admin/refunds`, `POST /admin/refunds/:id/decision`, `POST /admin/refunds/:id/complete` — require the frozen admin capabilities. Completion records manual refund evidence; it never claims a provider refund was performed.

The browser return/cancel routes read status from the API. PayOS query parameters never mark an order paid. `paymentRoutes` is the named UI fragment; `PaymentPanel` is the reusable widget for P05 order pages.

## Ports and composition

`createPaymentsService({ ports, config, provider? })` needs P05 commerce methods `getOwnedOrder`, `getPaymentContext`, `getOperationalOrder`, `applyVerifiedPayment`, and `applyRefundAggregate`. It exposes `requestOrderCancellationRefund(input, { session })` as a transaction-aware P05 port; this function rejects calls without the caller's Mongo session. For guest cancellation it stores no fabricated `requestedBy` user ID; the P06 refund document records `requesterType: 'guest'` and the audit records the system action.

P09 ports are `appendAudit`, `appendOutbox`, and `enqueueMail`. P06 sends mail through `enqueueMail('order_update', recipient, { orderCode, status }, { session, eventKey })`. In-app payment/refund updates use only `operations.delivery` with the validated P09 notification envelope. P06 does not enqueue `payments.*` events because P09 has no delivery handler for them.

The coordinator must map server-only config keys `payosEnabled`, `payosClientId`, `payosApiKey`, `payosChecksumKey`, `payosTimeoutMs`, `publicWebUrl`, and `reconciliationMinimumAgeMs`. Production secrets remain in the host environment. No key or merchant result is present in this package.

## Data and indexes

- `PaymentAttempt`: unique provider order code, unique order/request key, unique provider payment link ID, and one active attempt per order.
- `PaymentEvent`: unique provider+digest dedupe key, references the attempt/order where available, and stores only SHA-256 of verified canonical fields. Raw webhook bodies and provider references are not persisted.
- `Refund`: unique order/request key and one open refund (`requested`, `approved`, or `processing`) per order. This unique partial index serializes different refund keys racing for the same full balance. Run `ensurePaymentIndexes()` during coordinator-controlled index setup.
- `requesterType` is internal ledger metadata (`customer`, `staff`, `admin`, `guest`); it does not add an API role or capability. Existing refunds default to `staff` when the index is first built.

Manual refund states move `requested → approved|rejected`, `approved → completed|failed`; `processing` can also complete or fail. Partial refund requests fail with `PARTIAL_OPERATION_DISABLED`. A failed refund removes its in-flight ledger amount and asks P05 to restore the order aggregate from the remaining completed/in-flight ledger. The frozen OpenAPI has no admin endpoint to record failure after approval, so `failRefund()` is currently an internal service method and cannot be invoked from the shipped admin page; host integration or a separately approved contract addition is still needed for that operator action.

## Provider verification and current limits

PayOS uses `POST https://api-merchant.payos.vn/v2/payment-requests`, the official x-client-id/x-api-key headers, HMAC-SHA256 signed sorted request fields, and checkout host `pay.payos.vn`. Webhook verification follows the official sorted-data HMAC guide. Official references checked 2026-10-06:

- [PayOS API reference](https://payos.vn/docs/api/)
- [PayOS webhook signature guide](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/)

Agy `/teamwork-preview` research did not complete in the headless session because it requested command permission. The PayOS implementation was checked against the official documentation directly; this handoff does not claim Agy research or live merchant verification. No PayOS refund endpoint was verified, so the UI uses manual completion evidence only.

Before enabling payments, the project owner must supply sandbox merchant credentials and configure the exact server environment mapping. Sandbox callback/reconciliation, MongoDB replica-set race tests, webhook URL registration, SMTP delivery, and production credentials were not available in this package environment. The reconciliation factory is bounded (maximum 500 attempts per run) and is not scheduled at import time.

## Checks

Focused command: `node --test backend/tests/payments/*.test.js` (run from the repository root with Node 24). The test suite covers signed/tampered signatures, safe checkout URLs, webhook replay, unknown and mismatched events, late payment review, timeout retry on the same attempt, access resolver behavior, refund full-balance/idempotency rules, concurrent request logic, failure ledger restoration, and guest cancellation without a fabricated user ID. These use deterministic test ports; they are not proof of PayOS sandbox behavior or replica-set race handling.
