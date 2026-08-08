import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { InfiniteSlider } from '@/components/motion/infinite-slider';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';

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
 * array.
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

/** How many donors get a numbered place before the rest join the strip. */
const RANKED = 10;

/**
 * One place on the leaderboard.
 *
 * MEMOISED, and that is the whole reason it is a component rather than a
 * block of JSX inside the map. Adding a donor re-renders the section; without
 * this every existing row re-renders with it, and on a wall that is meant to
 * grow all season that is a cost that only goes up. With it, an arrival
 * renders one row.
 */
const Place = memo(function Place({
  rank,
  name,
  index,
}: {
  rank: number;
  name: string;
  index: number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{
        duration: 0.6,
        // Capped, so the fiftieth row is not still waiting three seconds in.
        delay: Math.min(index * 0.05, 0.45),
        ease: EASE.out,
      }}
      className="flex items-baseline gap-5 border-b border-border/50 py-4 last:border-b-0 md:gap-8"
    >
      <span
        aria-hidden="true"
        className={cn(
          'w-8 flex-none text-right font-display text-lg tabular-nums md:w-10 md:text-xl',
          // The first three are the accent; after that the numeral steps back
          // so the NAMES are what the eye runs down.
          rank <= 3 ? 'text-accent' : 'text-muted-foreground/70'
        )}
      >
        {String(rank).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1 font-display text-xl font-medium tracking-tight text-foreground md:text-2xl">
        <span className="sr-only">Number {rank}, </span>
        {name}
      </span>
    </motion.li>
  );
});

/** What the roll endpoint hands back, once. */
type RollState = { phase: 'loading' } | { phase: 'ready'; donors: string[] };

/**
 * The Donors Acknowledgement section: the leaderboard, or the invitation to
 * be on it.
 *
 * RANK AND NAME, AND NOTHING ELSE. The order comes from what people gave, but
 * the amounts never leave the server (see the roll in api/donate.ts) and no
 * figure appears here. Publishing who gave most is a thank you; publishing
 * what each of them gave is a different thing that nobody consented to.
 *
 * ONLY PUBLIC ACKNOWLEDGEMENTS REACH THIS COMPONENT, and not because it
 * filters them: the endpoint only ever selects rows whose donor chose to be
 * named. A donor who chose anonymity is not in the payload at all, so there
 * is no filtering step here to get wrong, and none to bypass by reading the
 * network tab.
 *
 * THE EMPTY STATE IS DYNAMIC. It is what the section shows while the roll is
 * genuinely empty, and it disappears the moment one qualifying donation
 * exists, because both come from the same fetch.
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

  /* NOTHING IS RENDERED UNTIL THE ANSWER IS IN, and this is also what keeps
     the section free of layout shift: the alternative is reserving space for
     a list whose length is not known yet, and any guess at that height is
     wrong for every case but one. The section sits below the fold, so the
     beat of quiet costs nothing. */
  if (state.phase === 'loading') return null;

  const { donors } = state;
  const ranked = donors.slice(0, RANKED);
  const rest = donors.slice(RANKED);

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
          <ol className="mx-auto mt-12 max-w-2xl px-6 md:mt-16 md:px-10">
            {ranked.map((name, i) => (
              <Place key={name} rank={i + 1} name={name} index={i} />
            ))}
          </ol>

          {/* EVERYONE ELSE, in the strip the section already had. A hundred
              numbered rows is a table nobody reads to the bottom of; the
              first ten are the leaderboard and the rest keep moving, which
              is how the wall grows all season without ever getting longer. */}
          {rest.length > 0 && (
            <>
              <p className="mx-auto mt-12 max-w-md px-6 text-center font-body text-xs uppercase tracking-[0.2em] text-muted-foreground">
                And with thanks to
              </p>
              <DonorScroller names={rest} className="mt-6" />
            </>
          )}

          <p className="mx-auto mt-12 max-w-md px-6 text-center font-body text-sm leading-relaxed text-muted-foreground">
            {donors.length === 1
              ? 'One donor, named here with their permission.'
              : `${donors.length} donors, named here with their permission.`}{' '}
            Every rupee goes to the causes the students chose.
          </p>
        </>
      ) : (
        <p className="mx-auto mt-8 max-w-lg px-6 text-center font-body text-base leading-relaxed text-muted-foreground">
          Donors who support Flash are acknowledged here by name. Anyone who
          chooses to give anonymously never appears, and no amounts are ever
          shown.
        </p>
      )}
    </motion.section>
  );
}
