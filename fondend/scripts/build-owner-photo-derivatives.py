"""Create disclosed detail crops from owner-supplied product photos.

Requires Pillow: python -m pip install Pillow
Run from the repository root: python fondend/scripts/build-owner-photo-derivatives.py

Each output is cropped directly from its listed source photo. These are detail
crops, not additional camera angles or generated depictions of product stock.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "fondend/public/assets/products"
OWNER = ASSETS / "owner-provided"
DERIVED = ASSETS / "derived"

# (output filename, source filename, normalized left/top/right/bottom crop)
CROPS = (
    ("hu-tra-02-lid-and-motif.webp", "hu-tra-chim-lac.webp", (0.18, 0.20, 0.82, 0.59)),
    ("hu-tra-03-motif-detail.webp", "hu-tra-chim-lac.webp", (0.16, 0.31, 0.84, 0.62)),
    ("bo-chen-02-teapot-detail.webp", "bo-chen-doc-am.webp", (0.40, 0.24, 0.84, 0.82)),
    ("bo-chen-03-cup-detail.webp", "bo-chen-doc-am.webp", (0.02, 0.53, 0.34, 0.97)),
    ("binh-thien-nga-03-motif-detail.webp", "binh-thien-nga-01.webp", (0.20, 0.31, 0.81, 0.70)),
    ("binh-phu-quy-02-neck-detail.webp", "binh-phu-quy.webp", (0.21, 0.08, 0.79, 0.48)),
    ("binh-phu-quy-03-motif-detail.webp", "binh-phu-quy.webp", (0.18, 0.34, 0.83, 0.73)),
    ("binh-hoa-lam-02-vase-crop.webp", "hoa-lam-ty-ba-pair.webp", (0.51, 0.17, 0.99, 0.91)),
    ("binh-hoa-lam-03-motif-detail.webp", "hoa-lam-ty-ba-pair.webp", (0.59, 0.32, 0.94, 0.66)),
    ("binh-ty-ba-02-vase-crop.webp", "hoa-lam-ty-ba-pair.webp", (0.02, 0.08, 0.52, 0.96)),
    ("binh-ty-ba-03-motif-detail.webp", "hoa-lam-ty-ba-pair.webp", (0.13, 0.29, 0.48, 0.70)),
)


def pixel_box(image, normalized_box):
    width, height = image.size
    left, top, right, bottom = normalized_box
    box = (
        round(left * width), round(top * height),
        round(right * width), round(bottom * height),
    )
    if box[2] - box[0] < 200 or box[3] - box[1] < 200:
        raise ValueError(f"Crop is too small: {normalized_box}")
    return box


def main():
    DERIVED.mkdir(parents=True, exist_ok=True)
    for output_name, source_name, normalized_box in CROPS:
        source_path = OWNER / source_name
        if not source_path.is_file():
            raise FileNotFoundError(source_path)
        with Image.open(source_path) as source:
            crop = source.convert("RGB").crop(pixel_box(source, normalized_box))
        output_path = DERIVED / output_name
        crop.save(output_path, format="WEBP", quality=88, method=6)
        print(f"{output_path.relative_to(ROOT).as_posix()} {crop.width}x{crop.height}")


if __name__ == "__main__":
    main()
