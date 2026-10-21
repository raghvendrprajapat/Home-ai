"""D82: derive four original finishes from the app's recorded CC0 inputs; no network.

Run: python3 -I tools/textures/derive_variants.py [--check]
Needs Pillow, like prepare_textures.py. Only the four NEW colour files are written.
Existing JPEGs/normals/roughness/HDRI are never changed. --check compares bytes without writing.
"""
import hashlib
import io
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
TEXTURES = ROOT / "apps/web/public/textures"
# Baseline recorded source hashes (D76), not inferred from newly generated output.
INPUTS = {
    "wood_oak": "c6328303484b3179ec8b6802b8dec77011be404d030e591b97cf57edb3be530b",
    "tile_vitrified_600": "89d330c0551c5252e37df97fa30986906b9857ff620ffe0ac9e4422eb670b244",
    "marble_white": "99cacbd3a29135f210d8b4eef3cd4196d6960af1481c7751dc59bea17df9d185",
    "plaster": "6e30b27b557bcc36c0a7b2e7bcbd5bbb1ab98b310a296de771b9809ade16186a",
}

def source(name):
    path = TEXTURES / name / "color.jpg"
    if hashlib.sha256(path.read_bytes()).hexdigest() != INPUTS[name]:
        raise SystemExit(f"CC0 input hash changed: {name}")
    return Image.open(path).convert("RGB")

def jpeg(image):
    out = io.BytesIO()
    image.save(out, "JPEG", quality=85, optimize=True, progressive=False)
    return out.getvalue()

def outputs():
    walnut = ImageOps.colorize(ImageOps.grayscale(source("wood_oak")), (28, 17, 11), (151, 107, 69))
    terracotta = ImageOps.colorize(ImageOps.grayscale(source("tile_vitrified_600")), (109, 45, 29), (198, 123, 83))
    charcoal = ImageOps.colorize(ImageOps.invert(ImageOps.grayscale(source("marble_white"))), (32, 35, 37), (155, 159, 160))
    linen = ImageOps.colorize(ImageOps.grayscale(source("plaster")), (195, 184, 162), (244, 236, 219))
    draw = ImageDraw.Draw(linen)
    # Eight narrow pinstripes per 1200 mm repeat = 150 mm between stripes.
    for x in range(64, 1024, 128):
        draw.line((x, 0, x, 1023), fill=(179, 181, 163), width=3)
        draw.line((x + 7, 0, x + 7, 1023), fill=(213, 207, 185), width=2)
    return {"wood_walnut": walnut, "tile_terracotta_600": terracotta, "marble_charcoal": charcoal, "wallpaper_linen": linen}

def main():
    check = "--check" in sys.argv[1:]
    for name, image in outputs().items():
        path = TEXTURES / name / "color.jpg"
        data = jpeg(image)
        if check:
            if not path.exists() or path.read_bytes() != data:
                raise SystemExit(f"stale derived texture: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists() and path.read_bytes() != data:
                raise SystemExit(f"existing derived texture differs; use a new texture id: {path.relative_to(ROOT)}")
            if not path.exists():
                path.write_bytes(data)
        print(f"{name}: {len(data)} bytes, sha256={hashlib.sha256(data).hexdigest()}")

if __name__ == "__main__":
    main()
