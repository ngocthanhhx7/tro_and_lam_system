# P09 operations integration

All API paths below are mounted under `/api/v1` by the integrator.

## Routes

- `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, and `PATCH /notifications/read-all` use the signed-in owner's inbox.
- `GET /staff/dashboard` is available to staff and admin.
- `GET /admin/audit-logs`, `GET /admin/statistics`, `GET /admin/settings`, and `PATCH /admin/settings` are admin only.
- The frontend route fragment provides `/tai-khoan/thong-bao`, `/staff`, `/admin`, `/admin/logs`, and `/admin/settings`; the shared router and layouts remain integrator owned.

`createOperationsRouter({ auth, models, ...ports })` accepts the P02 `requireActor`, `requireCapability(capability)`, and `csrfProtection` middleware names. The integrator still needs to mount it at the API prefix. `createOperationsPorts()` provides `audit.appendAudit`, `outbox.appendOutbox`, and `outbox.enqueueMail` for domain services.

## Worker and SMTP

`createOutboxWorker()` processes one event at a time. `startOutboxWorker(worker)` polls serially and returns a `stop()` method that waits for the active operation. The server/worker composition must pass a configured SMTP transport, the payload decrypt function, and an admin alert callback; this package does not create provider success responses when an adapter is absent.

The outbox payload cipher requires `OUTBOX_ENCRYPTION_KEY`: a stable Base64 encoding of 32 random bytes. Configure and rotate it through the deployment secret store, never through business settings or Git. Existing encrypted payloads need the same key to be retried. Loss of that key makes queued emails unreadable and needs operator recovery.

SMTP host, port, TLS mode, user, password, sender, and public web origin are deployment configuration. Construct the Nodemailer transport in the server/worker composition and pass it to `createSmtpProvider()`. Domain mail templates are allowlisted; identity's internal names need an integrator adapter for `verify-email`, `reset-password`, `user-invitation`, `appeal-access-code`, `appeal-decision`, and `account-status-update`. The adapter maps those to the canonical P09 template keys and maps its variables; it must keep invitation links on the configured public web origin.

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

Unit tests cover owner filters, role denial, redaction, version conflicts, worker retries/dead-letter, encrypted mail payloads, SMTP rendering and unavailable fallback. A real MongoDB replica set is still required to verify unique-index races and settings transaction behavior. Live SMTP, credentials, and worker process supervision are deployment checks, not verified here.
