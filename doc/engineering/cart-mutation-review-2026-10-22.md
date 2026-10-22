# Cart mutation review - 2026-10-22

## Scope and findings

Reviewed catalog card/detail add, cart quantity/delete, header event updates, GET single-flight, routes, guest cookie rotation, account service and Mongo repository. The add contract computes an absolute quantity from a fresh cart version: GET then PUT. Retained this behavior rather than reusing stale prices/cart reads or weakening optimistic concurrency. Header mutation events already carry the returned DTO and do not need another GET.

On a separate temporary guest cart from VPS to Atlas (two existing public products, one remains after deletion), three baseline GET+PUT samples: 914-919 ms and five commands. Three DELETE samples: 1093-1099 ms and six commands: three find, one findAndModify, one commitTransaction and one aggregate. Individual commands took approximately 180-184 ms. These are service-path measurements including equivalent guest middleware, not HTTP latency or server capacity measurements. Fresh process initialization and setup excluded. Temporary carts removed by exact random guest hash; no orders, payments or mail generated.

Explain of the exact guest filter with `$eq` and `$type: string` used `one_cart_per_guest_token` IXSCAN, one key and one document examined. No new index/hint required. Existing global API rate limit retained. No evidence here establishes CPU saturation, overload threshold or production p95/p99.

## Changes

DELETE reuses the request-scoped ownership snapshot already read by middleware, including consumed-token rotation. Removes duplicate cart reads and its own transaction for a one-document versioned CAS. Existing external transaction sessions are respected. Empty deletion does not create a persisted cart. Remaining products are freshly priced; removed/unpublished products remain removable; stale writes still return VERSION_CONFLICT. Merge/checkout transactions are unchanged.

Synchronous in-flight guards prevent repeated same-tick clicks in product cards, detail add and cart quantity/delete handlers, supplementing disabled controls. Requests from separate products, tabs or sessions still rely on server CAS; no automatic mutation replay introduced. Add still uses fresh GET+PUT; it is not claimed to have lower database round trips. Recommendation refreshes and authentication reads remain additional costs depending on the UI/session.

Also removed collection-page breadcrumb rows and source/confirmation tags/photo captions requested in the screenshots. Product-detail provided-photo notes are hidden; existing concept-image identification remains for concept imagery.

## Verification

27 unit/route/model/single-flight tests passed. Three local replica-set suites passed in isolated random databases: concurrent update/delete permits one winner; stale pre-merge snapshot cannot modify consumed guest cart; external transaction rollback restores deletion; owner isolation, checkout replay and voucher/stock behavior retained. Browser API mocks verified 20 same-tick events yield one PUT on card/detail, and one DELETE across two cart rows; no extra GET after mutation event. Both collection pages render without removed breadcrumbs/tags/captions. Lint and production build passed.

Post-deployment measurements are recorded after rollout below.

## Post-deployment result

Live release: `c6ce592-cart-tune-20261022`; previous release retained for rollback. Readiness returned database connected. Three after samples: DELETE 590-591 ms, exactly three commands (find, findAndModify, aggregate), compared with 1093-1099 ms and six commands before. Approximately 46% lower elapsed time in this small sample; database round trips halved. Final-item deletion skips product lookup because no products remain.

GET+PUT remained five commands: 981-984 ms after versus 914-919 ms before. Per-command Atlas latency increased from approximately 181-184 to 194-197 ms between samples, explaining variation; no add latency improvement claimed. These figures do not include HTTP transport, CSRF initialization, authenticated session lookups or recommendation requests.

Browser checks against the deployed frontend with intercepted API mutations passed: duplicate-click protection on card/detail/cart, header updates without extra GET, removed collection-page elements. The service benchmarks exercised real temporary guest-cart mutations on Atlas and cleaned the exact temporary documents. No load test was run against production and no server capacity guarantee is inferred.
