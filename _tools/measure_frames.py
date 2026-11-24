from PIL import Image
import glob, os

for tier in ("desktop", "mobile"):
    files = sorted(glob.glob(rf"c:\Users\gargp\Downloads\Portfolio\public\frames\{tier}\f*.webp"))
    print(f"\n=== {tier}: {len(files)} frames ===")
    if not files:
        continue
    widths = []
    bottoms = []
    for f in files:
        img = Image.open(f).convert("RGBA")
        alpha = img.getchannel("A")
        bbox = alpha.getbbox()
        if not bbox:
            print(f"{os.path.basename(f)}: EMPTY")
            continue
        x0, y0, x1, y1 = bbox
        w = x1 - x0
        h = y1 - y0
        widths.append(w)
        bottoms.append(img.height - y1)
    if widths:
        print(f"subject width: min={min(widths)} max={max(widths)} spread={max(widths)-min(widths)}px ({100*(max(widths)-min(widths))/min(widths):.1f}%)")
        print(f"bottom gap (img.height - y1): min={min(bottoms)} max={max(bottoms)}")
        # find the frames with the extreme widths
        ws = sorted(range(len(widths)), key=lambda i: widths[i])
        lo, hi = ws[0], ws[-1]
        print(f"narrowest: {os.path.basename(files[lo])} w={widths[lo]}")
        print(f"widest:    {os.path.basename(files[hi])} w={widths[hi]}")
