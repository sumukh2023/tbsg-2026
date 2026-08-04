# Retired: the scroll-scrub films

Both scroll-scrubbed videos were retired from the landing page on
**4 August 2026**. This directory holds the exact code that ran, so they can
be put back without archaeology.

| File | Was |
| --- | --- |
| `ScrollHero.tsx` | `src/components/ScrollHero.tsx` — the scrub engine |
| `engine.ts` | `src/utils/engine.ts` — per-browser scrub tuning |
| `Hero.tsx` | `src/festival/Hero.tsx` — the "Namma Mia Carpisa" hero, scrubbed |
| `GroundFilm.tsx` | `src/festival/GroundFilm.tsx` — "Il campo diventa la piazza" |

## Restore

```bash
npm run scrub:restore
```

That copies all four files back to the paths above and prints the three edits
`src/App.tsx` needs. It refuses to overwrite anything without `--force`, and it
verifies the two engine files against the blob hashes below before copying, so
a restore is either exactly the build that was verified on real hardware or a
loud failure.

## Why these files, and why the hashes matter

`ScrollHero.tsx` and `engine.ts` are the most fragile code this project has
ever had. Their behaviour was confirmed **on real Apple hardware** (macOS
Safari, iPhone, iPadOS) plus Chrome, Edge and Firefox on 2 August 2026, at
commit `1680fd8`. An earlier attempt to "optimise" the Safari seek guard
passed every gate here and still broke Safari on every device, because the
sandbox has no Apple browser to test against.

The copies in this directory are byte-identical to that verified build:

```
ScrollHero.tsx   b3ac2dd26b58c154ce2f621d55763f6146bbdfc0
engine.ts        df2f2b16b0c8cf5fc10ab1d60cdf9a27571d460a
```

Check at any time with `git hash-object retired/scrub/ScrollHero.tsx`.

**Do not "improve" either file without a real Apple device to test on.** See
the SETUP A notes and gotcha 8 in `CONTEXT.md`.

## What replaced them

- The hero film is now `src/festival/Hero.tsx`, built on `HeroFilm`: the same
  full-bleed picture and the same "Namma Mia Carpisa" reveal, but it simply
  autoplays and loops instead of seeking a playhead from scroll position.
- `GroundFilm` has no replacement. The section was removed.

The media are untouched: `public/hero.mp4`, `hero.webm`, `hero-mobile.mp4`,
`ground.mp4`, `ground.webm`, `ground-mobile.mp4` are all still in the repo, so
a restore needs no asset work.

This directory is outside the build, the typecheck and the lint path, exactly
like `examples/`. Nothing in `src/` may import from it.
