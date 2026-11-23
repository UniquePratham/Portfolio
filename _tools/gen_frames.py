"""Regenerate both frame tiers with the subject scale normalised.

The source footage is a moving camera: the subject's alpha bounding box varies
from 1472 px to 2298 px tall across the sequence, a 56% swing. Painting those
frames at a fixed canvas size makes the portrait visibly grow and shrink as you
scroll.

This script measures each frame's subject box, then scales and re-centres every
frame so the subject occupies a constant height and a constant horizontal
centre. The pose still changes; only the scale is held steady.
"""
from PIL import Image
import os
import glob

SRC = r'C:\Users\gargp\Downloads\Portfolio\_srcframes'
OUT = r'C:\Users\gargp\Downloads\Portfolio\public\frames'

OUT_W, OUT_H = 1554, 1000
SUBJECT_H = 940          # constant subject height in the output
SUBJECT_CENTRE_X = 0.5   # horizontal centre, as a fraction of OUT_W
SUBJECT_BOTTOM = 0.99    # subject's feet sit just above the bottom edge

TIERS = {
    'desktop': dict(size=(OUT_W, OUT_H), quality=78),
    'mobile': dict(size=(732, 1000), quality=76),
}

files = sorted(glob.glob(os.path.join(SRC, '*.webp')))
assert len(files) == 121, f'expected 121 source frames, found {len(files)}'

# Pass 1: measure every subject box.
boxes = []
for f in files:
    with Image.open(f) as im:
        boxes.append(im.convert('RGBA').split()[-1].getbbox())

missing = [i for i, b in enumerate(boxes) if b is None]
if missing:
    raise SystemExit(f'frames with no opaque pixels: {missing}')

for tier, cfg in TIERS.items():
    out_dir = os.path.join(OUT, tier)
    os.makedirs(out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(out_dir, '*.webp')):
        os.remove(old)

    out_w, out_h = cfg['size']
    total = 0

    for i, (f, box) in enumerate(zip(files, boxes)):
        with Image.open(f) as im:
            frame = im.convert('RGBA')

        subject = frame.crop(box)
        sw, sh = subject.size

        # Scale so the subject is exactly SUBJECT_H tall in the output.
        scale = SUBJECT_H / sh
        new_w = max(1, round(sw * scale))
        new_h = max(1, round(sh * scale))
        subject = subject.resize((new_w, new_h), Image.LANCZOS)

        canvas = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))

        px = round(out_w * SUBJECT_CENTRE_X - new_w / 2)
        py = round(out_h * SUBJECT_BOTTOM - new_h)

        # If the subject is wider than the canvas, crop it symmetrically.
        if new_w > out_w:
            overflow = (new_w - out_w) // 2
            subject = subject.crop((overflow, 0, overflow + out_w, new_h))
            new_w = out_w
            px = 0

        canvas.paste(subject, (px, py), subject)

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

print('all frames normalised and validated')
