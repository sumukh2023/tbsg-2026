import { motion, useTransform, type MotionValue } from 'framer-motion';
import { ScrollHero } from '@/components/ScrollHero';
import { Grain } from './materials';

/**
 * The second drone film: the main ground itself, scrubbed by scroll as the
 * last daylight passage before the page turns to evening.
 */
function Caption({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.12, 0.32, 0.66, 0.86], [0, 1, 1, 0]);
  const y = useTransform(progress, [0.12, 0.86], [28, -28]);
  // Full marble cover at both ends of the runway: before the film pins
  // (and after it releases) the section reads as plain page, so there is
  // never a hard video rectangle under the FAQ or against the statistics.
  const coverOpacity = useTransform(
    progress,
    [0, 0.1, 0.88, 1],
    [1, 0, 0, 1]
  );

  return (
    <>
      {/* Light marble wash so the film reads as part of the page, not a cut. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.6)_0%,hsl(var(--background)/0.28)_35%,hsl(var(--background)/0.22)_65%,hsl(var(--background)/0.6)_100%)]"
      />
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
        <div className="relative px-6 pb-16 md:px-16 md:pb-20">
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
      <ScrollHero src="/ground.mp4" webmSrc="/ground.webm" heightVh={380}>
        {(progress) => <Caption progress={progress} />}
      </ScrollHero>
    </section>
  );
}
