"""Draws the app icons and the iPhone launch screens from code (no text in the icons).

The mark is the house from the app's logo (index.html, 24-unit viewBox), in ink on Be yellow. Shapes are drawn
at 4x and scaled down, so edges stay crisp at every size.

    python3 tools/make-icons.py /path/to/BeVietnamPro-Bold.ttf

The font is only needed for the launch screens' "beHome TrustCycle" line; download it from Google Fonts into a
temporary folder (it is not part of the repository).
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'img'
YELLOW = (0xFF, 0xC9, 0x05)
INK = (0x1C, 0x1D, 0x21)
SS = 4  # supersampling


def arc(cx, cy, r, a0, a1, n=8):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


# The logo path: M12 3.2l9 7.4v.9h-2V20a1 1 0 01-1 1h-4v-6h-4v6H6a1 1 0 01-1-1v-8.5H3v-.9z
HOUSE = [(12, 3.2), (21, 10.6), (21, 11.5), (19, 11.5), (19, 20), *arc(18, 20, 1, 0, 90)[1:], (14, 21), (14, 15), (10, 15), (10, 21), (6, 21),
         *arc(6, 20, 1, 90, 180)[1:], (5, 11.5), (3, 11.5), (3, 10.6)]
X0, X1, Y0, Y1 = 3, 21, 3.2, 21


def draw_house(d, cx, cy, width, color=INK):
    """The house, `width` px wide, centred on (cx, cy) (all in supersampled px)."""
    k = width / (X1 - X0)
    ox = cx - (X0 + X1) / 2 * k
    oy = cy - (Y0 + Y1) / 2 * k
    d.polygon([(ox + x * k, oy + y * k) for x, y in HOUSE], fill=color)


def icon(size, *, rounded, mark):
    """Be-yellow square (rounded corners, or full bleed for iOS and maskable) with the house `mark` x size wide."""
    s = size * SS
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=round(s * 0.225), fill=YELLOW)
    else:
        d.rectangle([0, 0, s, s], fill=YELLOW)
    draw_house(d, s / 2, s / 2, s * mark)
    im = im.resize((size, size), Image.LANCZOS)
    return im if rounded else im.convert('RGB')


def splash(w, h, font_path):
    s = Image.new('RGB', (w * 2, h * 2), YELLOW)   # 2x is plenty for flat shapes at these sizes
    d = ImageDraw.Draw(s)
    W, H = w * 2, h * 2
    tile = W * 0.26
    cy = H * 0.46
    # An ink tile holding the yellow house: the logo chip from the app's panel, inverted for the yellow ground.
    d.rounded_rectangle([W / 2 - tile / 2, cy - tile / 2, W / 2 + tile / 2, cy + tile / 2], radius=tile * 0.24, fill=INK)
    draw_house(d, W / 2, cy, tile * 0.56, color=YELLOW)
    font = ImageFont.truetype(font_path, round(W * 0.064))
    text = 'beHome TrustCycle'
    tw = d.textlength(text, font=font)
    d.text(((W - tw) / 2, cy + tile / 2 + W * 0.07), text, font=font, fill=INK)
    return s.resize((w, h), Image.LANCZOS)


# iPhone launch screens: pixel size and the media query that picks it.
SPLASH = [
    (750, 1334, 375, 667, 2),     # iPhone SE, 8
    (828, 1792, 414, 896, 2),     # iPhone 11, XR
    (1170, 2532, 390, 844, 3),    # iPhone 12 to 14
    (1179, 2556, 393, 852, 3),    # iPhone 14 Pro to 16
    (1206, 2622, 402, 874, 3),    # iPhone 16 Pro
    (1284, 2778, 428, 926, 3),    # iPhone 12 to 13 Pro Max, 14 Plus
    (1290, 2796, 430, 932, 3),    # iPhone 14 Pro Max to 16 Plus
    (1320, 2868, 440, 956, 3),    # iPhone 16 Pro Max
]

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    icon(180, rounded=False, mark=0.56).save(IMG / 'apple-touch-icon.png', optimize=True)   # iOS rounds it
    icon(192, rounded=True, mark=0.54).save(IMG / 'icon-192.png', optimize=True)
    icon(512, rounded=True, mark=0.54).save(IMG / 'icon-512.png', optimize=True)
    icon(512, rounded=False, mark=0.42).save(IMG / 'icon-maskable-512.png', optimize=True)  # inside the 80% safe circle
    out = IMG / 'splash'
    out.mkdir(exist_ok=True)
    for w, h, *_ in SPLASH:
        splash(w, h, sys.argv[1]).save(out / f'splash-{w}x{h}.png', optimize=True)
    for w, h, dw, dh, r in SPLASH:
        print(f'<link rel="apple-touch-startup-image" href="img/splash/splash-{w}x{h}.png" media="(device-width: {dw}px) and (device-height: {dh}px) and (-webkit-device-pixel-ratio: {r}) and (orientation: portrait)">')
