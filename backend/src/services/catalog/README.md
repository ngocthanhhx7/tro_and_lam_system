# P04 catalog and public storefront

P04 owns product and category records, public catalog reads, admin product/category maintenance, and public catalog media metadata. It does not write inventory or turn quote requests into orders.

## Module boundaries

- `catalog-validation.js` validates public filters, product/category writes, optimistic versions, image URLs, and upload alt text.
- `catalog.service.js` implements public/admin DTOs and coordinates the repository, inventory, story, and media ports.
- `mongoose-catalog.repository.js` implements persistence for products, categories, and media assets. Product archive is a soft status change so commerce snapshots remain independent.
- `catalog.routes.js` exports `createCatalogRouter({ service, requireAdmin, actorFromRequest, sessionFromRequest, mediaParser })`. It mounts at the API root and is intended to be composed under `/api/v1` by the integrator.
- `media-provider.js` supplies an unavailable production default contract and a deterministic test fake. The fake must not be wired into production.

## Public and admin APIs

Public operations are `GET /products`, `GET /products/:slug`, and `GET /categories`. Product search supports `q`, `line`, `category`, `priceMin`, `priceMax`, `saleMode`, `available`, `sort`, `page`, and `limit`. Sorting includes a unique ID tie-breaker in the Mongoose repository. Availability filtering uses the inventory port and fails closed if that port cannot answer.

Admin operations are `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/:id`, `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id`, and `POST /admin/media`. Product and category patches require `expectedVersion`; archive operations also require the current version. The router denies admin routes when `requireAdmin` is omitted. The integrator must inject the P02 admin middleware and apply a matching client-side guard.

The OpenAPI operation IDs are `listProducts`, `getProductBySlug`, `listPublishedCategories`, `listAdminProducts`, `createAdminProduct`, `getAdminProduct`, `updateAdminProduct`, `archiveAdminProduct`, `listAdminCategories`, `createAdminCategory`, `updateAdminCategory`, `archiveAdminCategory`, and `createAdminMedia`.

## Ports

- `inventoryPort.getAvailability(productIds, { session })` returns records with `productId` and boolean `available`. Quote-only products do not query inventory. Browse without a working inventory port labels direct-sale products as unverified and disables purchase; filtering by availability returns `DATABASE_UNAVAILABLE` if availability cannot be confirmed.
- `storyPort.getPublishedStoryById(storyId, { session })` optionally supplies a published P08 story to the product detail DTO. A missing or unpublished story is omitted without hiding the product.
- A configured `mediaProvider` must expose `configured: true`, `upload({ buffer, mimeType, alt, actorId })`, and optional `remove(storageKey)`. Uploads are limited to JPEG, PNG, or WebP with recognized leading signatures and a 5 MB size limit. No storage provider is configured in this package, so uploads return `503 MEDIA_UNAVAILABLE`.
- The coordinator injects the P09 audit port. Product, category, and media metadata writes append a redacted audit event in the same Mongo transaction as the catalog change. Admin write routes also require the P02 CSRF middleware; when it is omitted, mutations fail closed.

P08 can use `getPublishedProductsByIds(ids, { session })` for published product references and `getAdminProductReferencesByIds(ids, { actor, session })` for admin references. P05 can use `getCheckoutProducts(ids, { session })`; quote-only, unpublished, unpriced, or otherwise non-buyable products are omitted.

P08 currently exposes published story lookup by slug, while the product model stores `storyId` as an ObjectId. Integration needs P08's additive internal published-by-ID method; do not resolve this link by calling the public story route with an ID.

## Frontend composition

`fondend/src/routes/modules/catalog.routes.jsx` exports the `catalogRoutes` fragment. It contains the public shell and routes for `/`, `/san-pham`, `/san-pham/:slug`, and `/bo-suu-tap/:line`, plus admin catalog/category pages. The integrator must compose this fragment outside the shared `MainLayout` and must not edit the shared route files from this package.

Product detail offers a cart action only for `buy` or `both` products with confirmed availability and a positive safe integer price. `quote` products show a consultation form that posts `kind: 'quote'` to P07's `/contacts`; sending a request does not create an order or reserve stock. Cart updates depend on P03's cart API. CSRF initialization depends on P02.

The home hero references `/assets/generated/chu-dau-jar-editorial.jpg`, an AI editorial illustration supplied by the integrator. Its caption identifies it as AI-created and says it does not represent a product for sale. The image must remain separate from product media and SKU content.

## Persistence and operational notes

Mongoose schemas declare unique product slug/SKU and category slug indexes, plus catalog query indexes. There is no migration or index rollback script in this module; the integrator must review and create production indexes through the deployment's managed migration procedure. No new package or environment dependency is required.

The service and route tests use repository, inventory, and media fakes with Supertest. They do not verify MongoDB transaction behavior, real inventory consistency, browser accessibility, or a live storage provider.
