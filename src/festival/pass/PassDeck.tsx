import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { PassCard, type PassData } from '../getpasses/PassCard';
import { printPass, printPasses } from '../getpasses/printPass';

/**
 * Every pass in a booking, as a deck you move through.
 *
 * A booking is now several passes rather than one, and a vertical list of
 * four full passes is a page nobody scrolls to the bottom of. A deck keeps
 * one pass at full strength with its neighbours visible at the edges, so it
 * is obvious there are others without any of them competing.
 *
 * THE SCROLLER IS NATIVE. Swipe, trackpad, and the scrollbar all work
 * because they are the browser's, not ours: the only JavaScript here moves
 * the scroll position when a button or an arrow key asks. Reimplementing
 * momentum is how a carousel ends up feeling worse than the platform's, and
 * `scroll-snap` gives the settling behaviour for free.
 *
 * WHY NOT FRAMER FOR THE TRACK. Dragging a motion.div would have meant
 * owning inertia, rubber-banding and the wheel, on a page that a phone
 * reaches over mobile data at a gate. Snap points cost nothing per frame.
 */
export function PassDeck({
  passes,
  checkedInAt,
}: {
  passes: PassData[];
  /** Per pass, keyed by token: when it was checked in, if it was. */
  checkedInAt: Record<string, string | null>;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [printing, setPrinting] = useState(false);

  /** Which card is under the middle of the viewport. */
  const measure = useCallback(() => {
    const node = track.current;
    if (!node) return;
    const middle = node.scrollLeft + node.clientWidth / 2;
    const cards = [...node.children] as HTMLElement[];
    let nearest = 0;
    let best = Infinity;
    cards.forEach((card, i) => {
      const centre = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(centre - middle);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  const go = useCallback(
    (index: number) => {
      const node = track.current;
      if (!node) return;
      const card = node.children[
        Math.max(0, Math.min(index, passes.length - 1))
      ] as HTMLElement | undefined;
      card?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    },
    [passes.length]
  );

  /* Arrow keys, but only while the deck has focus. Bound to the track rather
     than the window so they do not steal the arrow keys from the rest of the
     page, which is what makes a carousel feel like it has taken the page
     hostage. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(active + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(active - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      go(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      go(passes.length - 1);
    }
  };

  useEffect(() => {
    measure();
  }, [measure, passes.length]);

  const single = passes.length === 1;

  return (
    <div className="mb-16">
      {/* Where you are in the deck, and how to leave it. Above the cards so
          it does not move as the deck scrolls. */}
      {!single && (
        <div className="mb-5 flex items-center justify-between gap-4">
          <p
            aria-live="polite"
            className="font-body text-sm text-muted-foreground"
          >
            <span className="tabular-nums text-foreground">
              {String(active + 1).padStart(2, '0')}
            </span>
            {' / '}
            <span className="tabular-nums">
              {String(passes.length).padStart(2, '0')}
            </span>
            <span className="ml-3 hidden sm:inline">
              {passes[active]?.guestName}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <DeckButton
              label="Previous pass"
              onClick={() => go(active - 1)}
              disabled={active === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </DeckButton>
            <DeckButton
              label="Next pass"
              onClick={() => go(active + 1)}
              disabled={active === passes.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </DeckButton>
          </div>
        </div>
      )}

      <div
        ref={track}
        onScroll={measure}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`${passes.length} ${passes.length === 1 ? 'pass' : 'passes'}. Use the left and right arrow keys to move between them.`}
        className={cn(
          'flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background',
          // The scrollbar is noise under a deck of cards; the buttons and
          // the counter say everything it would have.
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          single ? 'justify-center' : 'px-[max(0px,calc(50%-11rem))]'
        )}
      >
        {passes.map((pass, i) => (
          <motion.div
            key={pass.token}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: Math.min(i * 0.06, 0.3),
              ease: EASE.out,
            }}
            className={cn(
              'w-[19rem] flex-none snap-center transition-[opacity,transform] duration-500 ease-out sm:w-[21rem]',
              // The neighbours sit back rather than disappear: the deck has
              // to look like a deck, or the counter is the only clue.
              i === active ? 'opacity-100' : 'scale-[0.96] opacity-55'
            )}
          >
            <PassCard pass={pass} />

            <div className="mt-3 flex items-center justify-between gap-3">
              <StatusChip
                status={pass.status}
                checkedInAt={checkedInAt[pass.token] ?? null}
              />
              <button
                type="button"
                onClick={() => void printPass(pass)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-4 py-2 font-body text-xs font-medium text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Printer aria-hidden="true" className="h-3.5 w-3.5" />
                Print
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {!single && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={printing}
            onClick={async () => {
              setPrinting(true);
              try {
                await printPasses(passes);
              } finally {
                setPrinting(false);
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-7 py-3 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Printer aria-hidden="true" className="h-4 w-4" />
            {printing
              ? 'Preparing'
              : `Print all ${passes.length} passes`}
          </button>
        </div>
      )}
    </div>
  );
}

function DeckButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/**
 * Active or checked in, said plainly.
 *
 * A checked-in pass is not an error and must not look like one: it is the
 * normal end state of a pass that worked. Green for a pass still to be used,
 * a quiet neutral for one that already has been.
 */
function StatusChip({
  status,
  checkedInAt,
}: {
  status?: string;
  checkedInAt: string | null;
}) {
  const used = status === 'checked_in' || Boolean(checkedInAt);
  const cancelled = status === 'cancelled';
  const when = checkedInAt
    ? new Date(checkedInAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs',
        cancelled
          ? 'bg-destructive/10 text-destructive'
          : used
            ? 'bg-foreground/[0.07] text-muted-foreground'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          cancelled
            ? 'bg-destructive'
            : used
              ? 'bg-muted-foreground'
              : 'bg-emerald-500'
        )}
      />
      {cancelled
        ? 'Cancelled'
        : used
          ? when
            ? `Checked in ${when}`
            : 'Checked in'
          : 'Active'}
    </span>
  );
}
