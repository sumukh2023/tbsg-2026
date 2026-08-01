import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_TRANSITION, REVEAL_VIEWPORT } from '@/utils/motion';
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
  // Visibility is the ONLY thing that governs the rotation. Hovering, wheeling
  // over the track or touching it does not hold it: those hooks made the
  // carousel look broken, because scrolling the page past the section fires
  // wheel/touch events on the track and parked it until well after the reader
  // had stopped scrolling.
  const restart = useRef<() => void>(() => {});
  // Reduced motion keeps the six acts exactly once and never advances them.
  const [looping] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [copies, setCopies] = useState(2);
  const sets = looping ? copies : 1;

  const advance = useCallback(
    (dir: 1 | -1, manual: boolean) => {
      const el = track.current;
      if (!el) return;
      const g = geometryOf(el);
      if (!g) return;
      if (looping) reenterLoop(el, g, dir);
      el.scrollBy({ left: dir * g.stride, behavior: 'smooth' });
      // An arrow press re-times the cadence so the next automatic move is a
      // full interval away instead of landing on top of the manual one. The
      // rotation is never suspended, only re-phased.
      if (manual) restart.current();
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
  // same snap track), so nothing shifts layout and nothing re-renders. The
  // timer exists exactly while the section is on screen and the tab is
  // visible — it keeps running throughout a scroll, under the cursor, and
  // under a finger, and it is never held back by any of them.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !looping) return;

    let timer = 0;
    let visible = false;

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !timer)
        timer = window.setInterval(() => advance(1, false), ROTATION_MS);
      else if (!run) stop();
    };
    // Re-phase without pausing: drop the pending tick and start a fresh full
    // interval from now.
    restart.current = () => {
      if (!timer) return;
      stop();
      sync();
    };

    document.addEventListener('visibilitychange', sync);

    // Any sliver of the section counts as visible: the rotation is running
    // from the moment the section enters the viewport, not once it is a third
    // of the way up it, and it stops only when the section has fully left.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0 }
    );
    observer.observe(section);

    return () => {
      stop();
      restart.current = () => {};
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
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
          viewport={REVEAL_VIEWPORT}
          transition={REVEAL_TRANSITION}
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
              onClick={() => advance(-1, true)}
              aria-label="Previous performances"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => advance(1, true)}
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
        // `overflow-x-auto` alone computes overflow-y to `auto` as well, which
        // quietly made the track a vertical scroll container with 16px of
        // travel — enough for a vertical swipe on an iPad to be swallowed by
        // the carousel instead of moving the page. Pinning overflow-y closes
        // it; pt-2 gives the hover lift room so nothing is clipped, and the
        // outer margin drops by the same 8px so the layout is unchanged.
        // overscroll-x-contain keeps a horizontal swipe from chaining out to
        // the browser's back gesture.
        className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-6 pb-4 pt-2 [scrollbar-width:none] md:px-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: sets }).flatMap((_, copy) =>
          acts.map((act, i) => (
            <motion.article
              key={`${act.title}-${copy}`}
              aria-hidden={copy > 0 || undefined}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              // Deliberately one-shot, unlike every other section: the loop
              // relies on each copy of the acts rendering identically, and a
              // card that re-runs its entrance every time the rotation carries
              // it across the viewport edge would make the wrap visible.
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
