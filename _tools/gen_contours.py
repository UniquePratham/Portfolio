"""Generate topographic contour paths for the Engineering Atlas.

The atlas is a real map, not decoration: a height field is built from a handful
of named peaks (one per destination) plus low-frequency noise, then contoured
with marching squares. The output is a set of SVG path strings in a 1000x640
viewBox, which the atlas renders as terrain.

Run: python _tools/gen_contours.py
"""
import json
import math
import os
import random

W, H = 1000, 640
COLS, ROWS = 200, 128

# Peaks are placed to match the destination coordinates in src/data/atlas.ts.
PEAKS = [
    (168, 196, 1.00, 150),   # systems
    (392, 118, 0.86, 132),   # intelligence
    (640, 214, 0.92, 140),   # product
    (846, 132, 0.74, 120),   # open source
    (300, 452, 0.80, 128),   # security
    (556, 486, 0.68, 118),   # field notes
    (790, 430, 0.62, 112),   # archive
    (128, 520, 0.58, 104),   # person
    (900, 540, 0.50, 96),    # contact
]


def height(x, y):
    h = 0.0
    for px, py, amp, radius in PEAKS:
        d2 = (x - px) ** 2 + (y - py) ** 2
        h += amp * math.exp(-d2 / (2 * radius ** 2))
    # Low-frequency undulation so the terrain is not a set of clean domes.
    h += 0.10 * math.sin(x / 190.0) * math.cos(y / 150.0)
    h += 0.06 * math.sin((x + y) / 260.0)
    return h


def build_field():
    field = []
    for r in range(ROWS):
        row = []
        for c in range(COLS):
            x = c * W / (COLS - 1)
            y = r * H / (ROWS - 1)
            row.append(height(x, y))
        field.append(row)
    return field


def lerp(p1, p2, v1, v2, level):
    if abs(v2 - v1) < 1e-9:
        return p1
    t = (level - v1) / (v2 - v1)
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))


def marching_squares(field, level):
    """Return line segments (as point pairs) where the field crosses `level`."""
    segs = []
    for r in range(ROWS - 1):
        for c in range(COLS - 1):
            x0 = c * W / (COLS - 1)
            x1 = (c + 1) * W / (COLS - 1)
            y0 = r * H / (ROWS - 1)
            y1 = (r + 1) * H / (ROWS - 1)

            tl = field[r][c]
            tr = field[r][c + 1]
            br = field[r + 1][c + 1]
            bl = field[r + 1][c]

            idx = 0
            if tl > level:
                idx |= 8
            if tr > level:
                idx |= 4
            if br > level:
                idx |= 2
            if bl > level:
                idx |= 1

            if idx in (0, 15):
                continue

            top = ((x0 + x1) / 2, y0)
            right = (x1, (y0 + y1) / 2)
            bottom = ((x0 + x1) / 2, y1)
            left = (x0, (y0 + y1) / 2)

            e_top = lerp((x0, y0), (x1, y0), tl, tr, level)
            e_right = lerp((x1, y0), (x1, y1), tr, br, level)
            e_bottom = lerp((x0, y1), (x1, y1), bl, br, level)
            e_left = lerp((x0, y0), (x0, y1), tl, bl, level)

            table = {
                1: [(e_left, e_bottom)],
                2: [(e_bottom, e_right)],
                3: [(e_left, e_right)],
                4: [(e_top, e_right)],
                5: [(e_left, e_top), (e_bottom, e_right)],
                6: [(e_top, e_bottom)],
                7: [(e_left, e_top)],
                8: [(e_left, e_top)],
                9: [(e_top, e_bottom)],
                10: [(e_left, e_bottom), (e_top, e_right)],
                11: [(e_top, e_right)],
                12: [(e_left, e_right)],
                13: [(e_bottom, e_right)],
                14: [(e_left, e_bottom)],
                15: [],
            }
            segs.extend(table.get(idx, []))
            _ = (top, right, bottom, left)
    return segs


def chain(segs, tol=1.2):
    """Join segments into polylines so the SVG has few, long paths."""
    def key(p):
        return (round(p[0] / tol), round(p[1] / tol))

    buckets = {}
    for i, (a, b) in enumerate(segs):
        buckets.setdefault(key(a), []).append((i, 0))
        buckets.setdefault(key(b), []).append((i, 1))

    used = [False] * len(segs)
    lines = []

    for start in range(len(segs)):
        if used[start]:
            continue
        used[start] = True
        a, b = segs[start]
        line = [a, b]

        # Extend forward.
        while True:
            k = key(line[-1])
            nxt = None
            for i, end in buckets.get(k, []):
                if used[i]:
                    continue
                nxt = (i, end)
                break
            if nxt is None:
                break
            i, end = nxt
            used[i] = True
            p, q = segs[i]
            line.append(q if end == 0 else p)

        # Extend backward.
        while True:
            k = key(line[0])
            nxt = None
            for i, end in buckets.get(k, []):
                if used[i]:
                    continue
                nxt = (i, end)
                break
            if nxt is None:
                break
            i, end = nxt
            used[i] = True
            p, q = segs[i]
            line.insert(0, q if end == 0 else p)

        if len(line) > 3:
            lines.append(line)

    return lines


def rdp(points, eps):
    """Ramer-Douglas-Peucker simplification."""
    if len(points) < 3:
        return points

    def perp(p, a, b):
        if a == b:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        px, py = a[0] + t * dx, a[1] + t * dy
        return math.hypot(p[0] - px, p[1] - py)

    dmax, index = 0.0, 0
    for i in range(1, len(points) - 1):
        d = perp(points[i], points[0], points[-1])
        if d > dmax:
            dmax, index = d, i

    if dmax > eps:
        left = rdp(points[: index + 1], eps)
        right = rdp(points[index:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]


def to_path(line):
    pts = [f"{line[0][0]:.1f} {line[0][1]:.1f}"]
    for x, y in line[1:]:
        pts.append(f"{x:.1f} {y:.1f}")
    return "M" + "L".join(pts)


def main():
    random.seed(7)
    field = build_field()
    lo = min(min(r) for r in field)
    hi = max(max(r) for r in field)

    levels = [lo + (hi - lo) * (i / 15.0) for i in range(1, 15)]

    out = []
    for i, level in enumerate(levels):
        segs = marching_squares(field, level)
        lines = chain(segs)
        paths = []
        for l in lines:
            simplified = rdp(l, 0.9)
            if len(simplified) > 2:
                paths.append(to_path(simplified))
        out.append({"level": round(level, 4), "index": i, "paths": paths})

    total = sum(len(o["paths"]) for o in out)
    print(f"levels={len(out)} paths={total}")

    dest = os.path.join(os.path.dirname(__file__), "..", "src", "data", "contours.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w") as fh:
        json.dump({"width": W, "height": H, "levels": out}, fh, separators=(",", ":"))
    print("wrote", os.path.abspath(dest), os.path.getsize(dest), "bytes")


if __name__ == "__main__":
    main()
