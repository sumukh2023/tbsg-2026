import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { Grain } from '../materials';

/**
 * `alt` never appears on screen. The plates carry no captions by design, so
 * this is purely the accessible name for the photograph.
 */
export type Photo = { alt: string; src?: string };

/** Matches Il Programma's cadence, so the site has one rhythm. */
const ROTATION_MS = 3000;
const GAP = 24;

type Geometry = { stride: number; start: number; span: number };

/** Measure from the live DOM rather than restating Tailwind in JS. */
function geometryOf(el: HTMLElement, count: number): Geometry | null {
  const plate = el.querySelector<HTMLElement>('figure');
  if (!plate) return null;
  const stride = plate.clientWidth + GAP;
  return { stride, start: plate.offsetLeft - el.offsetLeft, span: count * stride };
}

/**
 * Step back one whole copy so the track can travel one way for ever.
 *
 * Done BEFORE the scroll, never from an onScroll handler. Every copy is
 * identical, so shifting by exactly one span leaves the same pixels under the
 * viewport — the jump cannot be seen, and it lands on a real snap point, so
 * scroll snapping never fights it. Writing scrollLeft DURING a scroll is what
 * made the first version of this carousel stick: mandatory snapping pulled
 * every programmatic move straight back.
 */
function reenterLoop(el: HTMLElement, g: Geometry, dir: 1 | -1) {
  if (dir === 1 && el.scrollLeft >= g.start + g.span - 1) el.scrollLeft -= g.span;
  else if (dir === -1 && el.scrollLeft - g.stride < g.start - 1) el.scrollLeft += g.span;
}

/**
 * A continuously rotating strip built FOR PHOTOGRAPHS.
 *
 * Visually the opposite of Il Programma, which is a row of equal upright
 * cards: this runs wide cinematic plates and lets the centre one stand at
 * full strength while its neighbours sit back dimmed and slightly smaller.
 * Nothing is written under them. The photographs are the section, and a row
 * of captions would only ask the eye to leave them. Same 3s cadence, so the
 * page shares the site's pulse without repeating its look.
 *
 * The MECHANICS are Il Programma's, deliberately: several identical copies
 * laid end to end, wrapped by one span before each move so the jump lands on
 * a real snap point. That pattern is proven here and the alternative is not —
 * see reenterLoop.
 *
 * Native scrolling underneath means touch, trackpad and keyboard all work
 * without any code; the arrows are for pointers.
 */
