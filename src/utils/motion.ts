import type { Variants, Transition } from 'framer-motion';

/**
 * Shared motion tokens so every animation in the app feels consistent.
 * Tweak these once and the whole site re-tunes.
 */
export const EASE = {
  /** Smooth, slightly snappy — the default for most UI. */
  out: [0.22, 1, 0.36, 1],
  /** Gentle in-out for looping / ambient motion. */
  inOut: [0.65, 0, 0.35, 1],
  /** A subtle spring-like overshoot. */
  spring: [0.34, 1.56, 0.64, 1],
} as const;

export const DURATION = {
  fast: 0.35,
  base: 0.6,
  slow: 0.9,
} as const;

/**
 * Viewport rule for every scroll reveal on the site.
 *
 * `amount` rather than `margin` on purpose. An asymmetric margin like
 * '-15% 0px' puts the enter threshold and the leave threshold at different
 * places on the screen, so a section appears at one point on the way down and
 * disappears at another on the way up — which is exactly what made the
 * reverse pass feel less considered than the forward one. A fraction of the
 * element is symmetric by construction: the same crossing, both directions.
 */
export const REVEAL_VIEWPORT = { once: false, amount: 0.25 } as const;

/**
 * Transition for those reveals. `inOut` rather than `out`: an ease-out curve
 * played backwards is an ease-in, so a reveal tuned to feel right on the way
 * down feels wrong on the way up. A symmetric curve reads identically in both
 * directions, which is the whole point of a reversible animation.
 */
export const REVEAL_TRANSITION: Transition = {
  duration: DURATION.slow,
  ease: EASE.inOut,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 18,
  mass: 0.9,
};

type Direction = 'up' | 'down' | 'left' | 'right';

const offset = (direction: Direction, distance: number) => {
  switch (direction) {
    case 'up':
      return { y: distance };
    case 'down':
      return { y: -distance };
    case 'left':
      return { x: distance };
    case 'right':
      return { x: -distance };
  }
};

/** Build a reveal variant in any direction with configurable distance. */
export const reveal = (
  direction: Direction = 'up',
  distance = 24,
  duration = DURATION.base
): Variants => ({
  hidden: { opacity: 0, ...offset(direction, distance) },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration, ease: EASE.out },
  },
});

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.base, ease: EASE.out },
  },
};

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.base, ease: EASE.out },
  },
};

/** Parent that staggers its children. Pair with `childVariants`. */
export const containerVariants = (
  stagger = 0.08,
  delayChildren = 0
): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const childVariants: Variants = reveal('up', 20);
