"""Trace the signature's ink into the pen's travel path, covering every stroke.

A single longest-path walk covers only ~60% of the ink: a signature is not one
continuous line, it has separate strokes (the underline flourish, the letter
bodies). The missing 40% is why letters were absent from the animation.

This decomposes the skeleton into strokes and orders them the way a hand would
write them:
  1. dilate the mask so thin spots do not fragment the skeleton
  2. skeletonise to a 1px centreline
  3. split the skeleton at junctions and endpoints into individual strokes
  4. order the strokes left to right, then top to bottom
  5. join them into one polyline, inserting a pen-lift between strokes
  6. simplify with Ramer-Douglas-Peucker

A pen-lift is encoded as a `null` separator in the JSON, so the browser can draw
the ink without a connecting line and lift the pen between strokes.

Outputs:
  src/data/signature-path.json   normalised points, `null` between strokes
  _shots/signature-trace.png     debug overlay, one colour per stroke
"""
from PIL import Image, ImageDraw
import numpy as np
import json
import os
from scipy import ndimage
from skimage.morphology import skeletonize

ROOT = r'C:\Users\gargp\Downloads\Portfolio'
SRC = os.path.join(ROOT, 'public', 'signature.png')
OUT = os.path.join(ROOT, 'src', 'data', 'signature-path.json')
DEBUG = os.path.join(ROOT, '_shots', 'signature-trace.png')

WORK_W = 700

with Image.open(SRC) as im:
    rgba = im.convert('RGBA')
    scale = WORK_W / rgba.width
    work = rgba.resize((WORK_W, round(rgba.height * scale)), Image.LANCZOS)
    alpha = np.asarray(work.split()[-1])
    W, H = work.size
    print(f'mask {rgba.size} -> work {W}x{H}')

ink = alpha > 96
print(f'ink pixels: {int(ink.sum())}')

ink_d = ndimage.binary_dilation(ink, iterations=2)
skel = skeletonize(ink_d)
print(f'skeleton pixels: {int(skel.sum())}')

pts = {(int(y), int(x)) for y, x in zip(*np.nonzero(skel))}
NEIGHBOURS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

adj = {}
for p in pts:
    y, x = p
    adj[p] = [(y + dy, x + dx) for dy, dx in NEIGHBOURS if (y + dy, x + dx) in pts]

# --- Split the skeleton into strokes --------------------------------------
# A stroke runs between two "special" nodes: endpoints (degree 1) and junctions
# (degree >= 3). Walking edge by edge from each special node covers the whole
# skeleton exactly once.
special = {p for p in pts if len(adj[p]) != 2}
print(f'special nodes: {len(special)} (endpoints + junctions)')

visited_edges = set()
strokes = []


def edge_key(a, b):
    return (a, b) if a <= b else (b, a)


for start in sorted(special):
    for first in adj[start]:
        if edge_key(start, first) in visited_edges:
            continue

        stroke = [start]
        visited_edges.add(edge_key(start, first))
        prev, cur = start, first
        stroke.append(cur)

        # Walk along degree-2 nodes until the next special node.
        while cur not in special:
            nxt = None
            for n in adj[cur]:
                if n != prev and edge_key(cur, n) not in visited_edges:
                    nxt = n
                    break
            if nxt is None:
                break
            visited_edges.add(edge_key(cur, nxt))
            prev, cur = cur, nxt
            stroke.append(cur)

        if len(stroke) > 3:
            strokes.append(stroke)

# Closed loops with no special node would be missed; pick them up too.
for p in pts:
    if p in special:
        continue
    for n in adj[p]:
        if edge_key(p, n) in visited_edges:
            continue
        stroke = [p]
        visited_edges.add(edge_key(p, n))
        prev, cur = p, n
        stroke.append(cur)
        while cur != p:
            nxt = None
            for m in adj[cur]:
                if m != prev and edge_key(cur, m) not in visited_edges:
                    nxt = m
                    break
            if nxt is None:
                break
            visited_edges.add(edge_key(cur, nxt))
            prev, cur = cur, nxt
            stroke.append(cur)
        if len(stroke) > 3:
            strokes.append(stroke)

covered = sum(len(s) for s in strokes)
print(f'strokes: {len(strokes)}  covering {covered}/{len(pts)} skeleton pixels '
      f'({100 * covered / len(pts):.0f}%)')

# --- Order the strokes the way a hand writes them -------------------------
# Left to right by the stroke's leftmost point, then top to bottom. That is the
# order a signature is written in, and it keeps the pen moving forward.
strokes.sort(key=lambda s: (min(x for _, x in s), min(y for y, _ in s)))

# Orient each stroke so it starts at its leftmost end, keeping the pen moving
# rightwards instead of doubling back.
oriented = []
for s in strokes:
    if s[0][1] > s[-1][1]:
        s = list(reversed(s))
    oriented.append(s)


def rdp(points, eps):
    if len(points) < 3:
        return points
    (y0, x0), (y1, x1) = points[0], points[-1]
    dy, dx = y1 - y0, x1 - x0
    norm = (dy * dy + dx * dx) ** 0.5 or 1e-9
    worst, worst_i = -1.0, 0
    for i in range(1, len(points) - 1):
        y, x = points[i]
        d = abs(dy * (x - x0) - dx * (y - y0)) / norm
        if d > worst:
            worst, worst_i = d, i
    if worst <= eps:
        return [points[0], points[-1]]
    return rdp(points[: worst_i + 1], eps)[:-1] + rdp(points[worst_i:], eps)


# Normalise over the INK's bounding box, so the path maps onto the same box the
# mask is drawn in.
ys, xs = np.nonzero(ink)
min_y, max_y = int(ys.min()), int(ys.max())
min_x, max_x = int(xs.min()), int(xs.max())
span_y = max(max_y - min_y, 1)
span_x = max(max_x - min_x, 1)

flat = []
for s in oriented:
    simplified = rdp(s, 0.8)
    if flat:
        flat.append(None)  # pen lift between strokes
    for y, x in simplified:
        flat.append([round((x - min_x) / span_x, 5), round((y - min_y) / span_y, 5)])

payload = {
    'points': flat,
    'aspect': round(span_x / span_y, 5),
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
    json.dump(payload, fh, separators=(',', ':'))

# --- Debug overlay --------------------------------------------------------
os.makedirs(os.path.dirname(DEBUG), exist_ok=True)
dbg = Image.new('RGB', (W, H), (16, 26, 22))
dbg.paste((52, 62, 56), mask=Image.fromarray((ink * 255).astype(np.uint8)))
draw = ImageDraw.Draw(dbg)
palette = [(196, 223, 115), (188, 128, 99), (120, 190, 220), (230, 200, 120), (200, 140, 200)]
for i, s in enumerate(oriented):
    draw.line([(x, y) for y, x in s], fill=palette[i % len(palette)], width=2)
dbg.save(DEBUG)

size = os.path.getsize(OUT)
print(f'wrote {OUT}  {len(flat)} entries  {size / 1024:.1f} KB  aspect={payload["aspect"]}')
print(f'debug overlay: {DEBUG}')
if size == 0:
    raise SystemExit('EMPTY OUTPUT')
