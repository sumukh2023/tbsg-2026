/**
 * Turns the uploaded artwork into something a phone can download.
 *
 * The photographs arrive from a camera roll at full resolution: the six
 * recognition images were 34 MB of PNG for a banner 540 pixels wide, and the
 * six Mission carousel plates another 44 MB. A visitor on mobile data would
 * have paid for every byte. This writes web-sized files next to them and the
 * pages reference those.
 *
 *   node scripts/optimise-photos.mjs
 *
 * Requires Pillow. Run by hand when the artwork changes; the outputs are
 * committed. Sources that are no longer in the repository are reported and
 * skipped, so this stays runnable after the originals have been cleared out.
 */
import { execFileSync } from 'node:child_process';

const PY = String.raw`
import os, json
from PIL import Image

# source stem -> (output path, longest edge, format)
JOBS = [
    # The Partners recognition banners: 16:9, at most ~540 CSS px wide.
    ('Main Entrance',       'public/recognition/main-entrance.jpg',       1280, 'JPEG'),
    ('Stage Branding',      'public/recognition/stage-branding.jpg',      1280, 'JPEG'),
    ('Social Media',        'public/recognition/social-media.jpg',        1280, 'JPEG'),
    ('Event Announcements', 'public/recognition/event-announcements.jpg', 1280, 'JPEG'),
    ('Digital Screens',     'public/recognition/digital-screens.jpg',     1280, 'JPEG'),
    ('Printed Collateral',  'public/recognition/printed-collateral.jpg',  1280, 'JPEG'),
    # The Mission carousel plates: 16:10, at most ~34rem (544px) wide.
    ('IMG 1', 'public/rangeelo/1.jpg', 1400, 'JPEG'),
    ('IMG 2', 'public/rangeelo/2.jpg', 1400, 'JPEG'),
    ('IMG 3', 'public/rangeelo/3.jpg', 1400, 'JPEG'),
    ('IMG 4', 'public/rangeelo/4.jpg', 1400, 'JPEG'),
    ('IMG 5', 'public/rangeelo/5.jpg', 1400, 'JPEG'),
    ('IMG 6', 'public/rangeelo/6.jpg', 1400, 'JPEG'),
    # The Flash wordmark. PNG, not JPEG: it is flat colour and hard edges,
    # which is exactly what JPEG rings around, and it carries transparency.
    ('Flash Brand Logo', 'public/flash-wordmark.png', 1042, 'PNG-KEYED'),
]

def key_out_white(im):
    """
    Turn a wordmark's white background into real transparency.

    The file arrives as purple ink on an OPAQUE white rectangle (alpha is 255
    everywhere), which inside a warm tinted card reads as a sticker pasted on
    rather than as part of the page. Keying it is not a simple "delete white"
    threshold: that leaves a hard, jagged edge where the type was
    anti-aliased. Every edge pixel is a blend a*ink + (1-a)*white, so the
    blend is inverted instead: solve for the alpha and repaint at full ink.
    The letterforms keep their smooth edges and gain a real alpha ramp.
    """
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    # The ink, as the darkest pixel present.
    ink = min(
        (px[x, y][:3] for y in range(0, h, 3) for x in range(0, w, 3)),
        key=sum,
    )
    denom = [max(255 - c, 1) for c in ink]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = max((255 - r) / denom[0], (255 - g) / denom[1], (255 - b) / denom[2])
            a = 0 if a < 0 else (1 if a > 1 else a)
            px[x, y] = (ink[0], ink[1], ink[2], round(a * 255))
    return im


report = []
for stem, out, longest, fmt in JOBS:
    src = f'public/{stem}.png'
    if not os.path.exists(src):
        report.append({'out': out, 'skipped': 'source not in repo'})
        continue
    before = os.path.getsize(src)
    im = Image.open(src)
    w, h = im.size
    if max(w, h) > longest:
        scale = longest / max(w, h)
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if fmt == 'JPEG':
        im.convert('RGB').save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    elif fmt == 'PNG-KEYED':
        key_out_white(im).save(out, 'PNG', optimize=True)
    else:
        im.convert('RGBA').save(out, 'PNG', optimize=True)
    report.append({'out': out, 'size': im.size, 'before': before,
                   'after': os.path.getsize(out)})
print(json.dumps(report))
`;

const report = JSON.parse(
  execFileSync('python3', ['-c', PY], { cwd: process.cwd() }).toString()
);
const kb = (n) => `${Math.round(n / 1024)} kB`;
let before = 0;
let after = 0;
for (const r of report) {
  const name = r.out.replace('public/', '');
  if (r.skipped) {
    console.log(`${name.padEnd(38)} ${r.skipped}`);
    continue;
  }
  before += r.before;
  after += r.after;
  console.log(
    `${name.padEnd(38)} ${String(r.size[0]).padStart(4)}x${String(r.size[1]).padEnd(4)} ${kb(r.before).padStart(9)} -> ${kb(r.after).padStart(8)}`
  );
}
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
if (before) {
  console.log(
    `\ntotal ${mb(before)} -> ${mb(after)}  (${Math.round((1 - after / before) * 100)}% smaller)`
  );
}
