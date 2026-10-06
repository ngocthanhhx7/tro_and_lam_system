"""Create honest detail/composition variants when the image API is unavailable.

Requires Pillow: python -m pip install Pillow
Run from the repository root: python fondend/scripts/build-concept-derivative-views.py

The outputs are crops/compositions from each SKU's own AI concept hero. They are
not extra camera angles and must stay labeled as concept derivatives.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
PRODUCTS = ROOT / "fondend/public/assets/products/concepts"
SIZE = (896, 1200)

# Normalized (left, top, right, bottom) regions focus the decorated product body.
SKUS = {
    "lifestyle/bo-chen-doc-am": ((0.08, 0.30, 0.92, 0.75), (0.12, 0.28, 0.88, 0.76)),
    "diplomacy/binh-thien-nga": ((0.20, 0.27, 0.82, 0.76), (0.18, 0.25, 0.82, 0.78)),
    "diplomacy/binh-phu-quy": ((0.19, 0.30, 0.82, 0.77), (0.18, 0.26, 0.82, 0.78)),
    "diplomacy/binh-giot-ngoc": ((0.22, 0.29, 0.81, 0.77), (0.18, 0.25, 0.82, 0.78)),
    "diplomacy/binh-hoa-lam": ((0.19, 0.29, 0.82, 0.77), (0.18, 0.25, 0.82, 0.78)),
    "diplomacy/binh-ty-ba": ((0.20, 0.29, 0.82, 0.77), (0.18, 0.25, 0.82, 0.78)),
}


def pixel_box(image, normalized_box):
    width, height = image.size
    return tuple(round(value * dimension) for value, dimension in zip(
        normalized_box, (width, height, width, height)
    ))


def rounded(image, radius=10):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *image.size), radius=radius, fill=255)
    result = image.convert("RGBA")
    result.putalpha(mask)
    return result


def make_detail(hero, box):
    crop = hero.crop(pixel_box(hero, box))
    return ImageOps.fit(crop, SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def make_composition(hero, detail):
    canvas = Image.new("RGB", SIZE, "#f3efe8")
    photo = ImageOps.contain(hero, (710, 930), method=Image.Resampling.LANCZOS)
    x, y = 38, 45

    # Soft shadow behind the hero photograph.
    shadow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", photo.size, (37, 31, 25, 62))
    shadow_layer = rounded(shadow_layer, 12).filter(ImageFilter.GaussianBlur(14))
    shadow.alpha_composite(shadow_layer, (x + 8, y + 12))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)
    canvas.alpha_composite(rounded(photo, 10), (x, y))

    # A clean detail inset makes the glaze pattern inspectable without claiming
    # a different physical angle or inventing a second product photograph.
    inset_size = (350, 350)
    inset = ImageOps.fit(detail, inset_size, method=Image.Resampling.LANCZOS)
    inset_x, inset_y = SIZE[0] - inset_size[0] - 38, SIZE[1] - inset_size[1] - 55
    inset_shadow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    shade = Image.new("RGBA", inset_size, (37, 31, 25, 75))
    shade = rounded(shade, 12).filter(ImageFilter.GaussianBlur(10))
    inset_shadow.alpha_composite(shade, (inset_x + 5, inset_y + 7))
    canvas = Image.alpha_composite(canvas, inset_shadow)
    canvas.alpha_composite(rounded(inset, 10), (inset_x, inset_y))
    return canvas.convert("RGB")


def main():
    generated = []
    for slug, (detail_box, composition_box) in SKUS.items():
        folder = PRODUCTS / slug.rsplit("/", 1)[0]
        product_slug = slug.rsplit("/", 1)[1]
        hero_path = folder / f"{product_slug}-01-front.jpg"
        if not hero_path.is_file():
            raise FileNotFoundError(hero_path)

        hero = Image.open(hero_path).convert("RGB")
        detail = make_detail(hero, detail_box)
        detail_path = folder / f"{product_slug}-02-detail.jpg"
        if not detail_path.exists():
            detail.save(detail_path, quality=91, optimize=True)
            generated.append(detail_path)

        composition_path = folder / f"{product_slug}-03-composition.jpg"
        if not composition_path.exists():
            make_composition(hero, detail).save(composition_path, quality=91, optimize=True)
            generated.append(composition_path)

    for path in generated:
        print(path.relative_to(ROOT).as_posix())
    print(f"Created {len(generated)} derivative image files.")


if __name__ == "__main__":
    main()
