"""Regenerate the portrait frame tiers from the full-body source.

The previous tiers were generated from a head-and-shoulders crop, so the
deployed site never showed the full body. The new source
(_frames_src/processed_frames, 121 x 5072x6528 RGBA, transparent background)
is the full-body video.

Measured facts that make a FIXED crop safe:
  * subject height varies only 1.0% across frames  -> no per-frame scaling
  * subject centre-x varies only 28px (of 5072)    -> one crop centre works
  * feet sit 76-80px above the frame bottom         -> bottom-anchored output

Crop: bottom edge at the feet (y=6452, the deepest feet position across all
frames), width = 6452 * 0.75 = 4839, centred on the subject's centre-x (2480).
The subject's max width (2136) fits with ~1350px of margin on each side, so
no frame clips the arms. Feet land on the output's bottom edge: no gap.
"""
from PIL import Image
import numpy as np
import glob
import os

SRC = r'C:\Users\gargp\Downloads\Portfolio\_frames_src\processed_frames'
OUT = r'C:\Users\gargp\Downloads\Portfolio\public\frames'

CROP_H = 6452          # deepest feet position (bottom gap min=76 of 6528)
CROP_W = 4839          # 6452 * 0.75
CROP_CX = 2480         # measured subject centre-x (full-res)
CROP_X0 = CROP_CX - CROP_W // 2   # 61

TIERS = {
    'desktop': dict(size=(900, 1200), quality=80),
    'mobile': dict(size=(720, 960), quality=78),
}

files = sorted(glob.glob(os.path.join(SRC, '*.png')))
assert len(files) == 121, f'expected 121 source frames, found {len(files)}'

for tier, cfg in TIERS.items():
    out_dir = os.path.join(OUT, tier)
    os.makedirs(out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(out_dir, '*.webp')):
        os.remove(old)

    out_w, out_h = cfg['size']
    total = 0
    for i, f in enumerate(files):
        with Image.open(f) as im:
            frame = im.convert('RGBA')
        assert frame.size == (5072, 6528), f'{f} is {frame.size}'
        crop = frame.crop((CROP_X0, 0, CROP_X0 + CROP_W, 6528))
        out = crop.resize((out_w, out_h), Image.LANCZOS)

        path = os.path.join(out_dir, f'f{i:04d}.webp')
        out.save(path, 'WEBP', quality=cfg['quality'], method=6)

        # Validate: non-empty, right size, subject fully inside, feet near bottom.
        size = os.path.getsize(path)
        assert size > 0, f'EMPTY OUTPUT: {path}'
        with Image.open(path) as check:
            check.load()
            assert check.size == (out_w, out_h), f'WRONG SIZE: {path}'
            a = np.asarray(check.convert('RGBA').split()[-1])
            ys, xs = np.where(a > 128)
            assert len(ys) > 0, f'NO SUBJECT: {path}'
            top, bottom = int(ys.min()), int(ys.max())
            left, right = int(xs.min()), int(xs.max())
            assert left >= 0 and right < out_w, f'SUBJECT CLIPPED H: {path}'
            assert top >= 0, f'SUBJECT CLIPPED TOP: {path}'
            gap = out_h - 1 - bottom
            assert 0 <= gap <= out_h * 0.05, f'FEET NOT AT BOTTOM: {path} gap={gap}'
        total += size

    print(f'{tier}: {out_w}x{out_h}  {len(files)} frames  {total / 1024 / 1024:.2f} MB')

print('full-body frames generated and validated')
