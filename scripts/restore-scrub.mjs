/**
 * Put the retired scroll-scrub films back.
 *
 *   npm run scrub:restore            # copy the files back
 *   npm run scrub:restore -- --force # ...overwriting whatever is there now
 *
 * Copies the four files out of `retired/scrub/` to the paths they used to
 * occupy, then prints the edits `src/App.tsx` still needs. It will not
 * silently clobber existing work, and it verifies the two engine files
 * against the blob hashes of the build that was confirmed on real Apple
 * hardware before copying anything — so a restore is either that exact build
 * or a loud failure. See retired/scrub/README.md.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');

const FILES = [
  { from: 'retired/scrub/ScrollHero.tsx', to: 'src/components/ScrollHero.tsx' },
  { from: 'retired/scrub/engine.ts', to: 'src/utils/engine.ts' },
  { from: 'retired/scrub/Hero.tsx', to: 'src/festival/Hero.tsx' },
  { from: 'retired/scrub/GroundFilm.tsx', to: 'src/festival/GroundFilm.tsx' },
];

/**
 * The device-verified blobs (commit 1680fd8, checked on macOS Safari, iPhone
 * and iPadOS on 2 Aug 2026). Git's blob hash: sha1 over "blob <len>\0<bytes>".
 */
const VERIFIED = {
  'retired/scrub/ScrollHero.tsx': 'b3ac2dd26b58c154ce2f621d55763f6146bbdfc0',
  'retired/scrub/engine.ts': 'df2f2b16b0c8cf5fc10ab1d60cdf9a27571d460a',
};

const blobHash = (path) => {
  const body = readFileSync(path);
  return createHash('sha1')
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest('hex');
};

let stop = false;

for (const [rel, expected] of Object.entries(VERIFIED)) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`  MISSING  ${rel}`);
    stop = true;
    continue;
  }
  const actual = blobHash(path);
  if (actual === expected) {
    console.log(`  verified ${rel}`);
  } else {
    console.error(`  CHANGED  ${rel}`);
    console.error(`           expected ${expected}`);
    console.error(`           found    ${actual}`);
    console.error(
      '           This is no longer the build that was tested on an Apple device.'
    );
    stop = true;
  }
}

if (stop) {
  console.error('\nRefusing to restore. See retired/scrub/README.md.\n');
  process.exit(1);
}

const clashes = FILES.filter(({ to }) => existsSync(join(root, to)));
if (clashes.length && !force) {
  console.error('\nThese already exist:');
  for (const { to } of clashes) console.error(`  ${to}`);
  console.error('\nRe-run with --force to overwrite them.\n');
  process.exit(1);
}

console.log('');
for (const { from, to } of FILES) {
  mkdirSync(dirname(join(root, to)), { recursive: true });
  copyFileSync(join(root, from), join(root, to));
  console.log(`  restored ${to}`);
}

console.log(`
Files are back. Three edits remain, all in src/App.tsx:

  1. The hero currently imports the autoplay version from the same path, so
     nothing to change there — src/festival/Hero.tsx is now the scrub one
     again. Check the import still reads:

         import { Hero } from './festival/Hero';

  2. Re-add the ground film import:

         import { GroundFilm } from './festival/GroundFilm';

  3. Put the section back into HomePage, between <Domande /> and the
     "#sera" dusk block:

         <Domande />
         <GroundFilm />
         <div id="sera" ...>

Then: npm run build && npm run typecheck && npm run lint

And test the result on a REAL Apple device before pushing. The one change to
this engine that passed every gate here still broke Safari everywhere.
`);
