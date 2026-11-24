"""Generate portrait frames that fill their box, anchored to the bottom.

The previous output was a 1554x1000 landscape frame. The canvas it is painted
into is portrait (roughly 600x730), so a `min` fit shrank the frame to fit the
width and the subject occupied only ~40% of the box height, with dead space
above. That is the "small" the portrait kept falling into.

This script produces a **portrait** frame whose aspect matches the canvas, with
the subject scaled to fill it and its feet pinned to the bottom edge. Painting
it with a `cover` fit then fills the box exactly, at every viewport.

Normalisation is on the head width, not the silhouette: the arms move, so the
silhouette swings ~21% while the head varies ~3%.
"""
from PIL import Image
import numpy as np
import os
import glob

SRC = r'C:\Users\gargp\Downloads\Portfolio\_srcframes'
OUT = r'C:\Users\gargp\Downloads\Portfolio\public\frames'

# Portrait output. 3:4 matches the canvas box closely enough that a cover fit
# crops almost nothing.
OUT_W, OUT_H = 900, 1200

HEAD_W = 250            # constant head width in the output
HEAD_CENTRE_X = 0.5     # fraction of OUT_W
HEAD_TOP_Y = 0.045      # fraction of OUT_H
HEAD_BAND = 0.22        # head occupies the top fraction of the subject bbox

# The subject must reach the bottom edge. After placing the head, the frame is
# scaled up so the subject's feet land on the bottom; this factor is the target
# subject height as a fraction of the output height.
SUBJECT_FILL = 0.97

TIERS = {
    'desktop': dict(size=(OUT_W, OUT_H), quality=80),
    'mobile': dict(size=(720, 960), quality=78),
}

files = sorted(glob.glob(os.path.join(SRC, '*.webp')))
assert len(files) == 121, f'expected 121 source frames, found {len(files)}'


def measure(path):
    with Image.open(path) as im:
        rgba = im.convert('RGBA')
    alpha = np.asarray(rgba.split()[-1])
    bbox = rgba.split()[-1].getbbox()
    if bbox is None:
        raise SystemExit(f'no opaque pixels in {path}')

    x0, y0, x1, y1 = bbox
    head_bottom = y0 + max(1, int((y1 - y0) * HEAD_BAND))
    cols = np.where(alpha[y0:head_bottom, :].max(axis=0) > 12)[0]
    if len(cols) == 0:
        raise SystemExit(f'no head pixels in {path}')

    return bbox, int(cols[0]), int(cols[-1]), y0


measurements = [measure(f) for f in files]

for tier, cfg in TIERS.items():
    out_dir = os.path.join(OUT, tier)
    os.makedirs(out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(out_dir, '*.webp')):
        os.remove(old)

    out_w, out_h = cfg['size']
    total = 0

    for i, (f, (bbox, head_l, head_r, head_top)) in enumerate(zip(files, measurements)):
        with Image.open(f) as im:
            frame = im.convert('RGBA')

        head_w = head_r - head_l
        if head_w <= 0:
            raise SystemExit(f'degenerate head width in {f}')

        # Two constraints: the head must be a constant width (so the figure does
        # not change size between frames), and the subject must reach the bottom
        # edge (so there is no dead space under the feet). Take whichever scale
        # is larger, then verify the head width stays within tolerance.
        subject_h = bbox[3] - bbox[1]
        scale_head = HEAD_W / head_w
        scale_fill = (out_h * SUBJECT_FILL) / subject_h
        scale = max(scale_head, scale_fill)

        new_w = max(1, round(frame.width * scale))
        new_h = max(1, round(frame.height * scale))
        scaled = frame.resize((new_w, new_h), Image.LANCZOS)

        canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))

        head_centre_src = (head_l + head_r) / 2
        px = round(out_w * HEAD_CENTRE_X - head_centre_src * scale)
        # Pin the subject's feet to the bottom edge.
        py = round(out_h - bbox[3] * scale)

        canvas.paste(scaled, (px, py), scaled)

        path = os.path.join(out_dir, f'f{i:04d}.webp')
        canvas.save(path, 'WEBP', quality=cfg['quality'], method=6)

        size = os.path.getsize(path)
        if size == 0:
            raise SystemExit(f'EMPTY OUTPUT: {path}')
        with Image.open(path) as check:
            check.load()
            if check.size != (out_w, out_h):
                raise SystemExit(f'WRONG SIZE: {path} is {check.size}')
        total += size

    print(f'{tier}: {out_w}x{out_h}  {len(files)} frames  {total / 1024 / 1024:.2f} MB')

print('portrait frames generated and validated')
