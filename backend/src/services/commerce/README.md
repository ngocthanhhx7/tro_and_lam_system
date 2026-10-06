# P05 commerce and order service

The module owns MongoDB orders, inventory, stock reservations and movements, checkout snapshots, order proof challenges, COD collection records, order lifecycle, and return-related order/inventory ports. The root application mounts `createCommerceRouter({ports,config})` at `/api/v1`.

## Routes

- `POST /checkout/quote`, `POST /orders`
- `POST /order-access/challenges`, `POST /order-access/verify`
- `GET /orders/:id`, `POST /orders/:id/cancel`
- `GET /account/orders`, `POST /account/orders/claim`
- `GET /staff/orders`, `GET /staff/orders/:id`, `POST /staff/orders/:id/transitions`
- `POST /staff/orders/:id/shipping-events`, `POST /staff/orders/:id/cod-collection`
- `POST /admin/products/:productId/inventory-adjustments`

The frontend route fragment is `fondend/src/routes/modules/commerce.routes.jsx`: checkout at `/thanh-toan`, guest access at `/tra-cuu-don-hang`, owner order details at `/don-hang/:id`, account history at `/tai-khoan/don-hang`, and staff queue at `/staff/orders`. The integrator mounts the fragment; this package does not edit the shared router.

Requests are validated against the frozen DTO fields. Browser mutations use the injected P02 CSRF middleware. Public guest lookup returns no order details until the P02 scoped proof resolver admits that exact order. The OTP challenge persists only challenge/code hashes, expires in ten minutes, allows at most five attempts, and uses the P09 transactional mail outbox only after order code and stored email match. Challenge and verify routes return generic acceptance/failure messages; mount a shared rate-limit store in production.

## Required ports

- `catalog.getCheckoutProducts(ids,{session})` supplies current published checkout records; client price/stock values are ignored.
- `address.getOwnedAddress(userId,addressId,{session})` resolves only an account-owned address.
- `settings.getBusinessSettings({session})` reads validated P09 business settings. Checkout is disabled without configured shipping zones and a nonempty `checkoutLimits` object. COD is offered only when `codEnabled` is true and `checkoutLimits.maxPendingCodOrders` is a configured positive integer. There is no fallback fee, shipping zone, COD allowance or price.
- `shipping.quoteFeeVnd({settings,recipient,items,subtotalVnd,actor,session})` must use owner-configured fee rules and return a safe nonnegative VND integer; it fails closed when no configured zone matches.
- `payment.isConfigured()` controls whether payOS may be selected. P05 order creation never reports provider success; payment-link creation is a post-commit P06 integration. Expiry calls P06 `payment.getReservationExpiryStatus(order)` before opening a Mongo transaction and releases only a verified `expired|failed|cancelled` state. Provider unavailability defers release.
- `identity.createGuestOrderProof({orderId,identityVerifiedAt,session})` issues the P02 order-scoped proof. The route adapter `resolveOrderActor(req,orderId)` must verify the P02 proof purpose, scope, expiry/revocation and exact order binding; it may fall back from absent/expired full session to guest proof, never from blocked/forbidden auth.
- `identity.revokeGuestOrderProofs(orderId,{session})` is required to claim a guest order atomically. P02 owns its resolver/middleware.
- `outbox.appendOutbox({eventKey,type,aggregateType,aggregateId,aggregateVersion,payload},{session})`, `outbox.appendAudit`, and `outbox.enqueueMail(template,recipient,data,{session})` persist business events, redacted audit and transactional mail. Missing write ports fail the transaction closed.
- `resolveActor(req)` supplies a current active full actor, or a guest actor with a server-issued opaque cart `actorKey`; it never trusts body role/owner fields.

The service exports `createCommerceService`, `orderTransitions`, `public` order reads, and `getAvailability(ids)`. `getPaymentContext(actor,id,{session})` enforces customer ownership or exact guest proof binding and returns the existing reservation expiry; P06 must not invent a replacement TTL. P06 calls `applyVerifiedPayment({provider:'payos',status:'paid',currency:'VND',amountVnd,orderId},{session})` only after independently verifying its provider fact and event dedupe. `applyRefundAggregate(orderId,{expectedVersion,refundedAmountVnd,hasInFlightRefund},{session})` owns Order payment/refund aggregate writes while P06 owns the refund ledger. A paid staff cancellation calls the injected `refunds.requestOrderCancellationRefund({orderId,amountVnd,reason,actor,requestKey,requestId?},{session})`; it fails closed if that port is absent. `getOperationalOrder(id,{session})` is the staff-side read port. P07 calls `requestReturn` and `transitionReturnOrder` within its existing transaction. To close a positive inspection, it calls `completeReturn(actor,{orderId,returnId,items,reason?,expectedOrderVersion},{session})`; `items` carry `productId`, `receivedQuantity`, and `resellableQuantity`. The method requires the caller's Mongo session, compare-and-sets the Order version from `return_requested` to `returned`, increments inventory and appends unique `return:<returnId>:<productId>` movements only for positive resellable quantities, and writes `order.return_resolved` through the P09 outbox. P07 must update its ReturnRequest in that same transaction and allow failures to abort it. These service ports never open nested transactions. `transitionReturnOrder` remains the port for rejected requests returning to `shipped` or `delivered`.

## Index rollout and worker

`backend/src/models/commerce/indexes.js` exports `ensureCommerceIndexes()`. Run it as a controlled migration/release step after checking the target database for duplicate codes, order IDs, movement event keys, idempotency keys and COD captures. It only creates declared indexes; it does not drop data or repair duplicates. The rollback is to stop the commerce service/job and retain the collections/indexes; deleting order, stock or payment history is not a rollback.

`createReleaseExpiredReservationsJob` exposes one bounded batch. P11/root scheduler owns cadence and overlap policy. It is safe to run concurrently: reservations are conditionally changed inside a transaction, while provider status is queried before the transaction. MongoDB replica-set transactions are required. Do not run expiry without the P06 verified-status adapter or P09 outbox.

## Current limits

No shipping fees/zones, COD policy, max pending COD value, product prices/stock, PayOS credentials or SMTP delivery values are included in this package. Checkout stays disabled when mandatory inputs are absent. This branch has not been mounted into `app.js` and cannot provide integrated route evidence until the coordinator wires P02/P03/P04/P06/P09 ports. Replica-set race coverage is implemented in `backend/tests/commerce/commerce.replica-set.test.js` and requires an explicitly configured `P05_TEST_REPLICA_SET_URI` pointing at a dedicated test replica set; it is skipped when that variable is absent.

P05 persists order lifecycle domain events such as `order.created`, `order.payment_verified`, `order.status_changed`, and `order.return_resolved` through the P09 outbox. The current P09 worker consumes only `operations.delivery`; it does not deliver customer/staff notifications from P05 domain events. Confirmation and guest lookup emails use `enqueueMail`, which P09 stores separately as `operations.delivery`. Keep order events out of the delivery worker allowlist until a registered projector/handler is wired and tested.
