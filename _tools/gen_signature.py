"""Turn the photographed signature into a clean transparent PNG.

The source is a phone photo: grey paper, uneven lighting, a blue-black ink
stroke. For a "signing" animation the ink must be isolated so it can be drawn
progressively over the page background.

Approach: the ink is the darkest thing in the frame, so a luminance threshold
separates it from the paper. The result is then trimmed to its bounding box and
saved as a white-on-transparent mask, which CSS can tint with `currentColor`.
"""
from PIL import Image, ImageFilter
import numpy as np
import os

ROOT = r'C:\Users\gargp\Downloads\Portfolio'
SRC = os.path.join(ROOT, 'Signature.jpg')
OUT = os.path.join(ROOT, 'public', 'signature.png')

with Image.open(SRC) as im:
    rgb = im.convert('RGB')
    print('source:', im.size, im.mode)

    # Work at a sane size: the animation never needs more than ~1200px wide.
    if rgb.width > 1200:
        scale = 1200 / rgb.width
        rgb = rgb.resize((1200, round(rgb.height * scale)), Image.LANCZOS)

    a = np.asarray(rgb).astype(np.float32)
    # Rec. 709 luminance.
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

    # The paper is the bright majority; the ink is the dark tail. Use a
    # percentile so the threshold adapts to exposure instead of a magic number.
    paper = np.percentile(lum, 90)
    ink = np.percentile(lum, 2)
    print(f'luminance: paper(p90)={paper:.0f} ink(p2)={ink:.0f}')

    # Alpha ramps from 0 at the paper level to 1 at the ink level. A soft ramp
    # keeps the stroke's antialiasing instead of producing a jagged mask.
    lo = ink + (paper - ink) * 0.55
    hi = ink + (paper - ink) * 0.92
    alpha = np.clip((hi - lum) / max(hi - lo, 1e-6), 0, 1)

    # Drop the faint paper grain: anything below 12% is noise, not ink.
    alpha[alpha < 0.12] = 0

    mask = Image.fromarray((alpha * 255).astype(np.uint8), 'L')
    # A light blur removes JPEG blocking without softening the stroke.
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))

    bbox = mask.getbbox()
    if bbox is None:
        raise SystemExit('no ink found — threshold is wrong')
    mask = mask.crop(bbox)
    print('trimmed to:', mask.size)

    # White ink on transparent, so CSS can tint it with `currentColor`.
    out = Image.new('RGBA', mask.size, (255, 255, 255, 0))
    out.putalpha(mask)
    out.save(OUT, 'PNG', optimize=True)

    size = os.path.getsize(OUT)
    print(f'wrote {OUT}  {mask.size[0]}x{mask.size[1]}  {size / 1024:.1f} KB')
    if size == 0:
        raise SystemExit('EMPTY OUTPUT')
