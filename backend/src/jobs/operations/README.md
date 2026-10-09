# P09 operations integration

All API paths below are mounted under `/api/v1` by the integrator.

## Routes

- `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, and `PATCH /notifications/read-all` use the signed-in owner's inbox.
- `GET /staff/dashboard` is available to staff only. The admin overview uses admin statistics and does not call staff queue endpoints.
- `GET /admin/audit-logs`, `GET /admin/statistics`, `GET /admin/settings`, and `PATCH /admin/settings` are admin only.
- The frontend route fragment provides `/tai-khoan/thong-bao`, `/staff`, `/admin`, `/admin/logs`, and `/admin/settings`; the shared router and layouts remain integrator owned.

`createOperationsRouter({ auth, models, ...ports })` accepts the P02 `requireActor`, `requireCapability(capability)`, and `csrfProtection` middleware names. The integrator still needs to mount it at the API prefix. `createOperationsPorts()` provides `audit.appendAudit`, `outbox.appendOutbox`, and `outbox.enqueueMail` for domain services.

## Worker and SMTP

`createOutboxWorker()` processes one event at a time. `startOutboxWorker(worker)` polls serially and returns a `stop()` method that waits for the active operation. The server/worker composition must pass a configured SMTP transport, the payload decrypt function, and an admin alert callback; this package does not create provider success responses when an adapter is absent.

The outbox payload cipher requires `OUTBOX_ENCRYPTION_KEY`: a stable Base64 encoding of 32 random bytes. Configure and rotate it through the deployment secret store, never through business settings or Git. Existing encrypted payloads need the same key to be retried. Loss of that key makes queued emails unreadable and needs operator recovery.

SMTP host, port, TLS mode, user, password, sender, and public web origin are deployment configuration. Construct the Nodemailer transport in the server/worker composition and pass it to `createSmtpProvider()`. `createOperationsPorts().outbox.enqueueMail()` maps P02's `verify-email`, `reset-password`, `user-invitation`, `appeal-access-code`, `appeal-decision`, and `account-status-update` templates to P09's allowlisted SMTP templates. It copies only the required template variables; invitation and challenge links must remain on the configured public web origin.

Missing SMTP configuration produces `MAIL_UNAVAILABLE`. The worker retries with jitter, writes a redacted audit event after the retry budget is exhausted, and invokes the configured admin alert port. SMTP was not called with live credentials in this package checkout.

## Index setup

Use Node 24 and a backed-up, non-production database first:

```powershell
node src/jobs/operations/ensure-indexes.js
```

The additive script creates indexes declared by the operations models. It does not remove existing indexes or repair duplicate data. Resolve duplicate unique keys using an owner-reviewed recovery plan before rerunning. Do not point this script at production as a substitute for the release migration procedure.

## Dashboard data ports

Order/ticket/contact/inbox counts use persisted models. Low-stock, delivery/assignment queue counts, and finance are optional domain-owned ports; missing sources return `null`/unavailable rather than fabricated totals. Admin gross/refund/net amounts require a finance ledger adapter and its event-date semantics.

## Evidence boundaries

`operations.delivery` notification items pass through `createOutboxWorker.runOnce()` into `createNotificationService.appendForDelivery()`. The consumer writes one notification per recipient with the unchanged outbox `eventKey`; the `{userId,eventKey}` unique index and `$setOnInsert` make replay safe. Inbox reads and read mutations continue to filter by the authenticated owner. Guests have no user inbox and receive mail only.

`backend/tests/operations/outbox-notification.replica-set.test.js` is the P09 persistence evidence. With `P09_TEST_REPLICA_SET_URI` set to a loopback MongoDB replica-set URI, it stores a validated `operations.delivery` outbox event, invokes the real worker and Mongoose models, verifies one persisted row per recipient, simulates a lost sent acknowledgement and retries, then verifies stable row IDs and owner-scoped list/read behavior. The test creates and drops only its randomly named `tro_lam_p09_test_<hex>` database; it does not contact SMTP or another provider.

Unit tests cover owner filters, role denial, redaction, version conflicts, worker retries/dead-letter, encrypted mail payloads, SMTP rendering and unavailable fallback. The replica-set test does not replace owner UAT, live SMTP/deliverability checks, credentials, or worker process supervision. Settings transaction behavior and other unique-index races remain separate replica-set checks.
