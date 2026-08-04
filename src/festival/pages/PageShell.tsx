import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { SiteNav } from '../SiteNav';
import { SiteFooter } from '../SiteFooter';
import { FilmVeil, Grain, MarbleVeins } from '../materials';
import { LiveUpdates } from '../live/LiveUpdates';
import type { Chapter } from './chapters';

/**
 * The frame every page of the site outside the landing page sits in:
 * navigation, a cinematic hero, the content, and the shared footer.
 *
 * `data-chapter` on the wrapper is the whole colour mechanism. It swaps the
 * CSS variables (globals.css) for that district, so every component inside —
 * buttons, cards, rules, glass — re-tints itself without knowing a page
 * exists. Nothing here names a colour.
 */
export function PageShell({
  chapter,
  eyebrow,
  title,
  lede,
  hero,
  cover,
  children,
}: {
  chapter: Chapter;
  /** Small line above the title. Optional: not every page earns one. */
  eyebrow?: string;
  title?: string;
  lede?: ReactNode;
  /** Replaces the standard hero entirely. Mission uses this to go cinematic. */
  hero?: ReactNode;
  /**
   * A full-bleed photograph behind the standard hero, in the manner of a
   * social cover photo: edge to edge, cropped to the header's own height,
   * under the same veil the film heroes use so the type stays readable.
   * Enquiry uses it. Leave it out and the header keeps the marble backdrop.
   */
  cover?: {
    src: string;
    /**
     * CSS `object-position`. A cover band is far wider than it is tall, so
     * `object-cover` crops the top and bottom off; this says which part to
     * keep. Defaults to the middle.
     */
    position?: string;
  };
  children?: ReactNode;
}) {
  return (
    <div
      data-chapter={chapter.key}
      className="min-h-[100dvh] bg-background text-foreground"
    >
      <SiteNav />

      {hero ?? (
      <header className="relative isolate overflow-hidden pb-20 pt-36 md:pb-28 md:pt-48">
        {/* Either a cover photograph or the marble backdrop. The photograph
            gets the SAME treatment as the film heroes: `object-cover` so it
            fills the band left to right whatever the header's height, the
            shared `FilmVeil` over it at the strength Our Mission settled on,
            and the accent wash and grain on top. That is what keeps this
            recognisably the same site rather than a stock cover image.

            It runs edge to edge under the navigation, which is transparent
            until you scroll — the picture is the top of the page, with no bar
            of solid colour above it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          {cover ? (
            <>
              <img
                src={cover.src}
                alt=""
                style={{ objectPosition: cover.position ?? 'center' }}
                className="h-full w-full object-cover"
              />
              <FilmVeil opacity={0.72} />
            </>
          ) : (
            <MarbleVeins className="opacity-[0.5]" />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,hsl(var(--accent)/0.14),transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
          <Grain className="opacity-[0.035]" />
        </div>

        <div className="mx-auto max-w-6xl px-6 md:px-10">
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE.out }}
              className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent"
            >
              {eyebrow}
            </motion.p>
          )}

          <TextEffect
            as="h1"
            per="word"
            preset="fade-in-blur"
            delay={0.15}
            className="mt-5 max-w-[16ch] font-display text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
          >
            {title ?? ''}
          </TextEffect>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5, ease: EASE.out }}
            className="mt-8 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            {lede}
          </motion.div>
        </div>
      </header>
      )}

      <main>{children}</main>

      {/* Every route ends in a dusk, but in ITS OWN dusk. `data-chapter`
          plus `data-surface="footer"` selects the district's footer palette
          in globals.css; the `dark` class stays so any `dark:` utility
          inside still behaves, and the two-attribute block outranks it.
          Layout, links, structure and type are identical to the landing
          page's footer. Only the tokens differ. */}
      <div
        data-chapter={chapter.key}
        data-surface="footer"
        className="dark bg-background text-foreground"
      >
        <SiteFooter />
      </div>

      {/* Live Updates belongs to every INFORMATIONAL page, so it lives here
          rather than being repeated in five components. Deliberately NOT on
          the form routes (Get Passes, Retrieve, Donate, the volunteer
          portal): those are tasks, and a floating ticker over a form someone
          is filling in is an interruption, not a service. Those pages build
          their own shell and so never pick this up by accident.

          Identical to the landing page in every respect, because it IS the
          same component with no props: same ticker, same timing, same
          animations, and the same mobile behaviour, including receding while
          the footer's social row is on screen (it observes
          `#footer-socials`, which SiteFooter renders just above). */}
      <LiveUpdates />
    </div>
  );
}

/**
 * A full-bleed band. `tone="raised"` lifts a section onto the card surface so
 * long pages alternate instead of running as one sheet — the Apple-page
 * rhythm the brief asks for, done with tokens so each district alternates in
 * its own colour.
 */
export function Band({
  children,
  tone = 'plain',
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: 'plain' | 'raised';
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={
        // Tightened from py-24/py-36. The pages were reading as a stack of
        // very tall, very empty rooms; this keeps the air between sections
        // generous while bringing each section's own content closer together.
        'relative overflow-hidden py-20 md:py-28 ' +
        (tone === 'raised' ? 'border-y border-border/60 bg-card ' : '') +
        (className ?? '')
      }
      {...rest}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">{children}</div>
    </section>
  );
}
