import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Building2,
  Landmark,
  Palette,
  Plane,
  Sparkles,
  Theater,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { FACET_LABELS, type FacetKind, type PlacedPlace } from './places';

/**
 * The journal entry for one place.
 *
 * NOT a modal, per the brief and for a better reason: a modal takes the page
 * away, and the point of this exhibit is that you are standing in front of a
 * map. The card floats beside the country with the map still visible and
 * still lit, and anything outside it closes it.
 *
 * On a phone the same content arrives as a bottom sheet, because a floating
 * card on a 390px screen IS a modal whatever it is called.
 *
 * ICONS. The brief lists emoji for the seven sections. These are lucide
 * instead — the same set the rest of the site uses, and what this project's
 * own design database asks for in as many words: "No emojis as icons (use
 * SVG)". Emoji are a different typeface on every platform, they carry their
 * own colour, and three of the seven render as flat monochrome glyphs on
 * Windows. On a page trying to look like a museum label that is the one
 * detail that would give it away.
 */
const FACET_ICON: Record<FacetKind, LucideIcon> = {
  history: Landmark,
  art: Palette,
  architecture: Building2,
  cuisine: UtensilsCrossed,
  festivals: Theater,
  fact: Sparkles,
  travel: Plane,
};

const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const;

export function PlaceCard({
  place,
  variant,
  onClose,
}: {
  place: PlacedPlace;
  variant: 'floating' | 'sheet';
  onClose: () => void;
}) {
  const still = useReducedMotion();
  const [open, setOpen] = useState<FacetKind | null>(place.facets[0]?.kind ?? null);
  const ref = useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves into the card so a keyboard reader is not
  // left behind on the map.
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sheet = variant === 'sheet';

  return (
    <motion.div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label={`${place.name}, ${place.epithet}`}
      onClick={(event) => event.stopPropagation()}
      initial={
        still
          ? { opacity: 0 }
          : sheet
            ? { opacity: 0, y: 40 }
            : { opacity: 0, y: 26, scale: 0.92 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        still
          ? { opacity: 0 }
          : sheet
            ? { opacity: 0, y: 40 }
            : { opacity: 0, y: 14, scale: 0.96 }
      }
      transition={{ duration: still ? 0.15 : 0.52, ease: EASE_OUT_QUART }}
      className={cn(
        'relative overflow-hidden text-left shadow-[0_28px_70px_-24px_rgba(35,28,20,0.6)] focus:outline-none',
        // 22px, as asked. No border: the shadow and the glass do the
        // separating, and a hairline on top of both is what makes a card look
        // like a div.
        'rounded-[22px]',
        sheet
          ? 'max-h-[78dvh] w-full overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)]'
          : 'max-h-[72vh] w-[22rem] max-w-[calc(100vw-3rem)] overflow-y-auto'
      )}
    >
      <Backdrop place={place} still={Boolean(still)} />

      {/* The glass. Sitting over the plate rather than under it, so the
          colour of the place shows through the type. */}
      <div className="relative z-10 backdrop-blur-xl backdrop-saturate-125">
        <div className="bg-[hsl(40_47%_97%/0.82)] px-6 pb-6 pt-6 md:px-7">
          {sheet && (
            <div
              aria-hidden="true"
              className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground/20"
            />
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-4xl font-medium leading-none tracking-tight text-foreground">
                {place.name}
              </h3>
              <p className="mt-2 font-body text-xs uppercase tracking-[0.2em] text-accent">
                {place.epithet}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${place.name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground/5 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
            {place.lede}
          </p>

          {place.landmarks && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {place.landmarks.map((landmark) => (
                <li
                  key={landmark}
                  className="rounded-full bg-foreground/[0.06] px-3 py-1 font-body text-[0.68rem] text-foreground/75"
                >
                  {landmark}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 divide-y divide-foreground/10 border-t border-foreground/10">
            {place.facets.map((facet) => {
              const Icon = FACET_ICON[facet.kind];
              const isOpen = open === facet.kind;
              return (
                <div key={facet.kind}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : facet.kind)}
                    aria-expanded={isOpen}
                    className="group flex w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isOpen ? 'text-accent' : 'text-foreground/45'
                      )}
                    />
                    <span
                      className={cn(
                        'flex-1 font-body text-sm transition-colors',
                        isOpen ? 'text-foreground' : 'text-foreground/70'
                      )}
                    >
                      {FACET_LABELS[facet.kind]}
                    </span>
                    <motion.span
                      aria-hidden="true"
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT_QUART }}
                      className="font-body text-lg leading-none text-foreground/40"
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.38, ease: EASE_OUT_QUART }}
                        className="overflow-hidden"
                      >
                        <p className="pb-4 pl-7 pr-2 font-body text-[0.82rem] leading-relaxed text-muted-foreground">
                          {facet.body}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * The plate behind the card.
 *
 * NO PHOTOGRAPH SHIPS WITH THIS. There is no licensed image of the Colosseum
 * at sunset in this repository, no image generator reachable from a cloud
 * session, and a scraped one would be someone else's copyright on a school's
 * public site. So each place gets a plate built from its own two colours —
 * Rome's terracotta and burnt umber, Venice's lagoon blue-green — under the
 * same slow Ken Burns drift a photograph would have had.
 *
 * The seam for the real thing is one field: give a place a `photo` and it is
 * used instead, lazily, with the plate behind it as the colour that shows
 * while it loads. Nothing else changes.
 */
function Backdrop({ place, still }: { place: PlacedPlace; still: boolean }) {
  const [from, to] = place.palette;
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-[-8%]"
        style={{
          background: `radial-gradient(120% 90% at 20% 15%, ${from} 0%, ${to} 62%, #1B140E 100%)`,
        }}
        animate={still ? undefined : { scale: [1, 1.12, 1], x: [0, -10, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Readability. The glass above is translucent, and without this the
          card's body text would sit on whatever the plate happens to be
          doing. */}
      <div className="absolute inset-0 bg-[hsl(38_38%_94%/0.55)]" />
    </div>
  );
}
