import { useMemo, type ElementType, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';

/**
 * One-time device quality probe for expensive surface effects. Phones,
 * low-core/low-memory devices and data-saver sessions get the "lite" tier:
 * thinner blur radii and fewer composited layers, same design language.
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
  children?: ReactNode;
};

/**
 * Liquid glass surface: a Framer Motion element carrying the layered
 * translucent material (backdrop blur + gradient hairline border + specular
 * sheen + soft lift, defined in globals.css). Quality adapts per device via
 * useGlassQuality, so the same component is convincing on desktop and
 * smooth on mobile. Accepts every motion prop — animate, layout, exit —
 * so open/close and resize choreography lives at the call site.
 */
export function LiquidGlass<T extends GlassTag = 'div'>({
  as,
  variant = 'elevated',
  className,
  children,
  ...rest
}: LiquidGlassProps<T>) {
  const quality = useGlassQuality();
  const Component = motion[(as ?? 'div') as GlassTag] as ElementType;
  return (
    <Component
      className={cn(
        variant === 'panel' ? 'liquid-glass-panel' : 'liquid-glass-elevated',
        quality === 'lite' && 'glass-lite',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
