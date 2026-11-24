from PIL import Image
import glob, os

files = sorted(glob.glob(r"c:\Users\gargp\Downloads\Portfolio\_frames_src\processed_frames\*.png"))
print(f"frames: {len(files)}")

widths, heights, bottoms, tops = [], [], [], []
for f in files:
    img = Image.open(f)
    # downscale 4x for speed; bbox measured at 1/4 then scaled back
    small = img.resize((img.width // 4, img.height // 4), Image.LANCZOS)
    alpha = small.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 128 else 0).getbbox()
    if not bbox:
        print(f"{os.path.basename(f)}: NO SUBJECT")
        continue
    x0, y0, x1, y1 = bbox
    W, H = img.width, img.height
    sx, sy = W / small.width, H / small.height
    w = (x1 - x0) * sx
    h = (y1 - y0) * sy
    widths.append(w)
    heights.append(h)
    bottoms.append(H - y1 * sy)
    tops.append(y0 * sy)

print(f"subject width:  min={min(widths):.0f} max={max(widths):.0f} spread={100*(max(widths)-min(widths))/min(widths):.1f}%")
print(f"subject height: min={min(heights):.0f} max={max(heights):.0f} spread={100*(max(heights)-min(heights))/min(heights):.1f}%")
print(f"bottom gap:     min={min(bottoms):.0f} max={max(bottoms):.0f}")
print(f"top gap:        min={min(tops):.0f} max={max(tops):.0f}")

# extremes
hi = heights.index(max(heights))
lo = heights.index(min(heights))
print(f"tallest subject: {os.path.basename(files[hi])} h={max(heights):.0f}")
print(f"shortest subject: {os.path.basename(files[lo])} h={min(heights):.0f}")
