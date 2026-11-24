"""Measure head width and head centre-x across all 121 full-body frames.

The head is the perceptual anchor: if its width/centre are stable, a fixed
crop keeps the figure constant between frames. 4x downscale for speed.
"""
from PIL import Image
import numpy as np
import glob
import os

SRC = r'C:\Users\gargp\Downloads\Portfolio\_frames_src\processed_frames'
HEAD_BAND = 0.15  # head is ~1/7 of a full-body figure; 15% is a safe band

files = sorted(glob.glob(os.path.join(SRC, '*.png')))
assert len(files) == 121, f'expected 121, found {len(files)}'

head_ws, head_cxs, subj_cxs = [], [], []
for f in files:
    with Image.open(f) as im:
        rgba = im.convert('RGBA').resize((im.width // 4, im.height // 4), Image.LANCZOS)
    a = np.asarray(rgba.split()[-1])
    ys, xs = np.where(a > 128)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    head_bottom = y0 + max(1, int((y1 - y0) * HEAD_BAND))
    hcols = np.where(a[y0:head_bottom, :].max(axis=0) > 12)[0]
    head_w = (hcols[-1] - hcols[0]) * 4
    head_cx = (hcols[0] + hcols[-1]) / 2 * 4
    subj_cx = (x0 + x1) / 2
    head_ws.append(head_w)
    head_cxs.append(head_cx)
    subj_cxs.append(subj_cx)

head_ws = np.array(head_ws)
head_cxs = np.array(head_cxs)
subj_cxs = np.array(subj_cxs)
print(f'head width:  min={head_ws.min():.0f} max={head_ws.max():.0f} '
      f'spread={(head_ws.max() - head_ws.min()) / head_ws.min() * 100:.1f}%')
print(f'head centre: min={head_cxs.min():.0f} max={head_cxs.max():.0f} '
      f'spread={head_cxs.max() - head_cxs.min():.0f}px (frame w=5072)')
print(f'subj centre: min={subj_cxs.min():.0f} max={subj_cxs.max():.0f} '
      f'spread={subj_cxs.max() - subj_cxs.min():.0f}px')
print(f'frame centre x = 2536')
