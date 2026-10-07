# P10 assistant module

The module owns `ai_conversations` and exports `createAssistantRouteFragment({ ports, config })`. The coordinator mounts it under `/api/v1`. It exposes `POST /assistant/messages`; P07 owns `POST /assistant/handoffs`.

## Composition ports

- `identityMiddleware`: P02 CSRF and optional session authentication. A blocked or invalid full session is not silently downgraded to guest.
- `catalogPort.searchPublished({ q, page, limit })`: P04 published-only search. The assistant requests at most four results.
- `publishedContentPort.getPublishedStoryById(id)`: P08 published-only resolver. Draft/archived stories are ignored.
- `assistantRepository`: optional repository override for tests; production uses the P10 Mongoose repository.
- `aiProvider`: optional provider override for tests. Production uses the Gemini adapter only when both `GEMINI_API_KEY` and `GEMINI_MODEL` are configured.
- `assistantUsageGuard`: optional shared rate/budget store. The included in-memory guard is suitable for one process and tests; multi-instance production must inject a shared store.
- `createAssistantTranscriptPort(service)` exposes P07's `assistantTranscript.assertConversationOwner(conversationId, actor)` and `getSharedTranscript(conversationId, actor)` ports.

The only model context is a small allowlist of public product fields and published story text. No order, customer, account, payment, internal note, media-storage credential, or write service is passed to Gemini. Product/story sources and their same-origin URLs are constructed by the server; model output cannot create citations. All user and CMS text is passed as untrusted content, and obvious emails, phone numbers, address labels, OTPs, order codes, card numbers, and credentials are redacted before storage/provider calls. The UI renders model text as text, never raw HTML.

## Configuration and limits

Coordinator-owned env validation should map these names to route config without adding secrets to Vite or Git:

- `GEMINI_API_KEY` — server only.
- `GEMINI_MODEL` — bare model ID supported by the merchant Gemini API (a leading `models/` prefix is accepted and normalized); Agy model IDs are not assumed to match.
- `AI_TIMEOUT_MS` — capped at 15 seconds.
- `AI_DAILY_BUDGET` — P10 currently interprets this as a daily estimated-token ceiling; unset/zero disables model calls. Input/output is bounded and budget is reserved before provider I/O. A local demo can use `10000` as a conservative token ceiling; this is not a request count or a VND cost limit. A pricing/VND budget is not implemented because model pricing and owner limits are not configured.
- `aiConversationTtlMs`, `assistantRateLimit`, and `assistantRateWindowMs` are optional server config values; the defaults are 30 days and 10 messages per 15 minutes.

Guest conversation ownership uses a separate random HttpOnly `tl_assistant_guest` cookie scoped to `/api/v1/assistant`; Mongo stores only its SHA-256 hash. The cookie grants access only to that guest's assistant conversation. It is not an order, account, or support-ticket credential. User and guest ownership is checked on every read/write, and expired conversations are rejected at runtime. `expiresAt` has a TTL index for eventual cleanup; `purgeExpired()` is available for bounded explicit cleanup.

P07 resolves an anonymous assistant handoff only from the scoped `tl_assistant_guest` cookie through `assistantGuestOwnerFromRequest(req)`; it never accepts an owner or hash from the request body. This allows a no-order contact handoff only. An `orderId` still requires the existing P02 order-proof middleware and P07 ownership check. Backend route tests cover cookie ownership and refusal to downgrade an invalid full session; the P11 browser test covers the guest assistant fallback and visible handoff option.

The included in-memory usage guard enforces per-process rate and estimated-token limits, not a cluster-wide budget. Configure P02/P09 shared rate storage or inject a durable shared guard before running multiple API instances.

## Index migration

Run `node backend/src/assistant/migrate-assistant-indexes.js` as an explicit migration after configuring the target database. It only creates declared indexes. The TTL index removes expired assistant conversations asynchronously; application queries also check `expiresAt`, so TTL timing is not an authorization check. No live Atlas migration was run for this package.

## Provider research and evidence

`agy --help` and `agy models` were checked on 2026-10-06; `gemini-3.8-flash-high` appeared in Agy's model list. The read-only `/teamwork-preview` call with that model and High effort returned no output after more than 100 seconds and was interrupted; this package does not claim Agy research completed and did not use `--dangerously-skip-permissions`.

Fallback research read the Google official [GenerateContent API reference](https://ai.google.dev/api/generate-content) and [Models API reference](https://ai.google.dev/api/models) on 2026-10-06. The adapter uses the documented REST `models/{model}:generateContent` endpoint and an API-key header to avoid a new package/lockfile change. The Models API documentation says a model name should match a model returned by `models.list`; Agy's `gemini-3.8-flash-high` is therefore not treated as proof that the merchant API supports that ID. No Gemini API key was configured, no live request was made, and no provider success is claimed.
