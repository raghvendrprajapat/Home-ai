"""D76 M1: build the app's surface textures from CC0 ambientCG sources (offline tool; needs Pillow).

Usage: python3 -I tools/textures/prepare_textures.py <download-dir> <repo-root>
<download-dir>/<AssetId>/ holds the unzipped ambientCG "1K-JPG" package of each source below. Outputs go to
apps/web/public/textures/<set>/ (color 1024 px, normal/roughness 512 px, JPEG). Run it, then update
docs/assets/texture-rights.json with `node tools/textures/rights.mjs` and review the result.
"""
import random, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageOps

SRC, ROOT = Path(sys.argv[1]), Path(sys.argv[2])
OUT = ROOT / 'apps/web/public/textures'

def src(asset, kind):
    return Image.open(SRC / asset / f'{asset}_1K-JPG_{kind}.jpg')

def save(img, path, quality):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'JPEG', quality=quality, optimize=True, progressive=False)

def plain(asset, name):
    """A direct copy of an ambientCG set: colour 1024 px, normal (OpenGL) and roughness 512 px."""
    save(src(asset, 'Color').convert('RGB').resize((1024, 1024), Image.LANCZOS), OUT / name / 'color.jpg', 82)
    save(src(asset, 'NormalGL').convert('RGB').resize((512, 512), Image.LANCZOS), OUT / name / 'normal.jpg', 88)
    save(src(asset, 'Roughness').convert('L').resize((512, 512), Image.LANCZOS), OUT / name / 'roughness.jpg', 88)

def plaster(asset, name):
    """Wall paint detail: a near-white greyscale (mean about 0.96) multiplied with the paint colour in the shader."""
    grey = ImageOps.grayscale(src(asset, 'Color')).resize((1024, 1024), Image.LANCZOS)
    mean = sum(i * c for i, c in enumerate(grey.histogram())) / (1024 * 1024)
    detail = grey.point(lambda v: max(0, min(255, round(245 + (v - mean) * 0.9))))
    save(detail.convert('RGB'), OUT / name / 'color.jpg', 85)
    save(src(asset, 'NormalGL').convert('RGB').resize((512, 512), Image.LANCZOS), OUT / name / 'normal.jpg', 88)

def vitrified(asset, name):
    """600x600 mm vitrified tiles: 2x2 tiles (1200 mm) cut from a light marble, ivory tint, 3 px grout."""
    marble = src(asset, 'Color').convert('RGB')
    rng = random.Random(600)
    tile_px, grout = 512, 3
    color = Image.new('RGB', (1024, 1024), (214, 208, 198))
    height = Image.new('L', (1024, 1024), 0)
    for ty in range(2):
        for tx in range(2):
            x0, y0 = rng.randrange(0, 1024 - 600), rng.randrange(0, 1024 - 600)
            piece = marble.crop((x0, y0, x0 + 600, y0 + 600)).resize((tile_px - grout, tile_px - grout), Image.LANCZOS)
            piece = ImageChops.multiply(ImageOps.autocontrast(piece, cutoff=1), Image.new('RGB', piece.size, (240, 233, 222)))
            piece = Image.blend(piece, Image.new('RGB', piece.size, (238, 233, 224)), 0.72)
            color.paste(piece, (tx * tile_px + grout // 2 + 1, ty * tile_px + grout // 2 + 1))
            height.paste(255, (tx * tile_px + grout // 2 + 1, ty * tile_px + grout // 2 + 1, (tx + 1) * tile_px - grout // 2, (ty + 1) * tile_px - grout // 2))
    save(color, OUT / name / 'color.jpg', 85)
    h = height.filter(ImageFilter.GaussianBlur(1.2)).resize((512, 512), Image.LANCZOS)
    w, hgt = h.size
    px = h.load()
    normal = Image.new('RGB', (w, hgt))
    out = normal.load()
    for y in range(hgt):
        for x in range(w):
            dx = (px[(x + 1) % w, y] - px[(x - 1) % w, y]) / 255.0 * 2.0
            dy = (px[x, (y + 1) % hgt] - px[x, (y - 1) % hgt]) / 255.0 * 2.0
            nx, ny, nz = -dx, dy, 1.0  # OpenGL convention (green up)
            length = (nx * nx + ny * ny + nz * nz) ** 0.5
            out[x, y] = tuple(round((c / length * 0.5 + 0.5) * 255) for c in (nx, ny, nz))
    save(normal, OUT / name / 'normal.jpg', 90)
    save(h.point(lambda v: round(217 - (217 - 46) * v / 255)).convert('L'), OUT / name / 'roughness.jpg', 90)

plain('WoodFloor051', 'wood_oak')
vitrified('Marble012', 'tile_vitrified_600')
plain('Marble012', 'marble_white')
# A warmer, lighter white marble than the bluish grey source.
_m = Image.open(OUT / 'marble_white/color.jpg').convert('RGB')
save(Image.blend(ImageChops.multiply(_m, Image.new('RGB', _m.size, (255, 250, 242))), Image.new('RGB', _m.size, (240, 238, 234)), 0.4), OUT / 'marble_white/color.jpg', 85)
plaster('PaintedPlaster017', 'plaster')
print('ok')
