import { type ReactNode } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { cn } from '@/utils/cn';

/**
 * Material layer: subtle marble veining rendered with SVG turbulence.
 * Photography CDNs are unreachable from the build environment, so surfaces
 * carry the Italian mood through material instead: marble, plaster, grain.
 *
 * The turbulence lives in `.marble-veins` (globals.css) as a background image
 * rather than as a <filter> in this tree — see the note there for why. Same
 * noise, same colour matrix, decoded once for the whole page instead of
 * re-rasterised per surface on every hover and scroll.
 */
export function MarbleVeins({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'marble-veins pointer-events-none absolute inset-0',
        className
      )}
    />
  );
}

/** Film-grain wash used sparingly to keep flat colour fields from feeling digital. */
export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'noise pointer-events-none absolute inset-0 opacity-[0.05]',
        className
      )}
    />
  );
}

/**
 * The portico arch: the site's single geometric motif, borrowed from the
 * Italian arcade. Content is clipped inside the arch silhouette.
 */
export function ArchFrame({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-t-[999px] border border-border',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Marble veil over a scroll film: a soft whitish wash whose strength is a
 * MotionValue driven by scrub progress, so the footage's own colour is
 * revealed as the reader advances. One system, shared by the hero film and
 * the ground film — pure opacity on a static gradient, so it composites on
 * the GPU without repaints.
 */
export function FilmVeil({
  opacity,
  className,
}: {
  opacity: MotionValue<number> | number;
  className?: string;
}) {
  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity }}
      className={cn(
        'absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.72)_38%,hsl(var(--background)/0.62)_62%,hsl(var(--background)/0.85)_100%)]',
        className
      )}
    />
  );
}

/** A restrained gold rule used to open sections instead of eyebrow labels. */
export function GoldRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-px w-16 bg-accent/70', className)}
    />
  );
}
