import { useEffect } from 'react';
import {
  motion,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ScrollHero } from '@/components/ScrollHero';
import { setLiveChromeReceded } from './live/live-visibility';
import { FilmVeil, Grain } from './materials';

/**
 * The second drone film: the main ground itself, scrubbed by scroll as the
 * last daylight passage before the page turns to evening. Same treatment as
 * the hero: a soft whitish marble veil opens the passage, then thins with
 * scroll progress until the footage carries its own colour and detail.
 */
function Caption({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(
    progress,
    [0.12, 0.32, 0.66, 0.86],
    [0, 1, 1, 0]
  );
  const y = useTransform(progress, [0.12, 0.86], [28, -28]);
  // The shared marble veil (FilmVeil, same gradient as the hero) starts at
  // full strength — the whitish atmospheric introduction — and eases down as
  // the reader scrubs deeper, revealing the ground's true colour. It breathes
  // back up slightly at the end so the hand-off to the dusk chapter is soft.
  const veilOpacity = useTransform(
    progress,
    [0, 0.14, 0.55, 0.82, 1],
    [1, 0.85, 0.35, 0.18, 0.3]
  );
  // Full marble cover at both ends of the runway: before the film pins
  // (and after it releases) the section reads as plain page, so there is
  // never a hard video rectangle under the FAQ or against the statistics.
  const coverOpacity = useTransform(progress, [0, 0.1, 0.88, 1], [1, 0, 0, 1]);

  // While the film is actively scrubbed the floating Live Updates chrome
  // recedes so the caption stays fully readable; it fades back the moment
  // the scrub completes (both directions).
  useMotionValueEvent(progress, 'change', (v) => {
    setLiveChromeReceded(v > 0.04 && v < 0.96);
  });
  useEffect(() => () => setLiveChromeReceded(false), []);

  return (
    <>
      <FilmVeil opacity={veilOpacity} />
      <motion.div
        aria-hidden="true"
        style={{ opacity: coverOpacity }}
        className="absolute inset-0 bg-background"
      />
      <Grain />

      <motion.div
        style={{ opacity, y }}
        className="relative z-10 flex h-full items-end"
      >
        <div className="relative px-6 pb-[max(4rem,env(safe-area-inset-bottom))] md:px-16 md:pb-20">
          {/* Local scrim travels with the caption so the words stay legible
              even once the veil has thinned to nearly nothing. */}
          <div
            aria-hidden="true"
            className="absolute -inset-x-16 -inset-y-10 bg-[radial-gradient(60%_70%_at_30%_60%,hsl(var(--background)/0.75),transparent_75%)]"
          />
          <p className="relative font-display text-4xl font-medium italic leading-[1.1] tracking-tight text-foreground md:text-6xl">
            Il campo diventa la piazza.
          </p>
          <p className="relative mt-3 max-w-sm font-body text-sm leading-relaxed text-muted-foreground md:text-base">
            The main ground, waiting for 14 November.
          </p>
        </div>
      </motion.div>
    </>
  );
}

export function GroundFilm() {
  return (
    <section aria-label="The main ground">
      <ScrollHero
        src="/ground.mp4"
        webmSrc="/ground.webm"
        mobileSrc="/ground-mobile.mp4"
        heightVh={380}
      >
        {(progress) => <Caption progress={progress} />}
      </ScrollHero>
    </section>
  );
}
