import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg, os

SRC = '/mnt/user-data/uploads/logo-light.png'
im = np.array(Image.open(SRC).convert('RGBA'))
H, W, _ = im.shape
MW = 70  # mark width in px

COLS = {'B': (0x2f, 0x51, 0x99), 'Y': (0xc6, 0x91, 0x23),
        'G': (0x43, 0x99, 0x40), 'R': (0xc9, 0x1b, 0x25)}
HEX = {'B': '#2F5199', 'Y': '#C69123', 'G': '#439940', 'R': '#C91B25'}

def cls(p):
    if p[3] < 128: return None
    best = min(COLS, key=lambda k: sum((int(p[i]) - COLS[k][i]) ** 2 for i in range(3)))
    d = sum((int(p[i]) - COLS[best][i]) ** 2 for i in range(3))
    return best if d < 3000 else None

grid = [[cls(im[y, x]) for x in range(MW)] for y in range(H)]

# per-column top/bottom of each colour band
def band_edges(c):
    xs, tops, bots = [], [], []
    for x in range(MW):
        ys = [y for y in range(H) if grid[y][x] == c]
        if ys:
            xs.append(x + 0.5); tops.append(min(ys)); bots.append(max(ys) + 1)
    return np.array(xs), np.array(tops, float), np.array(bots, float)

def fit(xs, ys, deg=4):
    return np.polyfit(xs, ys, deg)

def curve(poly, x0, x1, n=120):
    xs = np.linspace(x0, x1, n)
    return xs, np.polyval(poly, xs)

paths = {}
edges = {c: band_edges(c) for c in COLS}

# Blue: top of mark down to blue bottom edge. Blue spans all columns.
xs, t, b = edges['B']
pb = fit(xs, b)
cx, cy = curve(pb, 0, MW)
pts = [(0, 0), (MW, 0)] + list(zip(cx[::-1], cy[::-1]))
paths['B'] = pts

# Red: red top edge down to bottom. Red spans all columns.
xs, t, b = edges['R']
pr = fit(xs, t)
cx, cy = curve(pr, 0, MW)
pts = list(zip(cx, cy)) + [(MW, H), (0, H)]
paths['R'] = pts

# Gold: between top and bottom edges over its x-range; extend to right edge.
xs, t, b = edges['Y']
pt, pbo = fit(xs, t), fit(xs, b)
# taper to a point: find where top and bottom curves meet, searching left of the band start
x0 = xs.min() - 0.5
for xx in np.linspace(xs.min(), 0, 400):
    if np.polyval(pbo, xx) - np.polyval(pt, xx) <= 0.05: x0 = xx; break
cx1, cy1 = curve(pt, x0, MW); cx2, cy2 = curve(pbo, x0, MW)
paths['Y'] = list(zip(cx1, cy1)) + list(zip(cx2[::-1], cy2[::-1]))

# Green: spans all columns (left) and its right end is a point where top meets bottom.
xs, t, b = edges['G']
pt, pbo = fit(xs, t), fit(xs, b)
x1 = xs.max() + 0.5
for xx in np.linspace(xs.max(), MW, 400):
    if np.polyval(pbo, xx) - np.polyval(pt, xx) <= 0.05: x1 = xx; break
x1 = min(x1, MW)
cx1, cy1 = curve(pt, 0, x1); cx2, cy2 = curve(pbo, 0, x1)
paths['G'] = list(zip(cx1, cy1)) + list(zip(cx2[::-1], cy2[::-1]))

def poly_to_path(pts):
    return 'M ' + ' L '.join(f'{x:.2f},{y:.2f}' for x, y in pts) + ' Z'

