import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Material layer: subtle marble veining rendered with SVG turbulence.
 * Photography CDNs are unreachable from the build environment, so surfaces
 * carry the Italian mood through material instead: marble, plaster, grain.
 */
export function MarbleVeins({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        className
      )}
      preserveAspectRatio="xMidYMid slice"
    >
      <filter id="marble-veins">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.004 0.009"
          numOctaves="4"
          seed="11"
        />
        <feColorMatrix
          values="0 0 0 0 0.45
                  0 0 0 0 0.41
                  0 0 0 0 0.36
                  0 0 0 0.6 0"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#marble-veins)" />
    </svg>
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

/** A restrained gold rule used to open sections instead of eyebrow labels. */
export function GoldRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-px w-16 bg-accent/70', className)}
    />
  );
}
