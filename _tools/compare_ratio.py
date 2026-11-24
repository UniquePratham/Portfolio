"""Compare the subject aspect ratio of the OLD (head-crop) and NEW (full-body)
frame sets. A head crop is wide; a full body is narrow. This ratio is the
signal that distinguishes a stale cached frame from a fresh one.
"""
from PIL import Image
import numpy as np
import glob
import os

def ratio(path):
    with Image.open(path) as im:
        a = np.asarray(im.convert('RGBA').split()[-1])
    ys, xs = np.where(a > 128)
    w = xs.max() - xs.min()
    h = ys.max() - ys.min()
    return w / h, w, h

print('OLD (head-crop) frames:')
for p in sorted(glob.glob(r'C:\Users\gargp\Downloads\Portfolio\_shots\old_f*.webp')):
    r, w, h = ratio(p)
    print(f'  {os.path.basename(p)}: {w}x{h} ratio={r:.3f}')

print('NEW (full-body) frames:')
for i in (0, 30, 60, 90, 120):
    p = rf'C:\Users\gargp\Downloads\Portfolio\public\frames\desktop\f{i:04d}.webp'
    r, w, h = ratio(p)
    print(f'  f{i:04d}.webp: {w}x{h} ratio={r:.3f}')
