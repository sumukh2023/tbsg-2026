import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { InfiniteSlider } from '@/components/motion/infinite-slider';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { SUPPORT_PATH } from '../pages/chapters';

/**
 * A wall of donor names that never stops moving.
 *
 * BUILT ON `InfiniteSlider`, the same motion primitive the Live Updates
 * ticker runs on, so the site has one left-to-right scroller rather than two
 * that drift apart. It animates a single transform on one element with
 * Framer's `animate`, which the compositor can carry on its own thread: no
 * layout is read per frame, nothing reflows, and a list of four hundred names
 * costs the same per frame as a list of four. That is what keeps it smooth on
 * a phone, where a scroll-position-driven marquee stutters.
 *
 * REUSABLE ON PURPOSE. It takes names and nothing else, so a future wall of
 * volunteers, alumni or partner schools is this component with a different
 * array. `DonorAcknowledgement` below is the piece wired to the donations
 * table; this one knows nothing about where names come from.
 */
export function DonorScroller({
  names,
  className,
  speed = 26,
  reverse = false,
}: {
  names: string[];
  className?: string;
  /** Pixels per second. Slow: this is read, not skimmed past. */
  speed?: number;
  reverse?: boolean;
}) {
  /* THE STRIP NEEDS ENOUGH TO FILL THE SCREEN TWICE OVER.
     InfiniteSlider loops by translating one copy of its children by half the
     measured width, so with three names on a wide screen the wrap is visible
     as a gap sliding past. Repeating a short list until it comfortably
     exceeds a wide viewport costs a few spans and removes the seam. */
  const runs = Math.max(1, Math.ceil(14 / Math.max(names.length, 1)));
  const strip = Array.from({ length: runs }, () => names).flat();

  return (
    <div
      className={cn('relative', className)}
      /* The edges fade into the page instead of ending at a hard boundary,
         so names arrive and leave rather than appearing and vanishing. */
      style={{
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        maskImage:
          'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
      }}
    >
      <InfiniteSlider gap={72} speed={speed} speedOnHover={8} reverse={reverse}>
        {strip.map((name, i) => (
          <span
            /* Index in the key, deliberately: the same name legitimately
               appears more than once across the repeated runs. */
            key={`${name}-${i}`}
            className="whitespace-nowrap font-display text-2xl font-medium tracking-tight text-foreground/85 sm:text-3xl md:text-4xl"
          >
            {name}
          </span>
        ))}
      </InfiniteSlider>
    </div>
  );
}

/** What the roll endpoint hands back, once. */
type RollState =
  | { phase: 'loading' }
  | { phase: 'ready'; donors: string[] };

/**
 * The Donors Acknowledgement section: the wall, or the invitation to be on
 * it.
 *
 * THE EMPTY STATE IS THE COMMON ONE TODAY and is written as an invitation
 * rather than an apology. Only gifts marked paid appear (see the roll in
 * api/donate.ts), and until the office marks them or a gateway does, there
 * are none. "No donors yet" would read as a failure; asking to be the first
 * name on the wall reads as the ask it is.
 */
export function DonorAcknowledgement() {
  const [state, setState] = useState<RollState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/donate')
      .then((r) => (r.ok ? r.json() : { donors: [] }))
      .catch(() => ({ donors: [] }))
      .then((data) => {
        if (cancelled) return;
        const donors = Array.isArray(data?.donors)
          ? data.donors.filter((n: unknown): n is string => typeof n === 'string')
          : [];
        setState({ phase: 'ready', donors });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing is rendered until the answer is in. A wall that appears as the
  // invitation and then swaps to names a moment later is worse than a beat
  // of quiet, and the section sits below the fold either way.
  if (state.phase === 'loading') return null;

  const { donors } = state;

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.9, ease: EASE.out }}
      aria-labelledby="donors-heading"
      className="border-t border-border/60 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 text-center md:px-10">
        <p className="font-body text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Con Gratitudine
        </p>
        <h2
          id="donors-heading"
          className="mt-4 font-display text-3xl font-medium leading-[1.15] tracking-tight sm:text-4xl md:text-5xl"
        >
          {donors.length ? (
            <>
              Flash is built by{' '}
              <span className="italic text-primary">the people who give</span>
            </>
          ) : (
            <>
              This wall is waiting for{' '}
              <span className="italic text-primary">its first name</span>
            </>
          )}
        </h2>
      </div>

      {donors.length > 0 ? (
        <>
          <DonorScroller names={donors} className="mt-12 md:mt-16" />
          <p className="mx-auto mt-12 max-w-md px-6 text-center font-body text-sm leading-relaxed text-muted-foreground">
            {donors.length === 1
              ? 'One donor, named here with their permission.'
              : `${donors.length} donors, named here with their permission.`}{' '}
            Every rupee goes to the causes the students chose.
          </p>
        </>
      ) : (
        <p className="mx-auto mt-8 max-w-lg px-6 text-center font-body text-base leading-relaxed text-muted-foreground">
          Donors who support Flash are acknowledged here by name. Give today
          and yours is the first one the piazza reads.
        </p>
      )}

      <div className="mt-10 flex justify-center px-6">
        <Link
          to={SUPPORT_PATH}
          className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        >
          Donate now
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </motion.section>
  );
}
