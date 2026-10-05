# TRO & LAM — brand identity and content guide

## Brand foundation

TRO & LAM presents Chu Đậu ceramics for daily use, interiors and considered gifts. The visual system follows the supplied logo: deep blue-green, gold linework, an ivory ground, and the lotus motif already present in the mark. The logo is the source of the identity; interface decoration must stay secondary to the ceramics and approved product photography.

The two catalog lines remain distinct in product copy:

- **Lifestyle Line** — useful ceramics and objects for personal spaces and gifting.
- **Diplomacy Line** — selected vessels and gift inquiries for formal, business and institutional occasions. Purchase or quote actions follow each product's `saleMode`.

NFC pages explain an editorial story attached to a tag. A tag URL is not proof of authenticity, provenance or ownership.

## Visual system

| Token | Value | Use |
| --- | --- | --- |
| Deep blue-green | `#092B3B` | Header, footer and high-contrast brand surfaces |
| Ceramics blue | `#123F56` | Links, active navigation and secondary actions |
| Warm ivory | `#F7F3E9` | Main page ground and quiet editorial sections |
| Logo gold | `#D8B35A` | Fine rules, small highlights and focus accents |
| Primary text | `#1D2930` | Body text on light surfaces |

These values reuse the local design tokens and approximate the supplied logo palette. Keep gold as an accent rather than a large text or page background color. Preserve the logo artwork and clear space; do not recolor, crop or redraw it in the interface.

Use the self-hosted **Noto Serif** Vietnamese variable font for display headings and **Be Vietnam Pro** for body text, controls, labels and figures. Keep paragraphs comfortably readable on mobile. Avoid all-caps body copy and excessive letter spacing in Vietnamese.

## Layout direction

Use a quiet editorial rhythm: generous ivory space, strong product imagery, short section introductions and restrained blue/gold details. Public pages should lead with a concrete product or collection and a clear next action. Product cards show price only when the SKU is purchasable; quote-only items say “Yêu cầu báo giá”. Keep catalog filters in the URL and make mobile product grids easy to scan.

Reference review on 2026-10-06 used read-only HTTP GET requests to [Sắc Cố Đô](https://saccodo.com/) and [Thành Nam Hương Ký](https://thanhnamhuongky.io.vn/). The first page visibly organizes an introductory hero, destination/story cards and a numbered visitor journey. The second opens with a brand statement, follows with a brand story and product cards, and includes category navigation and newsletter content. TRO & LAM can use those general information patterns while keeping its own logo, product photography, colors and copy. No reference-site image, video, logo, text or source code was copied or downloaded. Agy's web-research tool was denied command permission in this session; these observations are the coordinator's direct page review, not Agy research.

## Voice and page wording

Write in Vietnamese first. Sound composed, clear and helpful. Describe visible form, material, dimensions, use and care only from approved product data. Treat heritage, maker, workshop, motif and origin statements as claims that need an approved source.

Preferred CTA labels:

- “Khám phá bộ sưu tập”
- “Xem chi tiết sản phẩm”
- “Thêm vào giỏ”
- “Yêu cầu báo giá”
- “Tư vấn quà tặng doanh nghiệp”
- “Đọc câu chuyện”

Use these search phrases naturally when they match the page: **gốm Chu Đậu**, **gốm trang trí**, **quà tặng gốm**, **quà tặng doanh nghiệp**, and **câu chuyện gốm qua NFC**. Put one clear subject in each page title and heading. Product pages should name the exact approved product; do not add dimensions, price, artisan or provenance terms without data. Use descriptive image alt text for informative product photos and empty alt text for purely decorative art.

Example homepage title: `TRO & LAM — Gốm Chu Đậu cho đời sống hôm nay`.

Example collection introduction: `Khám phá các sản phẩm gốm Chu Đậu thuộc Lifestyle Line và Diplomacy Line. Lọc theo công năng, mức giá và hình thức tư vấn; thông tin sản phẩm được hiển thị theo dữ liệu đã công bố.`

Do not publish claims such as “nghìn năm”, “di sản UNESCO”, “nghệ nhân lâu đời”, “thủ công 100%”, “độc bản”, “được chứng nhận”, or “chống hàng giả” unless the owner supplies and approves supporting evidence. Do not fabricate reviews, stock, discounts, delivery promises or customer counts.

## SEO/GEO content structure

- Give every public page a distinct Vietnamese title, summary and one descriptive H1.
- Use semantic headings for collections, product specifications, care, story and contact information.
- Keep product names, price, stock label and sale mode consistent with the API response.
- Give story pages a short factual summary and cite approved sources for cultural claims.
- Make contact and business inquiry destinations visible and accurate; omit unknown address, phone and hours.
- Keep locale support in the data model. Do not show an English switch until reviewed English copy exists.

## Media status

Only the supplied logo and the clearly labeled editorial concept SVG are currently in the repository. There is no owner-supplied product photography or video yet. The Agy CLI reports no direct image tool in this session, and its image-generator handoff was blocked by command permission; no realistic raster image was produced. Use the concept illustration as decoration only. Product pages must wait for owner-approved SKU photography and usage rights before publication. See [assets-and-media.md](assets-and-media.md).
