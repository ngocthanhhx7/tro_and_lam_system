# P08 Content and NFC module

The module owns the `stories`, `pages`, and `nfc_tags` collections and exports its Express route fragment from `content.routes.js`. The coordinator mounts `createContentRouteFragment(...)` below `/api/v1` after composing P02 identity middleware and the P04/P09 service ports.

## Required production integrations

- P02: pass `requireCapability` and `csrfProtection` from `createIdentityMiddleware`. The active admin actor must be attached to `req.actor`; writes require the `content.manage` capability and CSRF guard.
- P04: pass the real `getPublishedProductsByIds(ids, { session })` and `getAdminProductReferencesByIds(ids, { session })` exports. P08 uses the admin lookup to reject invalid linked product IDs, and the published lookup to gate publication and resolve the NFC product. Do not pass test fakes in production composition.
- P09: pass the real `appendAudit(redactedEvent, { session })` port. Content mutation and audit append share the Mongo transaction.
- Root composition: mount the backend route fragment at the API root and the frontend route fragments under the app shell. Wrap `adminContentRouteFragments` in the existing UI guard for `content.manage`; the backend remains authoritative.

The module requires a transaction-capable MongoDB connection. Public story/page/NFC reads filter by `status: published`; drafts and archived content never enter public retrieval. The route returns the frozen story shape with stored `productIds`. NFC resolution returns the contract shape `{ product?, story }`; the product object comes from P04's published-safe summary. The current story DTO has no product-summary response slot, so the public story page cannot render linked product names/cards; it keeps IDs and uses P04's product port for publication checks and NFC.

## Validation and publication

Story and page writes accept a P08-owned block allowlist; this is a bounded implementation rule, not an imported rich-text standard. Rich text is plain text and is never passed to `dangerouslySetInnerHTML`. HTML elements, script/style/embed content, control characters, unknown properties, unsafe URLs, invalid locales, and unsupported blocks are rejected or stripped before persistence. Media/link URLs are limited to same-origin paths or HTTPS without credentials.

| Value | Shape and bounds |
| --- | --- |
| paragraph / heading / quote block | `{type, text}`; text 1–5000 characters |
| list block | `{type, items}`; 1–50 text items, 1–1000 characters each |
| image block | `{type, url, alt, caption?}`; URL ≤2048 characters, alt 1–300, caption ≤500 |
| link block | `{type, text, url}`; text 1–300, URL ≤2048 |
| story section | `{heading?, body}`; heading ≤300, up to 100 blocks |
| story | up to 100 sections, 100 motifs (each 1–300), 100 media items; title ≤300, origin ≤2000, artisan ≤300, slug ≤180 |
| page | up to 200 blocks; title ≤300, slug ≤180 |
| productIds | up to 100 unique 24-character Mongo ObjectId strings |
| media item | `{url, alt, caption?}`; URL ≤2048, alt 1–300, caption ≤500 |

Each variant has an exact property allowlist; unknown fields such as event handlers are rejected. The route tests cover extra block fields, script markup, and a `javascript:` link.

Draft stories may have a blank `origin`; publishing requires a non-empty origin, at least one content section, and product IDs that P04 confirms are public. A draft page may be empty; publishing needs at least one safe block. EN has its own `{slug, locale}` record and no implicit fallback. The API has no provenance-evidence field; `origin` is only the existing string field and cannot by itself prove the source or owner approval. Content must remain a draft until that review is complete.

`delete` on story/page archives by setting `status: archived` under `expectedVersion`; references and documents are retained. NFC identifiers are 128-bit random hex strings, are not authentication tokens, and reveal no buyer/order data. Revocation is a versioned state change that makes the public route return `410 NFC_REVOKED`.

## Index migration

The `createPublishedContentPort(contentService)` facade exposes only published reads: `getPublishedStory(slug, locale)`, `getPublishedStoryById(storyId, { session })`, and `resolveNfc(publicId, locale)`. The ID lookup preserves the referenced record's locale and returns not found for draft/archived stories. NFC revoke stores `reasonCode: ADMIN_REASON_PROVIDED` and a redacted status change; it validates but does not persist the free-text reason, which may contain PII. Schema indexes are declared in `content.models.js`. Run `node backend/src/content/migrate-content-indexes.js` as an explicit deployment migration after configuring the target database. It only calls `createIndexes()` and never drops collections/indexes or edits documents. Before running against a production database, check for duplicate `{slug, locale}` rows and duplicate `publicId` values; resolve collisions through the normal content/admin workflow. Rollback is an application rollback; indexes are additive and can be removed only through a separately reviewed database migration.

The migration was not run against a live Atlas database in this package task.
