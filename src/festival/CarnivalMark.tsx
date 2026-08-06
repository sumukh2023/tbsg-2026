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
 * THE COLOUR FOLLOWS `currentColor`, as it did before the shape was fixed.
 * That is what lets the mark read as ink on the marble day theme and as
 * marble on the evening one, take each district's own tint, and shift with
 * the navigation link on hover. Only the SHAPE changed here; the behaviour
 * around it is deliberately the behaviour that was already there.
 */

/** The school's blue, as the favicons use it. Kept for the icon generator. */
export const BRIGADE_BLUE = '#2B6686';

export function CarnivalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={SEAGULL_VIEWBOX}
      aria-hidden="true"
      className={cn('fill-current', className)}
    >
      {SEAGULL_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
