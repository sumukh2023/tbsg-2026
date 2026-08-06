import { cn } from '@/utils/cn';
import { SEAGULL_PATHS, SEAGULL_VIEWBOX } from './seagull-path';

/**
 * The Brigade Schools seagull.
 *
 * TRACED FROM THE ARTWORK, NOT DRAWN BY EYE. The previous mark was a
 * hand-written bezier approximation of the logo and it had the wings wrong.
 * `scripts/make-seagull-mark.mjs` reads `public/logo.png`, finds the white
 * silhouette, walks its outline and simplifies it, so what ships is the
 * school's own shape rather than an impression of one. Re-run that script if
 * the artwork is ever replaced.
 *
 * THE COLOUR IS FIXED and does not inherit. It is an institutional mark: it
 * belongs to the school, not to the festival's palette, so it must not
 * re-tint itself per district the way the site's own branding does, and it
 * must not change colour on hover. The link around it in the navigation keeps
 * its focus ring and now fades slightly instead; the bird stays the bird.
 */

/** The school's blue. Not a theme token, deliberately: see above. */
export const BRIGADE_BLUE = '#2B6686';

export function CarnivalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={SEAGULL_VIEWBOX}
      aria-hidden="true"
      className={cn(className)}
      fill={BRIGADE_BLUE}
    >
      {SEAGULL_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
