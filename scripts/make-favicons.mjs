/**
 * Regenerates every favicon asset in `public/` from ONE source of truth: the
 * seagull path in `src/festival/CarnivalMark.tsx`, which is the same mark the
 * navigation draws. Run it if the mark ever changes.
 *
 *   npx playwright@1 install chromium   # once, if you do not have it
 *   node scripts/make-favicons.mjs
 *
 * A one-off authoring tool, NOT part of the build: Playwright is the
 * rasteriser and it is deliberately not a dependency of this project. The
 * outputs are committed, so a normal `npm install && npm run build` never
 * needs any of this.
 *
 * What it emits and why each one exists:
 *
 *   favicon.svg          the modern tab icon. Transparent, and it carries its
 *                        own `prefers-color-scheme` rule so the bird is brand
 *                        blue on a light tab strip and white on a dark one.
 *   favicon.ico          16/32/48. Safari and several crawlers request
 *                        `/favicon.ico` from the site root whether or not the
 *                        document declares an icon, and on this site a MISSING
 *                        one does not 404: vercel.json's SPA catch-all answers
 *                        it with index.html, HTTP 200, text/html. A browser
 *                        handed an HTML document where it asked for an image
 *                        draws a blank — which is the white box this file
 *                        exists to stop.
 *   favicon-96.png       transparent PNG fallback for browsers that take a
 *                        PNG over an SVG.
 *   apple-touch-icon.png 180, OPAQUE, with padding. iOS composites the home
 *                        screen icon on BLACK where it is transparent and
 *                        rounds the corners itself, so this one keeps the
 *                        blue field and holds the bird away from the edges.
 *   icon-192/512.png     transparent, for site.webmanifest.
 *   mask-icon.svg        Safari pinned tabs: a single monochrome path, no
 *                        fill, tinted by the `color` attribute on the link.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

/** Sampled off the previous favicon, so the branding survives regeneration. */
const BLUE = '#2B6686';
const WHITE = '#FFFFFF';

/** Lifted from the component rather than duplicated by hand. */
function seagullPath() {
  const src = readFileSync(join(ROOT, 'src/festival/CarnivalMark.tsx'), 'utf8');
  const d = src.match(/<path\s+d="([\s\S]*?)"/);
  if (!d) throw new Error('Could not find the seagull path in CarnivalMark.tsx');
  return d[1].replace(/\s+/g, ' ').trim();
}

const PATH = seagullPath();

/**
 * The mark is a wide, landscape shape and an icon is a square, so it has to be
 * fitted rather than stretched. Measuring the real bounding box beats guessing
 * at one: a bezier's control points sit outside the ink it actually lays down.
 */
async function fitted(page, { size, pad, fill, background }) {
  return page.evaluate(
    ({ d, size, pad, fill, background }) => {
      const NS = 'http://www.w3.org/2000/svg';
      const probe = document.createElementNS(NS, 'svg');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      probe.appendChild(p);
      document.body.appendChild(probe);
      const b = p.getBBox();
      probe.remove();

      const inner = size * (1 - 2 * pad);
      const scale = Math.min(inner / b.width, inner / b.height);
      const tx = (size - b.width * scale) / 2 - b.x * scale;
      const ty = (size - b.height * scale) / 2 - b.y * scale;
      const bg = background
        ? `<rect width="${size}" height="${size}" fill="${background}"/>`
        : '';
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
        bg,
        `<path transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)})" d="${d}" fill="${fill}"/>`,
        `</svg>`,
      ].join('');
    },
    { d: PATH, size, pad, fill, background }
  );
}

async function rasterise(page, svg, size, { opaque = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg}`
  );
  return page.locator('svg').screenshot({ omitBackground: !opaque });
}

/**
 * An .ico is a tiny directory followed by its images. PNG entries have been
 * legal since Vista and are read by every browser this site supports, so each
 * size goes in as the PNG we already have rather than as a BMP with an
 * inverted mask.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dir = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...images.map((i) => i.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

// The tab icon, as a vector. Two fills, chosen by the tab strip's own theme.
const tabSvg = await fitted(page, { size: 512, pad: 0.06, fill: BLUE });
writeFileSync(
  join(PUBLIC, 'favicon.svg'),
  tabSvg.replace(
    '<path',
    `<style>@media (prefers-color-scheme: dark){path{fill:${WHITE}}}</style><path`
  ) + '\n'
);

// Safari pinned tab: one path, no fill of its own.
const maskSvg = await fitted(page, { size: 512, pad: 0.06, fill: 'black' });
writeFileSync(join(PUBLIC, 'mask-icon.svg'), maskSvg + '\n');

const transparent = [];
for (const size of [16, 32, 48, 96, 192, 512]) {
  // Small sizes get less padding, or the bird is a smudge at 16px.
  const pad = size <= 48 ? 0.02 : 0.06;
  const svg = await fitted(page, { size, pad, fill: BLUE });
  transparent.push({ size, data: await rasterise(page, svg, size) });
}
const bySize = Object.fromEntries(transparent.map((i) => [i.size, i.data]));
writeFileSync(join(PUBLIC, 'favicon-96.png'), bySize[96]);
writeFileSync(join(PUBLIC, 'icon-192.png'), bySize[192]);
writeFileSync(join(PUBLIC, 'icon-512.png'), bySize[512]);
writeFileSync(
  join(PUBLIC, 'favicon.ico'),
  ico(transparent.filter((i) => i.size <= 48))
);

// iOS home screen: opaque, and generously padded because the system rounds
// the corners off whatever it is given.
const appleSvg = await fitted(page, {
  size: 180,
  pad: 0.12,
  fill: WHITE,
  background: BLUE,
});
writeFileSync(
  join(PUBLIC, 'apple-touch-icon.png'),
  await rasterise(page, appleSvg, 180, { opaque: true })
);

await browser.close();
console.log('favicons written to public/');
