from PIL import Image
import sys

paths = [
    r"c:\Users\gargp\AppData\Roaming\Code\agentSessionData\7ab0ed11-6838-4c72-8a96-56eb7548a9d9\attachments\dd22a9b0-0a27-4a65-af97-32a6b46f5dc1\Pasted Image.png",
    r"c:\Users\gargp\AppData\Roaming\Code\agentSessionData\7ab0ed11-6838-4c72-8a96-56eb7548a9d9\attachments\24b5ece4-62d0-44a0-9f6f-3e9e9fa80a63\Pasted Image 2.png",
]

for p in paths:
    img = Image.open(p).convert("RGB")
    w, h = img.size
    px = img.load()
    # Figure is on the right half, below the nav (y > 120). Threshold on brightness.
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(120, h, 2):
        for x in range(w // 2, w, 2):
            r, g, b = px[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum > 70:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    fw = maxx - minx
    fh = maxy - miny
    bottom_gap = h - maxy
    print(f"\n{p.split(chr(92))[-1]}")
    print(f"  image size: {w}x{h}")
    print(f"  figure bbox: x {minx}-{maxx}, y {miny}-{maxy}")
    print(f"  figure size: {fw}x{fh}")
    print(f"  gap below figure (to viewport bottom): {bottom_gap}px")
    print(f"  figure bottom at viewport bottom? {bottom_gap <= 2}")
