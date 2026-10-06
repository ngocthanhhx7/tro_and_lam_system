# TRO & LAM product concept images

> These files are concept illustrations. They are not verified photographs of physical stock, production batches, or particular pottery workshops. Do not use them to claim exact dimensions, glaze, provenance, or availability.

No competitor or manufacturer photographs were downloaded or reused. The concept assets use a consistent warm ivory studio palette and cobalt blue decoration. They contain no logos or watermarks.

## Owner-provided product photographs

The project owner supplied photographs in `C:\Users\nguye\Downloads\Ảnh Sản Phẩm`. Matching files were copied into `../owner-provided/` and re-encoded as WebP (quality 88); the originals were left untouched. Image metadata was not copied. These files are identified as owner-provided in gallery alt text and in the storefront. Rights for use outside this local preview still require the owner's release approval.

| Supplied file | Project asset | Product mapping |
| --- | --- | --- |
| `hop-tra-chim-lac.webp` | `../owner-provided/hu-tra-chim-lac.webp` | Hũ trà |
| `bộ trà 2.png` | `../owner-provided/bo-chen-doc-am.webp` | Bộ chén độc ẩm; the photo shows one teapot and one cup |
| `Bình Thiên Nga.jpg` | `../owner-provided/binh-thien-nga-01.webp` | Bình Thiên Nga |
| `Bình Thiên Nga 2.jpg` | `../owner-provided/binh-thien-nga-02.webp` | Bình Thiên Nga |
| `Bình Phú Quý.png` | `../owner-provided/binh-phu-quy.webp` | Bình Phú Quý |
| `Giọt ngọc 1.png` | `../owner-provided/binh-giot-ngoc-01.webp` | Bình Giọt Ngọc |
| `Giọt Ngọc 2.jpg` | `../owner-provided/binh-giot-ngoc-02.webp` | Bình Giọt Ngọc |
| `Giọt Ngọc 3.jpg` | `../owner-provided/binh-giot-ngoc-03.webp` | Bình Giọt Ngọc |
| `Hoa Lam Tỳ Bà.jpg` | `../owner-provided/hoa-lam-ty-ba-pair.webp` | Shared photo of Bình Hoa Lam and Bình Tỳ Bà; it is not presented as a separate view of either vase |

## Per SKU

| Product | Files | Image origin |
| --- | --- | --- |
| Lư xông trầm mini | `lifestyle/lu-xong-tram-mini-01-front.jpg`, `lifestyle/lu-xong-tram-mini-02-detail.jpg`, `lifestyle/lu-xong-tram-mini-03-context.jpg` | Three concept views generated through Agy |
| Hũ trà | `../owner-provided/hu-tra-chim-lac.webp`, `../derived/hu-tra-02-lid-and-motif.webp`, `../derived/hu-tra-03-motif-detail.webp` | One owner-provided product photo and two detail crops from that same photo; not new camera views |
| Bộ chén độc ẩm | `../owner-provided/bo-chen-doc-am.webp`, `../derived/bo-chen-02-teapot-detail.webp`, `../derived/bo-chen-03-cup-detail.webp` | One owner-provided set photo and two detail crops showing the teapot and cup from that same photo |
| Bình Thiên Nga | `../owner-provided/binh-thien-nga-01.webp`, `../owner-provided/binh-thien-nga-02.webp`, `../derived/binh-thien-nga-03-motif-detail.webp` | Two owner-provided photos and one detail crop from the first photo |
| Bình Phú Quý | `../owner-provided/binh-phu-quy.webp`, `../derived/binh-phu-quy-02-neck-detail.webp`, `../derived/binh-phu-quy-03-motif-detail.webp` | One owner-provided product photo and two detail crops from that same photo |
| Bình Giọt Ngọc | `../owner-provided/binh-giot-ngoc-01.webp`, `../owner-provided/binh-giot-ngoc-02.webp`, `../owner-provided/binh-giot-ngoc-03.webp` | Three owner-provided photos |
| Bình Hoa Lam | `../owner-provided/hoa-lam-ty-ba-pair.webp`, `../derived/binh-hoa-lam-02-vase-crop.webp`, `../derived/binh-hoa-lam-03-motif-detail.webp` | Shared owner-provided photo plus two crops focused on the right-hand vase; the crop mapping follows the supplied paired-photo filename |
| Bình Tỳ Bà | `../owner-provided/hoa-lam-ty-ba-pair.webp`, `../derived/binh-ty-ba-02-vase-crop.webp`, `../derived/binh-ty-ba-03-motif-detail.webp` | Shared owner-provided photo plus two crops focused on the left-hand vase; these are crops, not new camera views |

All eight preview products have at least three distinct gallery files. Owner photos are used wherever supplied; derived crops are labeled as crops from the source photo, not as new views. Lư xông trầm mini remains a clearly disclosed AI concept because no matching owner photo was supplied. The source note changes with the selected gallery image.

To reproduce the owner-photo crops after changing a source photo, run `python fondend/scripts/build-owner-photo-derivatives.py` from the repository root (requires Pillow). The crop rectangles are fixed in that script and do not generate or invent product details.

## Generation record

- Agy generated the eight front concepts and the detail/context views for Lư xông trầm mini and Hũ trà. The image-generator then returned HTTP 429 `RESOURCE_EXHAUSTED` / `QUOTA_EXHAUSTED` on `gemini-3.1-flash-image` while generating the remaining views. Agy reported its next quota window at approximately `2026-10-06T09:51:27Z`.
- To finish a consistent three-file gallery without changing image providers or borrowing unrelated product photos, the remaining detail crops and editorial compositions were derived locally from each affected SKU's own front concept. The reproducible script is `fondend/scripts/build-concept-derivative-views.py` (requires Pillow).
- On 2026-10-07, Agy listed `gemini-3.8-flash-high` as available. A request to generate a reference-matched Hũ trà view exited without a response or output file, so no new Agy image is included. No image-generation success is claimed.
- This update replaces mismatched AI product views with crops from the matching owner-supplied photos where available. The crops retain their source relationship in alt text and the visible gallery note.
- Product image URLs and Vietnamese alt text are listed in `manifest.json`. They can be attached to products through the catalog admin flow. This manifest does not create product or category records, set prices, or claim inventory.

## Use in the storefront

Keep the source label for the selected image visible beside the gallery. The manifest alt text distinguishes owner-provided photography, AI concepts, crops and compositions. The demo catalog is local, quote-only and unpriced. Before any external publication, confirm photo rights, SKU names, product facts, prices, stock and availability with the owner.
