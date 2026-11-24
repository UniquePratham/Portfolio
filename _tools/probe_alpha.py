"""Probe the new full-body source: is the background transparent or white?"""
from PIL import Image
import numpy as np

p = r'C:\Users\gargp\Downloads\Portfolio\_frames_src\processed_frames\0000.png'
with Image.open(p) as im:
    print('mode:', im.mode, 'size:', im.size)
    rgba = im.convert('RGBA')
    a = np.asarray(rgba.split()[-1])
    rgb = np.asarray(rgba.convert('RGB'))
    print('alpha min/max:', a.min(), a.max())
    print('alpha==0 count:', int((a == 0).sum()), '/', a.size)
    print('alpha==255 count:', int((a == 255).sum()), '/', a.size)
    # corner pixels (background)
    for name, (x, y) in {'topleft': (5, 5), 'topright': (im.width - 5, 5),
                         'botleft': (5, im.height - 5), 'botright': (im.width - 5, im.height - 5)}.items():
        print(f'{name}: rgb={tuple(rgb[y, x])} a={a[y, x]}')
