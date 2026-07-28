import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { Grain, MarbleVeins } from './materials';

type Act = {
  time: string;
  title: string;
  body: string;
  surface: string;
  text: string;
  veined?: boolean;
};

const acts: Act[] = [
  {
    time: '10:00',
    title: 'Parata delle Regioni',
    body: 'Six regional troupes open the day with a costumed parade through the arcades.',
    surface: 'bg-secondary',
    text: 'text-secondary-foreground',
  },
  {
    time: '11:30',
    title: 'La Passerella',
    body: 'The senior batch walks a runway of Italian houses, styled and stitched in-house.',
    surface: 'bg-foreground',
    text: 'text-background',
  },
  {
    time: '13:00',
    title: 'Opera in Cortile',
    body: 'The chamber choir reworks Verdi and Puccini for a courtyard audience.',
    surface: 'bg-card',
    text: 'text-foreground',
    veined: true,
  },
  {
    time: '15:00',
    title: 'Tarantella',
    body: 'The troupe that made Ghoomar unforgettable at the first Flash learns the fastest dance in the south.',
    surface: 'bg-primary',
    text: 'text-primary-foreground',
  },
  {
    time: '16:30',
    title: 'Teatro di Strada',
    body: 'Living statues, commedia masks and street theatre roam between the stalls.',
    surface: 'bg-accent/15',
    text: 'text-foreground',
    veined: true,
  },
  {
    time: '18:00',
    title: 'Notte Italiana',
    body: 'The closing set: strings, lights and one last song over the piazza.',
    surface: 'bg-muted',
    text: 'text-foreground',
  },
];

/** `gap-5` on the track, in px: the only number the geometry needs from CSS. */
const GAP = 20;
/** Dwell on each act before the track moves on. */
const ROTATION_MS = 3000;

type Geometry = {
  /** One card plus its gap: the distance a single advance travels. */
  stride: number;
  /** Scroll offset of the first card, i.e. the track's leading padding. */
  start: number;
  /** Distance between one copy of the six acts and the next. */
  span: number;
};

/** Measure the track from the live DOM rather than restating Tailwind in JS. */
function geometryOf(el: HTMLElement): Geometry | null {
  const card = el.querySelector<HTMLElement>('article');
  if (!card) return null;
  const stride = card.clientWidth + GAP;
  return {
    stride,
    start: card.offsetLeft - el.offsetLeft,
    span: acts.length * stride,
  };
}

/**
 * Step back into the first copy of the acts so the track can keep travelling
 * in one direction for ever. Every copy is identical, so shifting by exactly
 * one span leaves the same pixels under the viewport: the jump is not a
 * rewind and cannot be seen, and it lands on a real snap point so scroll
 * snapping never fights it.
 */
function reenterLoop(el: HTMLElement, g: Geometry, dir: 1 | -1) {
  if (dir === 1 && el.scrollLeft >= g.start + g.span - 1) {
    el.scrollLeft -= g.span;
  } else if (dir === -1 && el.scrollLeft - g.stride < g.start - 1) {
    el.scrollLeft += g.span;
  }
}

export function Programme() {
  const track = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Auto-rotation yields to the visitor: any manual interaction holds it,
  // and it only ticks while the section is actually on screen.
  const holdUntil = useRef(0);
  // Reduced motion keeps the six acts exactly once and never advances them.
  const [looping] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [copies, setCopies] = useState(2);
  const sets = looping ? copies : 1;

  const advance = useCallback(
    (dir: 1 | -1, hold: number) => {
      const el = track.current;
      if (!el) return;
      const g = geometryOf(el);
      if (!g) return;
      if (hold) holdUntil.current = Date.now() + hold;
      if (looping) reenterLoop(el, g, dir);
      el.scrollBy({ left: dir * g.stride, behavior: 'smooth' });
    },
    [looping]
  );

  // A viewport wider than one copy would see past the end of the track at the
  // moment of the wrap, so wide screens carry a third copy. Resizes that do
  // not change the count re-render nothing.
  useEffect(() => {
    const el = track.current;
    if (!el || !looping) return;
    const measure = () => {
      const g = geometryOf(el);
      if (!g) return;
      setCopies(Math.max(2, Math.ceil(el.clientWidth / g.span) + 1));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [looping]);

  // Ambient rotation: one card every few seconds, for ever. Scroll-based (the
  // same snap track), so nothing shifts layout and nothing re-renders; the
  // timer exists only while the section is on screen and the tab is visible.
  useEffect(() => {
    const el = track.current;
    const section = sectionRef.current;
    if (!el || !section || !looping) return;

    let timer = 0;
    let visible = false;

    const tick = () => {
      if (Date.now() < holdUntil.current) return;
      advance(1, 0);
    };
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !timer) {
        timer = window.setInterval(tick, ROTATION_MS);
      } else if (!run && timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };

    // A cursor resting on the track parks the rotation entirely; wheel and
    // touch input hold it long enough to browse by hand.
    const park = () => {
      holdUntil.current = Number.MAX_SAFE_INTEGER;
    };
    const release = () => {
      holdUntil.current = Date.now() + 2000;
    };
    const hold = () => {
      holdUntil.current = Date.now() + 8000;
    };
    el.addEventListener('pointerenter', park);
    el.addEventListener('pointerleave', release);
    el.addEventListener('wheel', hold, { passive: true });
    el.addEventListener('touchstart', hold, { passive: true });
    document.addEventListener('visibilitychange', sync);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.35 }
    );
    observer.observe(section);

    return () => {
      if (timer) clearInterval(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      el.removeEventListener('pointerenter', park);
      el.removeEventListener('pointerleave', release);
      el.removeEventListener('wheel', hold);
      el.removeEventListener('touchstart', hold);
    };
  }, [advance, looping]);

  return (
    <section
      id="programma"
      ref={sectionRef}
      className="py-24 md:py-36"
      aria-labelledby="programma-heading"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div className="max-w-2xl">
            <h2
              id="programma-heading"
              className="font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
            >
              Il Programma
            </h2>
            <p className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
              Student performances run all day. These are the six you plan
              around.
            </p>
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              onClick={() => advance(-1, 8000)}
              aria-label="Previous performances"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => advance(1, 8000)}
              aria-label="Next performances"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>

      <div
        ref={track}
        className="mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:px-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: sets }).flatMap((_, copy) =>
          acts.map((act, i) => (
            <motion.article
              key={`${act.title}-${copy}`}
              aria-hidden={copy > 0 || undefined}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px -5% 0px 0px' }}
              transition={{
                duration: 0.7,
                delay: (i % 3) * 0.08,
                ease: EASE.out,
              }}
              className={cn(
                'group relative flex h-[420px] w-[300px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-lg p-8 transition-transform duration-500 ease-out hover:-translate-y-1 md:h-[460px] md:w-[340px]',
                act.surface,
                act.text
              )}
            >
              {act.veined && (
                <MarbleVeins className="opacity-[0.14] transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
              )}
              <Grain />
              <p className="relative font-body text-sm font-medium tabular-nums tracking-[0.18em] opacity-70">
                {act.time}
              </p>
              <div className="relative">
                <h3 className="font-display text-4xl font-medium leading-[1.05] tracking-tight">
                  {act.title}
                </h3>
                <p className="mt-4 font-body text-sm leading-relaxed opacity-80">
                  {act.body}
                </p>
              </div>
            </motion.article>
          ))
        )}
      </div>
    </section>
  );
}