export function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const track = useRef<HTMLDivElement>(null);
  const restart = useRef<() => void>(() => {});
  const [active, setActive] = useState(0);
  // Reduced motion keeps one copy and never advances it.
  const [looping] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [copies, setCopies] = useState(2);
  /** A pointer resting on the strip holds the rotation. See the track below. */
  const [hovering, setHovering] = useState(false);
  const sets = looping ? copies : 1;

  const advance = useCallback(
    (dir: 1 | -1, manual: boolean) => {
      const el = track.current;
      if (!el) return;
      const g = geometryOf(el, photos.length);
      if (!g) return;
      if (looping) reenterLoop(el, g, dir);
      el.scrollBy({ left: dir * g.stride, behavior: 'smooth' });
      // An arrow press re-phases the cadence so the next automatic move is a
      // full interval away rather than landing on top of the manual one.
      if (manual) restart.current();
    },
    [looping, photos.length]
  );

  // A viewport wider than one copy would see past the end of the track at the
  // moment of the wrap, so wide screens carry another copy.
  useEffect(() => {
    const el = track.current;
    if (!el || !looping) return;
    const measure = () => {
      const g = geometryOf(el, photos.length);
      if (!g) return;
      setCopies(Math.max(2, Math.ceil(el.clientWidth / g.span) + 1));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [looping, photos.length]);

  /**
   * Which plate is centred, for the dimming. READ ONLY — this handler must
   * never write scrollLeft, or it would fight the snap on every frame.
   */
  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const g = geometryOf(el, photos.length);
    if (!g) return;
    const centre = el.scrollLeft + el.clientWidth / 2 - g.start;
    const index = Math.round((centre - g.stride / 2) / g.stride);
    setActive(((index % photos.length) + photos.length) % photos.length);
  }, [photos.length]);

  /**
   * Ambient rotation, governed by three things and no others: the section is
   * on screen, the tab is in front, and no pointer is resting on the strip.
   *
   * WHEEL AND TOUCH ARE DELIBERATELY NOT AMONG THEM. Scrolling the PAGE past
   * the section fires both on the track, so hooking them parked Il Programma
   * long after the reader had moved on, and it looked broken. Hover is the
   * only one of the three that means what it appears to mean.
   */
  useEffect(() => {
    const el = track.current;
    if (!el || !looping) return;

    let timer = 0;
    let visible = false;
    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
    const sync = () => {
      const run = visible && !document.hidden && !hovering;
      if (run && !timer) timer = window.setInterval(() => advance(1, false), ROTATION_MS);
      else if (!run) stop();
    };
    restart.current = () => {
      if (!timer) return;
      stop();
      sync();
    };
    document.addEventListener('visibilitychange', sync);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
    // `hovering` is a dependency rather than a ref so the interval is torn
    // down and rebuilt around a pause, which also means the first automatic
    // move after the pointer leaves is a full interval away instead of
    // whatever was left of the one it interrupted.
  }, [advance, looping, hovering]);

  const arrow =
    'grid h-11 w-11 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.9, ease: EASE.out }}
      className="relative"
    >
      <div
        ref={track}
        onScroll={onScroll}
        role="group"
        aria-roledescription="carousel"
        aria-label="Rangeelo Rajasthan photographs"
        tabIndex={0}
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden',
          /* HALF A PLATE OF PADDING AT EACH END, matching the plate width at
             every breakpoint. Without it the first plate cannot be CENTRED —
             there is nothing to its left to scroll past — so mandatory
             snapping put the first snap position half a viewport short of a
             full stride, and the opening move travelled 304px where every
             later one travelled 568. That short first step is the jolt on the
             first transition. With the padding, every plate including the
             first can sit in the middle, so every step is one stride.

             NO scroll-smooth HERE. reenterLoop rewinds the track by a whole
             copy with a direct write to scrollLeft, and the whole point of
             that write is that it is INSTANT and therefore invisible.
             `scroll-behavior: smooth` turns it into an animation, and the
             carousel visibly glides backwards through a copy every time it
             wraps. The deliberate moves pass `behavior: smooth` to scrollBy
             themselves, so nothing is lost. Il Programma never set it. */
          'px-[max(0px,calc(50%-39vw))] sm:px-[max(0px,calc(50%-26vw))] lg:px-[max(0px,calc(50%-19vw))] xl:px-[max(0px,calc(50%-17rem))]'
        )}
        style={{ gap: GAP }}
        /* POINTER ONLY. Hovering holds the rotation so a reader looking at a
           photograph does not have it taken away, and it is bound to
           mouseenter rather than wheel or touch on purpose: those fire while
           the PAGE is scrolled past the section, which is what parked Il
           Programma long after the reader had moved on. A pointer resting on
           the strip is unambiguous. */
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {Array.from({ length: sets }).flatMap((_, copy) =>
          photos.map((photo, i) => {
            const isActive = i === active;
            return (
              <figure
                key={`${copy}-${photo.alt}`}
                aria-hidden={copy > 0}
                className="w-[78vw] flex-none snap-center sm:w-[52vw] lg:w-[38vw] xl:w-[34rem]"
              >
                <div
                  className={cn(
                    'relative aspect-[16/10] overflow-hidden rounded-lg border border-border transition-[transform,opacity,box-shadow] duration-700 ease-out',
                    isActive
                      ? 'opacity-100 shadow-[0_30px_70px_-40px_hsl(var(--foreground)/0.55)]'
                      : 'scale-[0.955] opacity-55'
                  )}
                >
                  {photo.src ? (
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      role="img"
                      aria-label={photo.alt}
                      className="absolute inset-0 bg-secondary/60"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(65%_60%_at_50%_25%,hsl(var(--accent)/0.18),transparent_75%)]" />
                      <Grain className="opacity-[0.06]" />
                    </div>
                  )}
                  {/* A whisper of the page's ground along the lower edge, so a
                      photograph sits in the page instead of on it. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-background/25"
                  />
                </div>
              </figure>
            );
          })
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          aria-label="Previous photograph"
          onClick={() => advance(-1, true)}
          className={arrow}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next photograph"
          onClick={() => advance(1, true)}
          className={arrow}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <p className="ml-2 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {String(active + 1).padStart(2, '0')} /{' '}
          {String(photos.length).padStart(2, '0')}
        </p>
      </div>
    </motion.div>
  );
}
