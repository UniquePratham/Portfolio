"""Turn the photographed signature into a clean, uniform transparent PNG.

The source is a phone photo: grey paper, uneven lighting, a blue-black ink
stroke. For a "signing" animation the ink must be isolated so it can be drawn
progressively over the page background.

A GLOBAL luminance threshold does not work here: the paper is brighter on the
left of the frame, so the "P" gets a wide soft halo while the rest of the
signature is crisp. Measured soft/solid ratio per band: 8.06 on the P against
~0.31 elsewhere — that halo is the "splash" that looks wrong.

The fix is a LOCAL threshold: divide out the paper's illumination with a large
blur, then threshold the ratio. Ink is then equally dark relative to its own
neighbourhood everywhere, so the stroke has the same weight across the frame.
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

    if rgb.width > 1200:
        scale = 1200 / rgb.width
        rgb = rgb.resize((1200, round(rgb.height * scale)), Image.LANCZOS)

    a = np.asarray(rgb).astype(np.float32)
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

    # Estimate the paper's illumination with a large blur. The blur radius must
    # be much wider than the stroke, so the stroke itself does not bias the
    # local paper level.
    paper_img = Image.fromarray(lum.astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(60))
    paper = np.asarray(paper_img).astype(np.float32)
    paper = np.maximum(paper, 1.0)

    # Ratio of local luminance to local paper level: 1.0 on blank paper, well
    # below 1 on ink. This is illumination-invariant.
    ratio = lum / paper
    print(f'ratio: paper(p90)={np.percentile(ratio, 90):.3f} '
          f'ink(p2)={np.percentile(ratio, 2):.3f}')

    # A tight ramp around the ink level gives every stroke the same weight.
    hi = 0.86
    lo = 0.58
    alpha = np.clip((hi - ratio) / (hi - lo), 0, 1)

    # Drop paper grain: anything below 15% is noise, not ink.
    alpha[alpha < 0.15] = 0

    mask = Image.fromarray((alpha * 255).astype(np.uint8), 'L')
    # A light blur removes JPEG blocking without softening the stroke.
    mask = mask.filter(ImageFilter.GaussianBlur(0.5))

    bbox = mask.getbbox()
    if bbox is None:
        raise SystemExit('no ink found — threshold is wrong')
    mask = mask.crop(bbox)
    print('trimmed to:', mask.size)

    out = Image.new('RGBA', mask.size, (255, 255, 255, 0))
    out.putalpha(mask)
    out.save(OUT, 'PNG', optimize=True)

    size = os.path.getsize(OUT)
    print(f'wrote {OUT}  {mask.size[0]}x{mask.size[1]}  {size / 1024:.1f} KB')
    if size == 0:
        raise SystemExit('EMPTY OUTPUT')