# Wordmark: Poppins Regular, x-height 33 units, letter left edges from the original.
font = TTFont('/home/claude/fonts/Poppins-Regular.ttf')
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
xh = font['OS/2'].sxHeight
scale = 33.0 / xh
baseline = 52.0
lefts = {0: 80, 1: 109, 2: 139, 3: 164, 4: 204, 5: 232}
word = 'strata'
glyph_paths = []
for i, ch in enumerate(word):
    g = gs[cmap[ord(ch)]]
    # find glyph left bearing to align ink left edge
    from fontTools.pens.boundsPen import BoundsPen
    bp = BoundsPen(gs); g.draw(bp); xmin = bp.bounds[0]
    tx = lefts[i] - xmin * scale
    pen = SVGPathPen(gs)
    tp = TransformPen(pen, (scale, 0, 0, -scale, tx, baseline))
    g.draw(tp)
    glyph_paths.append(pen.getCommands())
    right_edge = tx + bp.bounds[2] * scale
CW = int(np.ceil(right_edge)) + 1
print('canvas width', CW)

def build_svg(fg, top_op, bot_op):
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW} 62" width="{CW}" height="62">']
    s.append(f'<rect x="0" y="0" width="{MW}" height="{H}" fill="#FFFFFF"/>')
    for c in 'BYGR':
        s.append(f'<path d="{poly_to_path(paths[c])}" fill="{HEX[c]}"/>')
    s.append(f'<rect x="74" y="0" width="{CW-74}" height="1" fill="{fg}" fill-opacity="{top_op}"/>')
    s.append(f'<rect x="74" y="60" width="{CW-74}" height="2" fill="{fg}" fill-opacity="{bot_op}"/>')
    for d in glyph_paths:
        s.append(f'<path d="{d}" fill="{fg}"/>')
    s.append('</svg>')
    return '\n'.join(s)

def build_mark_svg():
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MW} {H}" width="{MW}" height="{H}">']
    s.append(f'<rect x="0" y="0" width="{MW}" height="{H}" fill="#FFFFFF"/>')
    for c in 'BYGR':
        s.append(f'<path d="{poly_to_path(paths[c])}" fill="{HEX[c]}"/>')
    s.append('</svg>')
    return '\n'.join(s)

out = '/home/claude/logo'
os.makedirs(out, exist_ok=True)
light = build_svg('#000000', 0.84, 0.42)
dark = build_svg('#FFFFFF', 0.84, 0.42)
mark = build_mark_svg()
open(f'{out}/strata-logo-light.svg', 'w').write(light)
open(f'{out}/strata-logo-dark.svg', 'w').write(dark)
open(f'{out}/strata-mark.svg', 'w').write(mark)

for name, svg in [('strata-logo-light', light), ('strata-logo-dark', dark)]:
    for w in (1024, 2048, 4096):
        cairosvg.svg2png(bytestring=svg.encode(), write_to=f'{out}/{name}-{w}.png', output_width=w)
for w in (512, 1024, 2048):
    cairosvg.svg2png(bytestring=mark.encode(), write_to=f'{out}/strata-mark-{w}.png', output_width=w)

# preview sheet: original vs vector at 6x, light and dark on backgrounds
prev_l = Image.open(f'{out}/strata-logo-light-2048.png').convert('RGBA')
bgL = Image.new('RGBA', prev_l.size, (255, 255, 255, 255)); bgL.alpha_composite(prev_l)
prev_d = Image.open(f'{out}/strata-logo-dark-2048.png').convert('RGBA')
bgD = Image.new('RGBA', prev_d.size, (26, 29, 33, 255)); bgD.alpha_composite(prev_d)
orig = Image.open(SRC).convert('RGBA'); orig = orig.resize((int(orig.width*prev_l.height/62), prev_l.height), Image.NEAREST)
bgO = Image.new('RGBA', prev_l.size, (255, 255, 255, 255)); bgO.alpha_composite(orig)
sheet = Image.new('RGBA', (prev_l.width, prev_l.height * 3 + 40), (200, 200, 200, 255))
sheet.paste(bgO, (0, 0)); sheet.paste(bgL, (0, prev_l.height + 20)); sheet.paste(bgD, (0, prev_l.height * 2 + 40))
sheet.save('/home/claude/preview.png')
print('done')
