import { useMemo, type ElementType, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';

/**
 * One-time device quality probe for expensive surface effects. Phones,
 * low-core/low-memory devices and data-saver sessions get the "lite" tier:
 * thinner blur radii, same design language.
 * (`prefers-reduced-transparency` is handled separately, in CSS.)
 */
export function useGlassQuality(): 'full' | 'lite' {
  return useMemo(() => {
    if (typeof window === 'undefined') return 'full';
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const small = window.matchMedia('(max-width: 767px)').matches;
    const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
    const lowMem = (nav.deviceMemory ?? 8) <= 4;
    const saveData = nav.connection?.saveData === true;
    return small || lowCpu || lowMem || saveData ? 'lite' : 'full';
  }, []);
}

type GlassTag = 'div' | 'button' | 'aside' | 'section' | 'nav';

export type LiquidGlassProps<T extends GlassTag = 'div'> = Omit<
  HTMLMotionProps<T>,
  'children'
> & {
  /** Rendered element; always a Framer Motion component underneath. */
  as?: T;
  /**
   * `elevated` — a floating dark capsule/control over page content.
   * `panel` — a large translucent sheet (drawers, dialogs) on page tokens.
   */
  variant?: 'elevated' | 'panel';
  /** One-shot light sweep when the surface mounts (drawers, popovers). */
  sheen?: boolean;
  children?: ReactNode;
};

/**
 * Liquid glass surface: a Framer Motion element carrying the translucent
 * material (black tint over backdrop blur + hairline rim, defined in
 * globals.css — identical on every engine). Quality adapts per device via
 * useGlassQuality, so the same component is convincing on desktop and
 * smooth on mobile. Accepts every motion prop — animate, layout, exit —
 * so open/close choreography lives at the call site.
 */
export function LiquidGlass<T extends GlassTag = 'div'>({
  as,
  variant = 'elevated',
  sheen = false,
  className,
  children,
  ...rest
}: LiquidGlassProps<T>) {
  const quality = useGlassQuality();
  const reduce = useReducedMotion();
  const Component = motion[(as ?? 'div') as GlassTag] as ElementType;

  return (
    <Component
      className={cn(
        variant === 'panel' ? 'liquid-glass-panel' : 'liquid-glass-elevated',
        quality === 'lite' && 'glass-lite',
        variant === 'panel' && 'relative overflow-hidden',
        className
      )}
      {...rest}
    >
      {sheen && !reduce && (
        <motion.span
          aria-hidden="true"
          className="lg-sheen"
          initial={{ x: '-160%', opacity: 0 }}
          animate={{ x: '420%', opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, delay: 0.25, ease: EASE.inOut }}
        />
      )}
      {children}
    </Component>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable liquid-glass primitives. Compose these instead of         */
/*  restating surface styles at call sites.                            */
/* ------------------------------------------------------------------ */

type Without<T, K extends keyof T> = Omit<T, K>;

/** Floating glass action capsule (the Live Updates control, CTAs over film). */
export function LiquidGlassButton({
  className,
  ...props
}: Without<LiquidGlassProps<'button'>, 'as' | 'variant'>) {
  return (
    <LiquidGlass
      as="button"
      variant="elevated"
      className={cn(
        'min-h-11 cursor-pointer rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  );
}

/** Glass pill hosting a horizontally scrolling strip (tickers, marquees). */
export function LiquidGlassTicker({
  className,
  ...props
}: Without<LiquidGlassProps<'button'>, 'as' | 'variant'>) {
  return (
    <LiquidGlass
      as="button"
      variant="elevated"
      className={cn(
        'min-h-10 cursor-pointer rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  );
}

/** Standalone glass content card on page tokens. */
export function LiquidGlassCard({
  className,
  ...props
}: Without<LiquidGlassProps<'div'>, 'as'>) {
  return (
    <LiquidGlass
      as="div"
      variant="panel"
      className={cn('rounded-2xl', className)}
      {...props}
    />
  );
}

/** Large glass sheet for dialogs and drawers; sweeps light once on open. */
export function LiquidGlassModal({
  className,
  ...props
}: Without<LiquidGlassProps<'aside'>, 'as' | 'variant'>) {
  return (
    <LiquidGlass
      as="aside"
      variant="panel"
      sheen
      role="dialog"
      aria-modal="true"
      className={className}
      {...props}
    />
  );
}

/** Glass navigation bar. */
export function LiquidGlassNavbar({
  className,
  ...props
}: Without<LiquidGlassProps<'nav'>, 'as' | 'variant'>) {
  return (
    <LiquidGlass as="nav" variant="panel" className={className} {...props} />
  );
}

/** Small floating glass surface anchored to a control. */
export function LiquidGlassPopover({
  className,
  ...props
}: Without<LiquidGlassProps<'div'>, 'as' | 'variant'>) {
  return (
    <LiquidGlass
      as="div"
      variant="elevated"
      sheen
      className={cn('rounded-2xl', className)}
      {...props}
    />
  );
}
