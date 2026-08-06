/**
 * Traces the seagull out of `public/logo.png` and writes the SVG path data
 * for `src/festival/CarnivalMark.tsx`.
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-DRAWN PATH. The mark that shipped
 * before was drawn by eye from the logo, and it was wrong in the way
 * eyeballed curves usually are: the wings had the wrong sweep. A school's
 * mark is not something to approximate. This reads the actual artwork, finds
 * the white silhouette, walks its outline and simplifies it, so the vector
 * IS the logo rather than an impression of it.
 *
 *   node scripts/make-seagull-mark.mjs
 *
 * Requires Pillow (`pip install pillow`) and is run by hand when the source
 * artwork changes, not as part of the build.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PY = String.raw`
import json, sys
from PIL import Image

im = Image.open('public/logo.png').convert('RGB')
W, H = im.size
px = im.load()

# The bird is the white artwork in the left half; the wordmark is the right.
LIMIT = int(W * 0.5)
def white(x, y):
    r, g, b = px[x, y]
    return r > 170 and g > 170 and b > 170

mask = [[white(x, y) for x in range(LIMIT)] for y in range(H)]

# --- connected components (4-neighbour), largest first -------------------
seen = [[False] * LIMIT for _ in range(H)]
comps = []
for sy in range(H):
    for sx in range(LIMIT):
        if not mask[sy][sx] or seen[sy][sx]:
            continue
        stack, cells = [(sx, sy)], []
        seen[sy][sx] = True
        while stack:
            x, y = stack.pop()
            cells.append((x, y))
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < LIMIT and 0 <= ny < H and mask[ny][nx] and not seen[ny][nx]:
                    seen[ny][nx] = True
                    stack.append((nx, ny))
        if len(cells) > 400:
            comps.append(cells)
comps.sort(key=len, reverse=True)

# --- Moore-neighbour boundary trace on one component ---------------------
def trace(cells):
    inside = set(cells)
    start = min(cells, key=lambda c: (c[1], c[0]))   # topmost, then leftmost
    # 8-neighbourhood, clockwise from west
    nbrs = [(-1,0),(-1,-1),(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1)]
    contour = [start]
    cur = start
    back = 0
    guard = 0
    while True:
        guard += 1
        if guard > 4_000_000:
            break
        found = False
        for k in range(8):
            i = (back + 1 + k) % 8
            nx, ny = cur[0] + nbrs[i][0], cur[1] + nbrs[i][1]
            if (nx, ny) in inside:
                # Where we came FROM, as seen from the NEW pixel: the reverse
                # of the direction we just travelled. Searching resumes one
                # step clockwise of it, which is what keeps the walk hugging
                # the boundary instead of cutting across the interior.
                back = (i + 4) % 8
                cur = (nx, ny)
                contour.append(cur)
                found = True
                break
        if not found:
            break
        if cur == start and len(contour) > 3:
            break
    return contour

# --- Douglas-Peucker -----------------------------------------------------
def simplify(pts, eps):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    norm = (dx * dx + dy * dy) ** 0.5 or 1.0
    worst, index = 0.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + bx * ay - by * ax) / norm
        if d > worst:
            worst, index = d, i
    if worst > eps:
        left = simplify(pts[: index + 1], eps)
        right = simplify(pts[index:], eps)
        return left[:-1] + right
    return [pts[0], pts[-1]]

def simplify_ring(ring, eps):
    """
    Douglas-Peucker on a CLOSED contour, which needs the ring split first.

    Run directly on a ring it collapses to two points every time: the first
    and last vertices are the same pixel, so the baseline segment has zero
    length and every perpendicular distance to it computes as zero. Nothing
    ever exceeds the tolerance. Cutting the ring at two far-apart anchors
    gives two honest open chains, each with a baseline that means something.
    """
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring[:]
    if len(pts) < 4:
        return pts
    ax, ay = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0]-ax)**2 + (pts[i][1]-ay)**2)
    first = simplify(pts[: far + 1], eps)
    second = simplify(pts[far:] + [pts[0]], eps)
    return first[:-1] + second[:-1]

sys.setrecursionlimit(50000)
out = []
for cells in comps:
    out.append(simplify_ring(trace(cells), 1.1))

print(json.dumps({'shapes': out, 'size': [W, H]}))
`;

const raw = execFileSync('python3', ['-c', PY], {
  cwd: process.cwd(),
  maxBuffer: 1 << 28,
});
const { shapes } = JSON.parse(raw.toString());

// Normalise into a tidy viewBox: origin at the artwork's own top-left, and
// no scaling, so the proportions are the logo's exactly.
const all = shapes.flat();
const minX = Math.min(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const maxX = Math.max(...all.map((p) => p[0]));
const maxY = Math.max(...all.map((p) => p[1]));

const round = (n) => Math.round(n * 10) / 10;
const paths = shapes.map(
  (pts) =>
    'M' +
    pts
      .map(([x, y]) => `${round(x - minX)} ${round(y - minY)}`)
      .join('L') +
    'Z'
);

const width = round(maxX - minX);
const height = round(maxY - minY);
console.log(
  `shapes: ${shapes.length}, points: ${shapes.map((s) => s.length).join('+')}`
);
console.log(`viewBox: 0 0 ${width} ${height}`);
writeFileSync(
  'src/festival/seagull-path.ts',
  `/**
 * GENERATED by scripts/make-seagull-mark.mjs from public/logo.png.
 * Do not edit by hand: re-run the script if the artwork changes.
 */
export const SEAGULL_VIEWBOX = '0 0 ${width} ${height}';

export const SEAGULL_PATHS = [
${paths.map((d) => `  '${d}',`).join('\n')}
] as const;
`
);
console.log('wrote src/festival/seagull-path.ts');

/* ------------------------------------------------------------------ *
 *  The icons carry the same bird, so they come from the same trace.
 *
 *  Leaving them alone would have been the quiet way to ship a logo fix
 *  that is wrong in the browser tab, on the home screen and in the
 *  bookmark bar. They are all one shape; it should be traced once.
 * ------------------------------------------------------------------ */
const BOX = 512;
const PAD = 0.84;
const scale = Math.min((BOX * PAD) / width, (BOX * PAD) / height);
const tx = round((BOX - width * scale) / 2);
const ty = round((BOX - height * scale) / 2);
const transform = `translate(${tx} ${ty}) scale(${round(scale * 1000) / 1000})`;
const body = (fill) =>
  `<g transform="${transform}" fill="${fill}">${paths
    .map((d) => `<path d="${d}"/>`)
    .join('')}</g>`;

const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" width="${BOX}" height="${BOX}">`;
writeFileSync(
  'public/favicon.svg',
  // The tab strip is dark in dark mode, where the school's blue goes muddy.
  `${head}<style>@media (prefers-color-scheme: dark){path{fill:#FFFFFF}}</style>${body('#2B6686')}</svg>\n`
);
writeFileSync('public/mask-icon.svg', `${head}${body('black')}</svg>\n`);
console.log('wrote public/favicon.svg, public/mask-icon.svg');
