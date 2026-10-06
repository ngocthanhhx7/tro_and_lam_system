# TRO & LAM product concept images

> These files are concept illustrations. They are not verified photographs of physical stock, production batches, or particular pottery workshops. Do not use them to claim exact dimensions, glaze, provenance, or availability.

No competitor or manufacturer photographs were downloaded or reused. The assets use a consistent warm ivory studio palette, cobalt blue decoration, and portrait framing. They contain no logos or watermarks.

## Per SKU

| Product | Files | Image origin |
| --- | --- | --- |
| Lư xông trầm mini | `lifestyle/lu-xong-tram-mini-01-front.jpg`, `lifestyle/lu-xong-tram-mini-02-detail.jpg`, `lifestyle/lu-xong-tram-mini-03-context.jpg` | Three concept views generated through Agy |
| Hũ trà | `lifestyle/hu-tra-01-front.jpg`, `lifestyle/hu-tra-02-detail.jpg`, `lifestyle/hu-tra-03-context.jpg` | Three concept views generated through Agy |
| Bộ chén độc ẩm | `lifestyle/bo-chen-doc-am-01-front.jpg`, `lifestyle/bo-chen-doc-am-02-detail.jpg`, `lifestyle/bo-chen-doc-am-03-composition.jpg` | Agy front concept; detail crop and inset composition derived from that image |
| Bình Thiên Nga | `diplomacy/binh-thien-nga-01-front.jpg`, `diplomacy/binh-thien-nga-02-detail.jpg`, `diplomacy/binh-thien-nga-03-composition.jpg` | Agy front concept; detail crop and inset composition derived from that image |
| Bình Phú Quý | `diplomacy/binh-phu-quy-01-front.jpg`, `diplomacy/binh-phu-quy-02-detail.jpg`, `diplomacy/binh-phu-quy-03-composition.jpg` | Agy front concept; detail crop and inset composition derived from that image |
| Bình Giọt Ngọc | `diplomacy/binh-giot-ngoc-01-front.jpg`, `diplomacy/binh-giot-ngoc-02-detail.jpg`, `diplomacy/binh-giot-ngoc-03-composition.jpg` | Agy front concept; detail crop and inset composition derived from that image |
| Bình Hoa Lam | `diplomacy/binh-hoa-lam-01-front.jpg`, `diplomacy/binh-hoa-lam-02-detail.jpg`, `diplomacy/binh-hoa-lam-03-composition.jpg` | Agy front concept; detail crop and inset composition derived from that image |
| Bình Tỳ Bà | `diplomacy/binh-ty-ba-01-front.jpg`, `diplomacy/binh-ty-ba-02-detail.jpg`, `diplomacy/binh-ty-ba-03-composition.jpg` | Agy front concept; detail crop and inset composition derived from that image |

All eight SKUs now have three image files. The six detail/composition pairs made locally are honest derivatives of each SKU's own front image; they do not depict a separate camera angle or a physical product.

## Generation record

- Agy generated the eight front concepts and the detail/context views for Lư xông trầm mini and Hũ trà. The image-generator then returned HTTP 429 `RESOURCE_EXHAUSTED` / `QUOTA_EXHAUSTED` on `gemini-3.1-flash-image` while generating the remaining views. Agy reported its next quota window at approximately `2026-10-06T09:51:27Z`.
- To finish a consistent three-file gallery without changing image providers or borrowing unrelated product photos, the remaining detail crops and editorial compositions were derived locally from each affected SKU's own front concept. The reproducible script is `fondend/scripts/build-concept-derivative-views.py` (requires Pillow).
- Product image URLs and Vietnamese alt text are listed in `manifest.json`. They can be attached to products through the catalog admin flow. This manifest does not create product or category records, set prices, or claim inventory.

## Use in the storefront

Keep an explicit AI-concept disclosure adjacent to these images. The manifest alt text also marks whether an image is a generated concept view, crop, or composition. Replace the concepts with approved product photography when the real SKUs and image rights are confirmed.
