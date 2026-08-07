import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CATEGORIES, countFor, type Category, type Photo } from './photos';
import { Plate } from './Plate';

/**
 * Deal photographs into balanced columns.
 *
 * WHY NOT CSS `columns`. Multi-column fills top to bottom and then wraps,
 * so the reading order down a column is 1, 2, 3 and the order ACROSS is
 * nonsense; worse, removing an item on a filter change re-flows every column
 * at once, which is the jump this wall exists to avoid. Assigning here means
 * the order is left to right, the columns end level, and a filter change is a
 * new list rather than a re-flow.
 *
 * Balanced by HEIGHT, not by count: a column of three portraits is taller
 * than a column of three panoramas, and matching counts would leave one
 * column hanging well below the others.
 */
function deal(photos: Photo[], columns: number): Photo[][] {
  const buckets: Photo[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);
  for (const photo of photos) {
    let shortest = 0;
    for (let i = 1; i < columns; i += 1) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    buckets[shortest].push(photo);
    // Height per unit of width, which is all that matters for balance.
    heights[shortest] += photo.height / photo.width;
  }
  return buckets;
}

/**
 * The main wall: every photograph, filtered by category.
 *
 * THE FILTER DOES NOT ANIMATE POSITIONS. Framer's layout projection on a
 * masonry grid means every surviving plate animates to a new column while
 * new ones fade in, which is a lot of simultaneous transforms and reads as
 * churn rather than as elegance. Instead the wall cross-fades: the outgoing
 * set leaves together, the incoming set arrives with a short stagger. Two
 * properties, no layout read, steady at 60fps on a phone.
 */
export function MasonryWall({
  photos,
  onOpen,
}: {
  photos: Photo[];
  /** Given the photograph and the list it was filtered into. */
  onOpen: (photo: Photo, within: Photo[]) => void;
}) {
  const [active, setActive] = useState<Category | 'All'>('All');
  const wide = useMediaQuery('(min-width: 1024px)');
  const medium = useMediaQuery('(min-width: 640px)');
  const columns = wide ? 3 : medium ? 2 : 1;

  /* ONLY PHOTOGRAPHS THAT EXIST REACH THE WALL.
     A plate with no file is a legitimate thing in section 02, where it is
     part of a story and carries a caption saying what is coming. Here it
     would be a hole in an archive AND a dead control: the lightbox can only
     open a photograph, so clicking one did nothing at all. The chip counts
     already count only real files, so this also makes the wall agree with
     the number printed on the chip that filtered it. */
  const available = useMemo(() => photos.filter((p) => p.src), [photos]);
  const shown = useMemo(
    () =>
      active === 'All'
        ? available
        : available.filter((p) => p.categories.includes(active)),
    [available, active]
  );
  const dealt = useMemo(() => deal(shown, columns), [shown, columns]);

  return (
    <div>
      <div
        role="group"
        aria-label="Filter photographs by subject"
        className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2.5"
      >
        <Chip
          label="All"
          count={available.length}
          active={active === 'All'}
          onClick={() => setActive('All')}
        />
        {CATEGORIES.map((category) => {
          const count = countFor(category, photos);
          return (
            <Chip
              key={category}
              label={category}
              count={count}
              active={active === category}
              /* A CHIP WITH NOTHING BEHIND IT IS NOT CLICKABLE. Leaving it
                 live would let a reader land on an empty wall and read it as
                 a broken filter; showing the count instead says plainly that
                 the photographs are still coming. */
              disabled={count === 0}
              onClick={() => setActive(category)}
            />
          );
        })}
      </div>

      <div className="mt-12 md:mt-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${active}-${columns}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            className="flex items-start gap-4 md:gap-6"
          >
            {dealt.map((column, c) => (
              <div key={c} className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6">
                {column.map((photo, i) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.6,
                      // Down each column rather than across, so the wall
                      // assembles the way the eye reads it.
                      delay: Math.min(i * 0.07 + c * 0.04, 0.5),
                      ease: EASE.out,
                    }}
                  >
                    <Plate
                      photo={photo}
                      onOpen={() => onOpen(photo, shown)}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </motion.div>
                ))}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-full border px-5 py-2 font-body text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background/60 text-foreground hover:border-accent hover:text-accent',
        disabled && 'cursor-not-allowed opacity-40 hover:border-border hover:text-foreground'
      )}
    >
      {label}
      <span
        className={cn(
          'font-body text-[0.7rem] tabular-nums',
          active ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  );
}
