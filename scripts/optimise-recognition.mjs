/**
 * Turns the recognition photographs into something a phone can download.
 *
 * The six images arrived as full-resolution PNGs totalling 34 MB, for a card
 * banner that is at most ~540 CSS pixels wide. A visitor on mobile data would
 * have paid for all of it. This writes 1280px JPEGs into public/recognition/
 * and the page references those; on the numbers below that is a saving of
 * about 99%.
 *
 *   node scripts/optimise-recognition.mjs
 *
 * Requires Pillow. Run by hand when the photographs change, not as part of
 * the build; the outputs are committed.
 */
import { execFileSync } from 'node:child_process';

const PY = String.raw`
import os, json
from PIL import Image

SOURCES = {
    'Main Entrance': 'main-entrance',
    'Stage Branding': 'stage-branding',
    'Social Media': 'social-media',
    'Event Announcements': 'event-announcements',
    'Digital Screens': 'digital-screens',
    'Printed Collateral': 'printed-collateral',
}
os.makedirs('public/recognition', exist_ok=True)
report = []
for title, slug in SOURCES.items():
    src = f'public/{title}.png'
    if not os.path.exists(src):
        report.append({'slug': slug, 'skipped': 'missing source'})
        continue
    before = os.path.getsize(src)
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if w > 1280:
        im = im.resize((1280, round(h * 1280 / w)), Image.LANCZOS)
    out = f'public/recognition/{slug}.jpg'
    im.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    report.append({
        'slug': slug, 'size': im.size,
        'before': before, 'after': os.path.getsize(out),
    })
print(json.dumps(report))
`;

const report = JSON.parse(
  execFileSync('python3', ['-c', PY], { cwd: process.cwd() }).toString()
);
let before = 0;
let after = 0;
for (const r of report) {
  if (r.skipped) {
    console.log(`${r.slug.padEnd(22)} ${r.skipped}`);
    continue;
  }
  before += r.before;
  after += r.after;
  const kb = (n) => `${Math.round(n / 1024)} kB`;
  console.log(
    `${r.slug.padEnd(22)} ${r.size[0]}x${r.size[1]}  ${kb(r.before).padStart(9)} -> ${kb(r.after).padStart(7)}`
  );
}
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `\ntotal ${mb(before)} -> ${mb(after)}  (${Math.round((1 - after / before) * 100)}% smaller)`
);
