import {
  useEffect,
  useMemo,
  useRef,
  type ElementType,
  type ReactNode,
} from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from 'framer-motion';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';

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
  /** Edge lensing band, identical across engines (full tier only). */
  refract?: boolean;
  /** Cursor/scroll-reactive specular highlight (fine pointers, full tier). */
  interactive?: boolean;
  /** One-shot light sweep when the surface mounts (drawers, popovers). */
  sheen?: boolean;
  children?: ReactNode;
};

/**
 * The living highlight: a soft light blob that drifts almost imperceptibly
 * with page scroll and leans toward the cursor while it hovers the surface.
 * Transform/opacity only, springed, so it never repaints the glass.
 */
function SpecularLayer({ root }: { root: React.RefObject<HTMLElement> }) {
  const px = useMotionValue(48);
  const py = useMotionValue(0);
  const opacity = useMotionValue(0.4);
  const sx = useSpring(px, { stiffness: 120, damping: 22, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 120, damping: 22, mass: 0.6 });
  const sOpacity = useSpring(opacity, { stiffness: 140, damping: 26 });

  const { scrollY } = useScroll();
  const driftX = useTransform(scrollY, (v) => Math.cos(v / 720) * 8);
  const driftY = useTransform(scrollY, (v) => Math.sin(v / 480) * 6);
  const x = useTransform<number, number>([sx, driftX], ([a, b]) => a + b);
  const y = useTransform<number, number>([sy, driftY], ([a, b]) => a + b);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Rest slot: upper-left third of the surface, where the ambient light sits.
    const rest = () => {
      px.set(el.offsetWidth * 0.3);
      py.set(0);
      opacity.set(0.4);
    };
    rest();

    let rect: DOMRect | null = null;
    const onEnter = () => {
      rect = el.getBoundingClientRect();
      opacity.set(0.75);
    };
    const onMove = (event: PointerEvent) => {
      if (!rect) rect = el.getBoundingClientRect();
      px.set(event.clientX - rect.left);
      py.set(event.clientY - rect.top);
    };
    const onLeave = () => {
      rect = null;
      rest();
    };
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [root, px, py, opacity]);

  return (
    <motion.span
      aria-hidden="true"
      className="lg-specular"
      style={{ x, y, opacity: sOpacity }}
    />
  );
}

/**
 * Liquid glass surface: a Framer Motion element carrying the layered
 * translucent material (low-tint backdrop, gradient hairline ring, rim
 * refraction, grain, dynamic specular — defined in globals.css). Quality
 * adapts per device via useGlassQuality, so the same component is
 * convincing on desktop and smooth on mobile. Accepts every motion prop —
 * animate, layout, exit — so open/close choreography lives at the call site.
 */
export function LiquidGlass<T extends GlassTag = 'div'>({
  as,
  variant = 'elevated',
  refract = true,
  interactive = true,
  sheen = false,
  className,
  children,
  ...rest
}: LiquidGlassProps<T>) {
  const quality = useGlassQuality();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const finePointer = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    []
  );
  const Component = motion[(as ?? 'div') as GlassTag] as ElementType;

  const full = quality === 'full';
  const showSpecular =
    interactive && full && finePointer && !reduce && variant === 'elevated';

  return (
    <Component
      ref={rootRef}
      className={cn(
        variant === 'panel' ? 'liquid-glass-panel' : 'liquid-glass-elevated',
        quality === 'lite' && 'glass-lite',
        variant === 'panel' && 'relative overflow-hidden',
        className
      )}
      {...rest}
    >
      {full && refract && <span aria-hidden="true" className="lg-refract" />}
      {full && <span aria-hidden="true" className="lg-noise" />}
      {showSpecular && <SpecularLayer root={rootRef} />}
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

/** Glass navigation bar; refraction off by default (a full-width band is
    the one place the rim treatment stops being restrained). */
export function LiquidGlassNavbar({
  className,
  ...props
}: Without<LiquidGlassProps<'nav'>, 'as' | 'variant'>) {
  return (
    <LiquidGlass
      as="nav"
      variant="panel"
      refract={false}
      interactive={false}
      className={className}
      {...props}
    />
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
