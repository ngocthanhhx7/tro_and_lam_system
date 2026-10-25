# News image loading review — 2026-10-26

Baseline: `482a36c2a0c614516bb26a4d765b49f27f9eed7e`, confirmed on local develop, GitHub develop and the live VPS release `/opt/tro-lam/releases/482a36c-banner-20261026` before editing. The image changes were implemented and verified locally first. The owner subsequently authorized deployment to the VPS; production verification is recorded with the deployed release. No production data is changed.

## Findings before implementation

Reviewed all image render sites in NewsPage, NewsArticlePage and NewsCard, the existing static-image generator/helper/manifest, the decorative motif and the deployed Nginx asset configuration. Audited all 16 article routes plus the news index at desktop and mobile sizes. No news content database query is introduced or changed: these articles are existing local editorial data; account/cart API behavior remains separate.

The 19 distinct content image sources total 9,849,990 bytes. None was in the responsive allowlist. NewsCard invoked staticImageProps but received its original-only fallback, so adding that helper alone had not optimized these photos. Feature, spotlight, article, inline and brand-note images directly used originals. Examples: a decorative product photo is 2,009,586 bytes and the tea-set photo is 1,574,426 bytes. The spotlight image for Ikebana is 630,960 bytes even when its desktop/mobile box is only 112/88 pixels wide. Existing lazy loading and asynchronous decoding partly helped but did not reduce file size.

On the live index with fresh browser contexts and DPR 2, loading all paginated cards and all lazy images transferred 9,179,735 image bytes on desktop and 9,054,881 on mobile. These totals include supporting images and are not the initial viewport payload. Production serves assets from the same origin with a 30-day cache policy. No CDN/service change is needed for this implementation.

## Implemented approach

- Preserve all supplied original images, crops in CSS, copy, source credits, routes, filters and pagination.
- Generate WebP derivatives offline at widths 160/320/640/960/1280/1600, capped to source resolution. No image is upscaled, fetched externally or converted per request. Quality is 82, matching the existing editorial encoder.
- Use content-addressed URLs under `/assets/responsive/v1/` with a separate news manifest: 19 sources, 97 variants, 6,693,140 bytes across *all sizes on disk*. A browser selects suitable sizes instead of downloading the entire derivative set. Explicit source/pixel and 8 MiB combined-disk bounds remain in the generator.
- Extend the existing responsive helper through a reusable manifest adapter while preserving its old API and behavior. News gets accurate sizes rules for feature, spotlights, cards, related articles, lead/inline images and the brand image.
- Keep only lead/feature images eager with high fetch priority. Remaining images stay lazy. Declare original intrinsic dimensions for layout reservation. Account for the mobile feature's object-fit cover crop when selecting resolution to avoid overly soft imagery.
- Derivative failures remove srcset and return to the original URL; unknown URLs remain untouched. Original files, security/cache policies for JSON, dependencies and data flows are unchanged.

Rebuild derivatives with `node scripts/prepare-news-images.mjs` after adding/changing reviewed news assets. Tests fail if any published news source has no manifest entry or a referenced derivative is missing.

## Comparable before/after measurements

Local browser audit: same desktop 1440px/mobile 390px, 900px height, DPR 2, fresh context for each route, same anonymous mocked API, original baseline vs optimized local page. All pagination expanded and all news images decoded before measuring the complete-page payload. Counts include supporting images; image variants shared by multiple elements are counted as browser resources, not multiplied by DOM occurrences.

| News index, full expanded page | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Desktop | 9,182,186 bytes | 1,989,759 bytes | 78.3% |
| Mobile | 9,057,332 bytes | 1,792,957 bytes | 80.2% |

Across all 16 article pages, each with a fresh context: desktop image payload total 34,541,306 → 4,614,812 bytes; mobile 34,541,306 → 7,279,106 bytes. This sum intentionally counts reused images again across separate visits and is not a single-page payload. The original and transformed photos remain identical subjects; originals were not edited.

A separate throttled comparison used built production bundles from the original commit and optimized tree, on localhost with a 500,000-byte/s download cap (~4 Mbps), 80ms network latency, 4x CPU slowdown, DPR 2, cache disabled, mocked anonymous API, 3 fresh runs per viewport/version. Median LCP: desktop 2,092 → 1,940 ms; mobile 1,968 → 1,952 ms. Sample size is small and localhost/API mocks do not represent VPS transport or real account traffic. One desktop optimized sample was slower than baseline. Therefore the defensible improvement is lower image transfer/decode demand, especially while scrolling and expanding the library, not a claimed 78–80% reduction in page-load time. Fixed-time initial resource totals are not comparable completion totals because the optimized page can finish more images in the same time window.

No meaningful layout-shift regression was observed in the index snapshots (desktop CLS around 0.0065, mobile around 0.0007). Existing layout/fonts remain unchanged. Minor subpixel/font-timing differences in card geometry are not presented as a layout optimization.

## Verification

- Before/after browser audit covers 34 route/viewport combinations: index plus every article on desktop/mobile; all content images decode and no JavaScript errors/horizontal overflow.
- Built-page boundary checks cover 320, 639, 640, 768, 880, 881, 999, 1000, 1100, 1101, 1360 and 1440px; screenshots retained locally.
- 20 development tests pass, including existing static-image coverage and new checks for every news image, actual WebP dimensions, bounded disk size, unknown URLs and fallback.
- Focused browser tests verify search, expanded pagination, article copy/source references, mobile layout, responsive source selection, eager lead priority, small thumbnails and recovery after deliberately failed derivative requests. No retries or assertion reductions.
- Lint and production build pass. Backend/payment/stock/auth behavior is unchanged; no production order/payment/email fixtures were created. The full backend/browser suite is not claimed to have been rerun for this local image-only change.

Detailed inventory, generation output, baseline/live/local measurements, comparison, throttled samples, screenshots and logs are under ignored `.codex-tools/news-image*` and `.codex-tools/news-images-*`. Personal skill files, skill notices, AGENTS.md and owner image folder were preserved. The owner subsequently authorized commit/push and VPS rollout. The release retains the preceding 482a36c banner release for rollback; detailed live verification is stored in its VERIFICATION.json.
