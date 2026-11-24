"""Regenerate both frame tiers, normalised on the subject's head.

The source footage is a moving camera and a moving subject. Two things vary:

  * the full silhouette, because the arms move (2150-2606 px wide, a 21% swing)
  * the camera distance, which changes the subject's overall scale

Normalising on the full silhouette fails: the arms dominate the bounding box, so
a frame with arms out gets scaled down and the figure appears to shrink. The head
is the stable anatomical anchor — its width varies only 836-864 px (3%) across
the sequence.

So each frame is scaled so the *head* is a constant width, then positioned so the
head sits at a constant point on the canvas. The pose still changes; the figure's
apparent size does not.
"""
from PIL import Image
import numpy as np
import os
import glob

SRC = r'C:\Users\gargp\Downloads\Portfolio\_srcframes'
OUT = r'C:\Users\gargp\Downloads\Portfolio\public\frames'

OUT_W, OUT_H = 1554, 1000

# Target head width in the output, and where the head's centre sits.
HEAD_W = 300
HEAD_CENTRE_X = 0.5     # fraction of OUT_W
HEAD_TOP_Y = 0.06       # fraction of OUT_H

# The head occupies the top fraction of the subject's bounding box.
HEAD_BAND = 0.22

TIERS = {
    'desktop': dict(size=(OUT_W, OUT_H), quality=78),
    'mobile': dict(size=(732, 1000), quality=76),
}

files = sorted(glob.glob(os.path.join(SRC, '*.webp')))
assert len(files) == 121, f'expected 121 source frames, found {len(files)}'


def measure(path):
    """Return (bbox, head_left, head_right, head_top) for one frame."""
    with Image.open(path) as im:
        rgba = im.convert('RGBA')
    alpha = np.asarray(rgba.split()[-1])
    bbox = rgba.split()[-1].getbbox()
    if bbox is None:
        raise SystemExit(f'no opaque pixels in {path}')

    x0, y0, x1, y1 = bbox
    head_bottom = y0 + max(1, int((y1 - y0) * HEAD_BAND))
    band = alpha[y0:head_bottom, :]
    cols = np.where(band.max(axis=0) > 12)[0]
    if len(cols) == 0:
        raise SystemExit(f'no head pixels in {path}')

    return bbox, int(cols[0]), int(cols[-1]), y0


# Pass 1: measure every frame.
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

        # Scale so the head is HEAD_W wide in the output.
        scale = HEAD_W / head_w
        new_w = max(1, round(frame.width * scale))
        new_h = max(1, round(frame.height * scale))
        scaled = frame.resize((new_w, new_h), Image.LANCZOS)

        canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))

        # Place the head's centre at HEAD_CENTRE_X and its top at HEAD_TOP_Y.
        head_centre_src = (head_l + head_r) / 2
        px = round(out_w * HEAD_CENTRE_X - head_centre_src * scale)
        py = round(out_h * HEAD_TOP_Y - head_top * scale)

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

print('all frames normalised on head width and validated')
