# Tile rendered stills into a labeled contact sheet: python tools/sheet.py out/sheet.jpg [cols] [thumbW] [filter]
import sys, glob, os
from PIL import Image, ImageDraw
out = sys.argv[1] if len(sys.argv) > 1 else 'out/sheet.jpg'
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
tw = int(sys.argv[3]) if len(sys.argv) > 3 else 480
flt = sys.argv[4].split(',') if len(sys.argv) > 4 else None
files = sorted(glob.glob('out/stills/f*.png'))
if flt: files = [f for f in files if os.path.basename(f)[1:5] in [x.zfill(4) for x in flt]]
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6), rows * (th + 26)), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * (tw + 6), (i // cols) * (th + 26)
    sheet.paste(im, (x, y + 22))
    fr = int(os.path.basename(f)[1:5])
    d.text((x + 4, y + 4), f'f{fr}  t={fr/60:.2f}s', fill=(255, 200, 0))
sheet.save(out, quality=90)
print(out, sheet.size, len(files))
