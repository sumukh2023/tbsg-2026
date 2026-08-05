import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ItalyMap } from './ItalyMap';
import { PlaceMarker } from './PlaceMarker';
import { PlaceCard } from './PlaceCard';
import { PLACES } from './places';

/**
 * L'Italia — why the theme is Italian, told by letting people find out.
 *
 * This replaced Il Mercato, which was a heading, a paragraph and a marquee of
 * dish names. The food street still exists; it lives on /stalls, where
 * someone looking for it will look.
 *
 * THE SHAPE OF THE INTERACTION. Nothing is on the map when the page loads —
 * no markers, no labels, just a country. It is a shape you recognise, and
 * recognising it is the invitation. Move onto it and the outline takes a gold
 * edge, then sixteen places arrive one after another. That order matters: the
 * reward for looking comes before the information, which is what makes it an
 * exhibit rather than a diagram.
 *
 * Waking is on hover, focus OR the map coming into view on a touch device,
 * because a phone has no hover and a map that never fills in is a bug to
 * whoever is holding it.
 */
export function Italia() {
  const [awake, setAwake] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // The sheet is for touch-sized screens; the floating card needs room beside
  // the map to float in.
  const compact = useMediaQuery('(max-width: 1023px)');

  const open = useMemo(
    () => PLACES.find((p) => p.slug === openSlug) ?? null,
    [openSlug]
  );

  const wake = useCallback(() => setAwake(true), []);

  const explore = useCallback(() => {
    setAwake(true);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <section
      id="italia"
      aria-labelledby="italia-heading"
      className="relative overflow-hidden border-y border-border/70 bg-secondary/30 py-24 md:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-14 px-6 md:px-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
        {/* ---- the wall label ------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
        >
          <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Why Italy
          </p>
          <TextEffect
            as="h2"
            per="word"
            preset="fade-in-blur"
            delay={0.1}
            className="mt-4 font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
          >
            L&rsquo; Italia
          </TextEffect>
          <p className="mt-6 max-w-md font-body text-base leading-relaxed text-muted-foreground">
            Discover the inspiration behind Flash @ Brigade 2026 by exploring
            Italy&rsquo;s timeless cities, architecture, culture and traditions.
          </p>
          <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
            A carnival needed somewhere to be, and Italy is the country that
            invented the idea that a square is where a town happens. Sixteen
            places, each with something worth knowing.
          </p>

          <button
            type="button"
            onClick={explore}
            className="group mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-7 py-3 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            Explore Italy
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          </button>
        </motion.div>

        {/* ---- the exhibit ---------------------------------------------- */}
        {/* FOCUSABLE ITSELF, and that is not decoration.
            The markers do not exist until the exhibit is woken, so before
            waking there is nothing inside here for Tab to land on — a
            keyboard user tabbed straight past the whole section and could
            never open anything. This gives the map one stop of its own:
            reaching it wakes it, and the next Tab is Rome. */}
        <div
          ref={mapRef}
          tabIndex={0}
          role="group"
          aria-label="Interactive map of Italy. Continue with Tab to move between places, Enter to open one."
          className="relative rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          onMouseEnter={wake}
          onFocus={wake}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.1, ease: EASE.out }}
            /* On touch there is no hover to wake it, so coming into view
               does. `once` so it never re-fires on the way back up. */
            onViewportEnter={() => {
              if (compact) wake();
            }}
            /* When a card opens the country steps aside rather than being
               covered by it. A panel that hides the exhibit it belongs to is
               a modal with extra steps; this keeps both on screen, which is
               the whole reason the card floats instead of opening one. */
            animate={
              open && !compact
                ? { opacity: 1, scale: 0.88, x: -110 }
                : { opacity: 1, scale: 1, x: 0 }
            }
            className="relative mx-auto w-full max-w-[30rem] lg:max-w-none"
          >
            <ItalyMap
              awake={awake}
              className="h-[52vh] w-full touch-pan-y md:h-[60vh] lg:h-[68vh]"
            >
              <AnimatePresence>
                {awake &&
                  PLACES.map((place, i) => (
                    <PlaceMarker
                      key={place.slug}
                      place={place}
                      index={i}
                      open={openSlug === place.slug}
                      hovered={hovered === place.slug}
                      onHover={setHovered}
                      onOpen={(slug) =>
                        setOpenSlug((current) => (current === slug ? null : slug))
                      }
                    />
                  ))}
              </AnimatePresence>
            </ItalyMap>

            {!awake && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="pointer-events-none absolute inset-x-0 bottom-0 text-center font-body text-xs uppercase tracking-[0.22em] text-muted-foreground"
              >
                Move over the map
              </motion.p>
            )}
          </motion.div>

          {/* The card, floating beside the country on a desktop. Clicking
              anywhere off it closes it — including back onto the map. */}
          <AnimatePresence>
            {open && !compact && (
              <div
                className="absolute -right-6 top-1/2 z-20 -translate-y-1/2 xl:-right-16"
                onClick={() => setOpenSlug(null)}
              >
                <PlaceCard
                  place={open}
                  variant="floating"
                  onClose={() => setOpenSlug(null)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* The same card as a sheet, on anything without room to float one. */}
      <AnimatePresence>
        {open && compact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setOpenSlug(null)}
            className="fixed inset-0 z-50 flex items-end bg-foreground/25 backdrop-blur-[2px]"
          >
            <PlaceCard
              place={open}
              variant="sheet"
              onClose={() => setOpenSlug(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
