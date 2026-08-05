/**
 * Generates `src/festival/italia/geometry.ts` — the Italy outline and the
 * projection that puts a marker on it.
 *
 *   npm i --no-save world-atlas topojson-client
 *   node scripts/make-italy-map.mjs
 *
 * A one-off authoring tool. Neither package is a dependency of this project;
 * the OUTPUT is committed, so a normal install and build never touch them.
 *
 * Why generate rather than draw: a hand-drawn Italy is a drawing, and a
 * drawing has no coordinate system. Every marker on it would then be placed
 * by eye, and "Florence is a bit above Rome and slightly left" is how a map
 * ends up with Pisa in the Adriatic. Projecting a real boundary means the
 * outline and the markers come out of the SAME transform, so a city sits
 * where its latitude and longitude say it does, and the outline is Italy's
 * actual coastline rather than an impression of it.
 *
 * Web Mercator, because it is what every map anyone has ever looked at uses
 * and Italy at this scale shows no visible distortion.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { feature } from 'topojson-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/festival/italia');

const world = JSON.parse(
  readFileSync(
    join(ROOT, 'scripts/node_modules/world-atlas/countries-10m.json'),
    'utf8'
  )
);
const countries = feature(world, world.objects.countries);
const italy = countries.features.find((f) => f.properties.name === 'Italy');
if (!italy) throw new Error('Italy not found in world-atlas');

/** Web Mercator, in unit space. */
const mercator = ([lon, lat]) => [
  (lon * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + ((lat * Math.PI) / 180) / 2)),
];

/** Every ring of the country, mainland and islands alike. */
function rings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  return geometry.coordinates.flat();
}

const all = rings(italy.geometry);

/** Shoelace, on projected coordinates. */
const ringArea = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
};

// Rings are filtered BEFORE the box is fitted. Italy's territory runs down to
// Lampedusa, closer to Africa than to Sicily, and a handful of islets sit far
// enough out that including them in the bounds pads the composition with an
// eighth of a frame of empty sea to hold three specks nobody can see. The
// fit is of the country people picture.
const projectedRings = all
  .map((ring) => ring.map(mercator))
  .filter((ring) => ringArea(ring) > 1e-5);

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const ring of projectedRings) {
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

/**
 * A portrait box, because Italy is portrait. The height is the anchor and the
 * width follows from the country's own aspect, so nothing is stretched: the
 * brief asks for the exact outline and a squeezed Italy is a different
 * country.
 */
const HEIGHT = 1000;
const PAD = 8;
const aspect = (maxX - minX) / (maxY - minY);
const WIDTH = Math.round(HEIGHT * aspect);
const scale = (HEIGHT - PAD * 2) / (maxY - minY);

// Mercator's y grows northward and SVG's grows downward, hence maxY - y.
const toSvg = ([lon, lat]) => {
  const [x, y] = mercator([lon, lat]);
  return [(x - minX) * scale + PAD, (maxY - y) * scale + PAD];
};

/**
 * Douglas-Peucker. 10m detail is roughly 40,000 points for Italy, which is a
 * quarter-megabyte of path data for a shape drawn 500px tall — every bay
 * rendered at a fraction of a pixel. This keeps the silhouette people
 * recognise and drops the rest.
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const sqTol = tolerance * tolerance;
  const sqSegDist = (p, a, b) => {
    let [x, y] = a;
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) [x, y] = b;
      else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let index = -1;
    let maxSq = sqTol;
    for (let i = first + 1; i < last; i++) {
      const sq = sqSegDist(points[i], points[first], points[last]);
      if (sq > maxSq) {
        index = i;
        maxSq = sq;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (n) => Math.round(n * 10) / 10;

// In SVG units now. Sicily and Sardinia are orders of magnitude above this;
// what it removes is Elba-sized and smaller, which at the drawn size reads as
// dirt on the screen rather than as land.
const MIN_AREA = 40;

const paths = [];
for (const ring of projectedRings) {
  const projected = simplify(
    ring.map(([x, y]) => [(x - minX) * scale + PAD, (maxY - y) * scale + PAD]),
    1.1
  );
  if (projected.length < 4 || ringArea(projected) < MIN_AREA) continue;
  paths.push(
    'M' +
      projected
        .map(([x, y]) => `${round(x)} ${round(y)}`)
        .join('L') +
      'Z'
  );
}
paths.sort((a, b) => b.length - a.length);

const file = `/**
 * GENERATED by \`node scripts/make-italy-map.mjs\` — do not edit by hand.
 *
 * Italy's real boundary (Natural Earth 1:10m via world-atlas), Web Mercator,
 * simplified to the silhouette anyone would recognise and fitted to a
 * portrait box. \`project\` is the SAME transform the outline came out of, so
 * a marker given a real latitude and longitude lands where it belongs
 * instead of where it looked about right.
 */

export const VIEW_WIDTH = ${WIDTH};
export const VIEW_HEIGHT = ${HEIGHT};

/** Mainland first, then Sicily, Sardinia and the larger islands. */
export const ITALY_PATHS: readonly string[] = [
${paths.map((p) => `  '${p}',`).join('\n')}
];

const MIN_X = ${minX};
const MAX_Y = ${maxY};
const SCALE = ${scale};
const PAD = ${PAD};

/** Degrees to the coordinate space of ITALY_PATHS. */
export function project(lat: number, lon: number): { x: number; y: number } {
  const x = (lon * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + ((lat * Math.PI) / 180) / 2));
  return {
    x: (x - MIN_X) * SCALE + PAD,
    y: (MAX_Y - y) * SCALE + PAD,
  };
}
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'geometry.ts'), file);
console.log(
  `geometry.ts: ${paths.length} rings, viewBox 0 0 ${WIDTH} ${HEIGHT}, ` +
    `${(file.length / 1024).toFixed(1)}kB`
);
