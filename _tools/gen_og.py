"""Render the Open Graph card from the entrance portrait and the site palette."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
BG = (16, 26, 22)
FG = (241, 240, 232)
MUTED = (170, 181, 169)
ACCENT = (196, 223, 115)

root = r'C:\Users\gargp\Downloads\Portfolio'
frame = os.path.join(root, 'public', 'frames', 'desktop', 'f0060.webp')
out = os.path.join(root, 'public', 'og.png')

canvas = Image.new('RGB', (W, H), BG)

# Portrait on the right, anchored to the bottom edge.
portrait = Image.open(frame).convert('RGBA')
scale = H / portrait.height
pw = int(portrait.width * scale)
portrait = portrait.resize((pw, H), Image.LANCZOS)
canvas.paste(portrait, (W - pw + 120, 0), portrait)

draw = ImageDraw.Draw(canvas)

# Scrim so the type stays legible.
scrim = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(scrim)
for x in range(W):
    a = int(255 * max(0.0, min(1.0, (x - 380) / 620)))
    sd.line([(x, 0), (x, H)], fill=(16, 26, 22, a))
canvas = Image.alpha_composite(canvas.convert('RGBA'), scrim).convert('RGB')
draw = ImageDraw.Draw(canvas)

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

serif = font(r'C:\Windows\Fonts\georgia.ttf', 78)
sans = font(r'C:\Windows\Fonts\segoeui.ttf', 26)
mono = font(r'C:\Windows\Fonts\consola.ttf', 17)

draw.text((72, 96), 'PRATHAM AGARWAL', font=mono, fill=ACCENT)
draw.text((72, 150), 'Engineering', font=serif, fill=FG)
draw.text((72, 236), 'Atlas', font=serif, fill=FG)
draw.text((72, 350), 'Systems, applied AI and security work.', font=sans, fill=MUTED)
draw.text((72, 388), 'Case studies, open-source contributions, field notes.', font=sans, fill=MUTED)

draw.line([(72, 470), (472, 470)], fill=(60, 80, 68), width=1)
draw.text((72, 492), 'uniquepratham-portfolio.web.app', font=mono, fill=MUTED)

canvas.save(out, 'PNG', optimize=True)
print('wrote', out, os.path.getsize(out), 'bytes')
