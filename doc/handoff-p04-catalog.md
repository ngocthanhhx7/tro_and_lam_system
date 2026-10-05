Package: P04; branch: feature/p04-catalog-public; baseline: 77d2d231b2e70eed5e9c3e29dd27664c519ea2da

Changed files:
- `backend/src/models/catalog/category.model.js`
- `backend/src/models/catalog/media-asset.model.js`
- `backend/src/models/catalog/product.model.js`
- `backend/src/routes/catalog.routes.js`
- `backend/src/services/catalog/README.md`
- `backend/src/services/catalog/catalog-validation.js`
- `backend/src/services/catalog/catalog.service.js`
- `backend/src/services/catalog/media-provider.js`
- `backend/src/services/catalog/mongoose-catalog.repository.js`
- `backend/tests/catalog/catalog-validation.test.js`
- `backend/tests/catalog/catalog.routes.test.js`
- `backend/tests/catalog/catalog.service.test.js`
- `doc/handoff-p04-catalog.md`
- `fondend/src/components/catalog/CatalogStates.jsx`
- `fondend/src/components/catalog/ProductCard.jsx`
- `fondend/src/layouts/PublicCatalogLayout.jsx`
- `fondend/src/pages/admin/catalog/AdminCatalogPage.jsx`
- `fondend/src/pages/catalog/ProductCatalogPage.jsx`
- `fondend/src/pages/public/CatalogHomePage.jsx`
- `fondend/src/pages/public/ProductDetailPage.jsx`
- `fondend/src/routes/modules/catalog.routes.jsx`
- `fondend/src/services/catalog/catalogApi.js`
- `fondend/src/styles/catalog.css`

APIs: `GET /products` (`listProducts`), `GET /products/{slug}` (`getProductBySlug`), `GET /categories` (`listPublishedCategories`), `GET/POST /admin/products` (`listAdminProducts`, `createAdminProduct`), `GET/PATCH/DELETE /admin/products/{id}` (`getAdminProduct`, `updateAdminProduct`, `archiveAdminProduct`), `GET/POST /admin/categories` (`listAdminCategories`, `createAdminCategory`), `PATCH/DELETE /admin/categories/{id}` (`updateAdminCategory`, `archiveAdminCategory`), and `POST /admin/media` (`createAdminMedia`). Product listing honors the develop amendment for `saleMode` and `available`; product PATCH uses `ProductPatch.expectedVersion`; unavailable media returns `MEDIA_UNAVAILABLE`.

Migration/indexes: Product slug/SKU and category slug uniqueness and catalog query indexes are declared in Mongoose schemas. No migration/index build or rollback script is included; review and provision indexes using the integrator's managed process. No destructive automatic migration runs.

Integration requests to I:
- Mount `createCatalogRouter` at `/api/v1` from the composition root; inject the P02 `requireAdmin` middleware and actor/session resolvers.
- Add `catalogRoutes` to `AppRoutes` outside the shared `MainLayout`; protect admin pages with the P02 route guard.
- Inject P05 `inventoryPort.getAvailability`, P08's additive internal `storyPort.getPublishedStoryById(id, locale)` and a configured media provider when available. Quote submission calls P07 `POST /contacts`; direct cart actions call P03 `/cart` APIs.
- P08 currently exposes published-story lookup by slug, but products store a story ObjectId. The coordinator confirmed P08 will add a visibility-checked by-ID resolver before final integration; do not send the ID through the public `/stories/:slug` route.
- Resolve P09 audit-port integration for every admin create/update/archive and media action. No P04-owned shared composition, contract, manifest, package, or global style file was edited.
- Keep the home hero illustration at `/assets/generated/chu-dau-jar-editorial.jpg` and retain the visible caption `Ảnh minh họa do AI tạo; không đại diện sản phẩm đang bán.` The integrator supplied this AI illustration in `develop`; it is not a product image or SKU.

Tests executed: `npm run check` with Node v24.21.0 on 2026-10-06 05:30 (Asia/Saigon): contract validation passed (102 paths, 121 operations, 56 DTO schemas, 22 enums, 12 fixtures); ESLint passed; backend tests passed 38/38, including P04 route/service/validation tests; Vite production build passed. Catalog tests use deterministic inventory/media fakes and Supertest. No replica-set/database, browser, or live-provider test was run.

Provider evidence: No media storage provider or credentials are configured; no live media upload was attempted. Deterministic fake storage was used only by unit tests. Read-only design research on 2026-10-06: `https://saccodo.com/` returned HTTP 200 with the title “Sắc Cố Đô | Pop-up passport Ninh Bình” and image-led sections; its markup contained 49 images, and inspected CSS used a sticky translucent blurred header and wide navigation. My direct request to `https://thanhnamhuongky.io.vn/` failed DNS resolution during that session; the coordinator separately recorded a successful GET and visible content in the brand guide, so the failure is treated as transient/tool-specific. Agy `read_url` research was denied. No competitor assets, copy, logos, or code were reused.

Remaining risks/policy assumptions: P09 audit writes remain unimplemented; P08's additive story-by-ID port needs to land before final integration; production media storage is unavailable and uploads return 503; image validation checks MIME signatures and size but does not decode images; index rollout requires a managed migration; MongoDB concurrency/index behavior and real inventory integration remain unverified. Quote leads, cart, story pages, authentication/CSRF, and route composition depend on P02/P03/P05/P07/P08 integration.

PR/commits: no PR created; implementation commit `1f6b2c2` on `feature/p04-catalog-public`; this handoff update follows that commit. Contract amendment: none in this package; integrate against `dea5277581d768fd87baab6b1209042ce66ae800` (DEC-17/18) after the coordinator's rebase.

## Coordinator integration addendum — 2026-10-06

P04 implementation and guard fix are now on `develop` through `daa7e8f`. P08's published story-by-ID resolver landed in `ebf73e2`, so the earlier dependency request above is satisfied without exposing the ID through the public slug endpoint. P03 has also been integrated at `210aaa5`.

P04 package checks passed: contract validation, lint, backend 38/38 and Vite production build. A later integrated `npm run check` after P03 passed backend 92/92, lint, contract validation and Vite build. These checks do not yet prove runtime integration: `catalogRoutes` is still not mounted by the shared `AppRoutes`, the API catalog router is not yet injected into the server composition, and P09 audit/P02 capability wiring needs coordinator integration. There is no browser/E2E, Atlas or live media-provider evidence. Keep the AI concept caption and manual playback behavior when mounting the route.
