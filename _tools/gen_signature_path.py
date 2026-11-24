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

# --- Chain the strokes into one continuous pen path -----------------------
# Ordering fragments by x-position makes the pen teleport: it finishes a stroke
# on the right of a letter, then jumps back left for the next fragment. That is
# the "dancing" look.
#
# Instead the fragments are chained greedily by proximity: from the end of the
# current stroke, take the nearest remaining stroke end, and orient it so it
# starts there. The pen then always travels to the closest next piece of ink,
# which is how a hand moves.
def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def stroke_length(s):
    return sum(dist(s[j - 1], s[j]) for j in range(1, len(s)))


# Drop specks. A 2-3 point fragment is skeleton noise at a junction, not a
# stroke: writing it takes a few milliseconds and makes the pen flicker on and
# off. Anything shorter than this is absorbed by the merge step below.
MIN_LEN = 0.05
strokes = [s for s in strokes if stroke_length(s) >= MIN_LEN]
print(f'after dropping specks: {len(strokes)} strokes')

# Start at the leftmost stroke end — a signature begins at the first letter.
remaining = list(strokes)
start_i = min(range(len(remaining)), key=lambda i: min(p[1] for p in remaining[i]))
current = remaining.pop(start_i)
if current[0][1] > current[-1][1]:
    current = list(reversed(current))

chained = [current]
while remaining:
    tail = chained[-1][-1]
    best_i, best_rev, best_d = -1, False, float('inf')
    for i, s in enumerate(remaining):
        d_head = dist(tail, s[0])
        d_tail = dist(tail, s[-1])
        if d_head < best_d:
            best_i, best_rev, best_d = i, False, d_head
        if d_tail < best_d:
            best_i, best_rev, best_d = i, True, d_tail
    nxt = remaining.pop(best_i)
    if best_rev:
        nxt = list(reversed(nxt))
    chained.append(nxt)

# Report how far the pen has to travel between fragments. A large jump means the
# chain is wrong and the pen will visibly teleport.
jumps = [dist(chained[i][-1], chained[i + 1][0]) for i in range(len(chained) - 1)]
if jumps:
    jumps_sorted = sorted(jumps)
    print(f'pen lifts: {len(jumps)}  median {jumps_sorted[len(jumps_sorted) // 2]:.1f}px  '
          f'max {max(jumps):.1f}px')

# Merge fragments whose ends are within a few pixels: those are one continuous
# stroke that the skeleton split at a junction, not a real pen lift.
MERGE_PX = 6.0
merged = [chained[0]]
for s in chained[1:]:
    if dist(merged[-1][-1], s[0]) <= MERGE_PX:
        merged[-1] = merged[-1] + s
    else:
        merged.append(s)
print(f'merged {len(chained)} fragments -> {len(merged)} strokes')

# --- Move the underline flourish to the end -------------------------------
# A signature's long horizontal flourish is written LAST. The proximity chain
# puts it wherever it happens to be nearest, which made the underline appear
# before the letters — the most visible ordering bug.
#
# The flourish is the single WIDEST stroke: it runs under the whole signature.
# A relative test (widest by a clear margin) is robust, whereas an absolute span
# threshold matches every stroke because they all span a letter or two.
def span_of(s):
    xs = [p[1] for p in s]
    return max(xs) - min(xs)


spans = sorted((span_of(s) for s in merged), reverse=True)
if len(spans) >= 2 and spans[0] > spans[1] * 1.35:
    widest = max(merged, key=span_of)
    merged = [s for s in merged if s is not widest] + [widest]
    print(f'moved the underline flourish to the end (span {spans[0]:.2f} vs next {spans[1]:.2f})')
else:
    print(f'no clear flourish found (spans {spans[:3]})')

# --- Merge tiny strokes into their neighbour ------------------------------
# Done after normalisation, below: the threshold is in normalised units, so
# comparing it against pixel lengths would silently merge nothing.

oriented = merged


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

# Simplify and normalise each stroke, then merge the short ones in NORMALISED
# units. Doing the merge before normalisation compares pixel lengths against a
# normalised threshold, which silently merges nothing.
normalised = []
for s in oriented:
    simplified = rdp(s, 0.8)
    normalised.append([
        ((x - min_x) / span_x, (y - min_y) / span_y) for y, x in simplified
    ])


def nlength(s):
    return sum(dist(s[j - 1], s[j]) for j in range(1, len(s)))


MIN_WRITE_LEN = 0.22
changed = True
while changed and len(normalised) > 1:
    changed = False
    for i, s in enumerate(normalised):
        if nlength(s) >= MIN_WRITE_LEN:
            continue
        best = None
        if i > 0:
            best = (dist(normalised[i - 1][-1], s[0]), i - 1, 'prev')
        if i < len(normalised) - 1:
            d = dist(s[-1], normalised[i + 1][0])
            if best is None or d < best[0]:
                best = (d, i + 1, 'next')
        if best is None:
            break
        _, j, side = best
        if side == 'prev':
            normalised[j] = normalised[j] + s
        else:
            normalised[j] = s + normalised[j]
        normalised.pop(i)
        changed = True
        break

print(f'after merging short strokes: {len(normalised)} strokes')
print('  lengths:', [round(nlength(s), 3) for s in normalised])

flat = []
for s in normalised:
    if flat:
        flat.append(None)  # pen lift between strokes
    for x, y in s:
        flat.append([round(x, 5), round(y, 5)])

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
