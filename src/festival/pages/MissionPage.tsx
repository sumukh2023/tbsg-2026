import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Plus, X } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { Magnetic } from '@/components/motion/magnetic';
import { TextEffect } from '@/components/motion/text-effect';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { FilmVeil, GoldRule, Grain, MarbleVeins } from '../materials';
import { FlashWordmark } from '../FlashWordmark';
import { BrigadeSchoolsMark } from '../BrigadeSchoolsMark';
import { Band, PageShell } from './PageShell';
import { HeroFilm } from './HeroFilm';
import { PhotoCarousel, type Photo } from './PhotoCarousel';
import { CHAPTERS, SUPPORT_PATH } from './chapters';

const chapter = CHAPTERS[0];

/* -------------------------------------------------------------------- */
/*  Flash 1.0 · Rangeelo Rajasthan, 2023.                                */
/*                                                                       */
/*  The photographs are not in the repo yet, so each plate renders as a   */
/*  toned frame. Add `src` to a record and that plate becomes a           */
/*  photograph. Nothing else changes, and the carousel takes any number   */
/*  of them. `alt` is for assistive technology only: the captions that    */
/*  used to sit under each plate are gone, so the pictures carry the      */
/*  section on their own.                                                 */
/* -------------------------------------------------------------------- */
const RANGEELO: Photo[] = [
  { alt: 'The courtyard at opening hour, Rangeelo Rajasthan 2023' },
  { alt: 'Puppetry at the west gate, Rangeelo Rajasthan 2023' },
  { alt: 'The mehndi stall, Rangeelo Rajasthan 2023' },
  { alt: 'Ghoomar on the main stage, Rangeelo Rajasthan 2023' },
  { alt: 'Lanterns over the food street, Rangeelo Rajasthan 2023' },
  { alt: 'The last hour on the main ground, Rangeelo Rajasthan 2023' },
];

const HIGHLIGHTS = [
  {
    value: 10,
    prefix: '₹',
    suffix: ' lakh',
    label: 'raised in a single day, in full to Passion with Compassion',
  },
  { value: 3160, label: 'children supported by the funds that followed' },
  { value: 42, label: 'stalls run start to finish by students' },
];

/**
 * Six things about Italy, one per card. `title` is the line on the card and
 * has to stay short enough to hold two lines at card width; `body` only ever
 * appears inside the modal, so it can breathe.
 */
const FACTS = [
  {
    tag: 'Architecture',
    title: 'A dome built without scaffolding',
    body: "Brunelleschi raised the dome of Florence's cathedral out of four million bricks, laid in a herringbone that held itself up as it rose. No centring was ever built beneath it, and nobody has fully explained how he planned it.",
  },
  {
    tag: 'Cuisine',
    title: 'There is no such thing as Italian food',
    body: 'There is Sicilian, Ligurian, Emilian. A recipe changes valley by valley, the argument about which version is correct never ends, and every version is the correct one to the person cooking it.',
  },
  {
    tag: 'Fashion',
    title: 'Ready to wear began in a drawing room',
    body: 'In 1951 a handful of designers showed together in the Sala Bianca of the Palazzo Pitti in Florence. It was the first time buyers crossed the Atlantic for a season that was not held in Paris, and the Italian fashion industry dates itself from that afternoon.',
  },
  {
    tag: 'Art',
    title: 'One workshop trained Leonardo and Botticelli',
    body: "Verrocchio's bottega in Florence took both of them as apprentices. They ground pigment and prepared panels for years before they were allowed to paint anything that mattered, because the craft came first and the genius came after.",
  },
  {
    tag: 'UNESCO Sites',
    title: 'No country holds more World Heritage sites',
    body: 'Sixty of them, more than any other nation on the list. You can stand in a piazza that has been a market, a parade ground and a car park, and is a piazza again.',
  },
  {
    tag: 'Innovation',
    title: 'The piano, the battery and the radio',
    body: 'Cristofori built the first fortepiano, Volta the first battery, Marconi sent the first signals across open water. Three inventions, three centuries, one peninsula.',
  },
];

/**
 * DMC 743 fill with dark ink on it: the brightest the palette gets, and at
 * 11.5:1 the most readable button on the page. The yellow can only carry
 * text this way round, which is why `--highlight` is a fill token and
 * `--primary` is its darkened counterpart for type on the page ground.
 */
const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-highlight px-8 py-3.5 font-body text-sm font-semibold text-highlight-foreground transition-all duration-300 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';
const ghostButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

/* -------------------------------------------------------------------- */
/*  Hero                                                                 */
/* -------------------------------------------------------------------- */

/**
 * The hero, rebuilt on the landing page's.
 *
 * Same construction, the same way round: a full-bleed film, the shared
 * `FilmVeil` over it, one radial pool of page ground that TRAVELS WITH THE
 * COPY so the words are protected without dulling the footage at the edges,
 * grain on top, and the type centred in the middle of the frame. Eyebrow,
 * a two-part display line where the second half turns italic in the
 * chapter's primary, a short standing paragraph, then the actions.
 *
 * What it deliberately does NOT take is the scroll-scrub engine. That one
 * seeks a playhead from scroll position and is the most fragile code in the
 * repo (see the SETUP A notes in CONTEXT.md). This film simply autoplays and
 * loops, through `HeroFilm`, which is a far easier contract and cannot
 * regress the landing page.
 *
 * The arch colonnade also stays behind. It is the landing page's signature,
 * and a district that redrew it would read as the same page in a different
 * colour rather than as a place of its own.
 */

/** The veil, at the strength the landing page opens on, eased back.
 *
 * `FilmVeil` is a fixed gradient (0.92 / 0.72 / 0.62 / 0.85 of the page
 * ground, top to bottom) whose OPACITY is the dial. The landing page holds
 * it at 1 through its opening beats. Here it sits lower, so the effective
 * wash across the middle of the frame is about 0.44 rather than 0.62 and
 * appreciably more of the carnival comes through; the copy is covered by
 * the radial pool underneath it instead, which is exactly how the landing
 * page keeps its own centred type readable.
 */
const HERO_VEIL = 0.7;

function MissionHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  // Two speeds: the film drifts slowly, the words leave faster. That
  // difference IS the depth. No blur, no scale, nothing expensive.
  const filmY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const copyY = useTransform(scrollYProgress, [0.35, 0.85], [0, -80]);
  const copyFade = useTransform(scrollYProgress, [0.35, 0.8], [1, 0]);

  return (
    <header
      ref={ref}
      aria-label="Our Mission"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: filmY }}
        className="pointer-events-none absolute -inset-x-0 -bottom-[16%] -top-0 -z-10"
      >
        <HeroFilm
          // public/Our Mission.mp4. The space MUST be percent-encoded: an
          // unencoded space in a src is not a valid URL and Safari in
          // particular will not fetch it.
          src="/Our%20Mission.mp4"
          className="absolute inset-0"
          poster={
            // Until the film loads, and if it never does, the hero is the
            // site's own marble rather than a black rectangle.
            <div className="absolute inset-0 bg-background">
              <MarbleVeins className="opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_20%,hsl(var(--accent)/0.2),transparent_72%)]" />
            </div>
          }
        />
        <FilmVeil opacity={HERO_VEIL} />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_-5%,hsl(var(--accent)/0.14),transparent_70%)]" />
        {/* The last stretch melts into the page below, so the section change
            is a dissolve rather than an edge. */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        <Grain />
      </motion.div>

      <motion.div
        style={{ y: copyY, opacity: copyFade }}
        className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-16 text-center"
      >
        {/* Travels with the copy: keeps the wordmark, title and standing
            paragraph readable without dulling the footage at the edges. */}
        <div
          aria-hidden="true"
          className="absolute -inset-x-48 -inset-y-24 bg-[radial-gradient(60%_58%_at_50%_48%,hsl(var(--background)/0.9),hsl(var(--background)/0.55)_55%,transparent_80%)]"
        />
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE.out }}
            className="flex justify-center"
          >
            <FlashWordmark />
          </motion.div>

          {/* The landing page's exact display treatment: two halves, the
              second italic in the chapter's primary. It sets on one line on
              a desktop and folds to two on a phone, which is where the
              italic half earns its keep. */}
          {/* The gap is generous because the second half is ITALIC: its left
              side bearing eats into the space and a normal word gap reads as
              no gap at all. */}
          <h1 className="mt-8 flex flex-wrap items-baseline justify-center gap-x-[0.42em]">
            <TextEffect
              as="span"
              per="char"
              preset="fade-in-blur"
              delay={0.7}
              speedReveal={1.4}
              className="block font-display text-[17vw] font-medium leading-[0.98] tracking-tight text-foreground sm:text-7xl md:text-8xl lg:text-9xl"
            >
              Our
            </TextEffect>
            <TextEffect
              as="span"
              per="char"
              preset="fade-in-blur"
              delay={1.1}
              speedReveal={1.4}
              className="block pb-2 font-display text-[17vw] font-medium italic leading-[1.08] tracking-tight text-primary sm:text-7xl md:text-8xl lg:text-9xl"
            >
              Mission
            </TextEffect>
          </h1>

          <TextEffect
            as="p"
            per="line"
            preset="fade-in-blur"
            delay={1.8}
            className="mx-auto mt-8 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Once every three years our campus becomes a piazza, and everything
            the day earns supports the education and healthcare of
            underprivileged children.
          </TextEffect>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2.3, ease: EASE.out }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Magnetic intensity={0.2} range={80}>
              <Link to={SUPPORT_PATH} className={primaryButton}>
                Support Us
              </Link>
            </Magnetic>
            <a
              href="#mission-story"
              className="group inline-flex items-center gap-2 rounded-full px-4 py-3.5 font-body text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Read the story
              <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
            </a>
          </motion.div>
        </div>
      </motion.div>
    </header>
  );
}

/* -------------------------------------------------------------------- */
/*  Editorial pieces                                                     */
/* -------------------------------------------------------------------- */

/**
 * A line of type that rises as it enters. Deliberately NOT the landing
 * page's block fade: each line arrives on its own beat, which is what makes
 * long-form reading feel composed rather than dumped.
 *
 * The observer watches the CLIP BOX, not the thing that moves, and that is
 * load-bearing rather than stylistic. `whileInView` observes the element it
 * is written on; this one starts translated a full 110% of its own height,
 * which puts it entirely outside its `overflow-hidden` parent. Intersection
 * observers clip against ancestor overflow, so that element reports a ratio
 * of zero for ever, the reveal never fires, and every heading built on this
 * stays invisible. Watching the wrapper, which never moves, is the fix.
 *
 * The symptom was subtle enough to survive two rounds of review: the page
 * looked like it merely had too much air under each section marker. It was
 * a missing headline.
 *
 * The clip is `clip-path` rather than `overflow-hidden`, and the bottom inset
 * is NEGATIVE. Cormorant's descenders and comma tails reach about 10% of the
 * font size below the line box at every size we set, so an `overflow-hidden`
 * box cut the tail off every `y`, `g` and comma on the page. A negative inset
 * opens 20% of extra room below the box without changing its size, so nothing
 * around it moves; padding plus a compensating negative margin would have had
 * to be a fixed pixel value and would have dragged the body copy up with it.
 * The reveal starts at 130% so it still clears the widened clip region.
 */
function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, REVEAL_VIEWPORT);
  return (
    <div ref={ref} className={cn('[clip-path:inset(0_0_-20%_0)]', className)}>
      <motion.div
        initial={{ y: '130%' }}
        animate={inView ? { y: '0%' } : undefined}
        transition={{ duration: 1, delay, ease: EASE.out }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Section marker: the numeral set in a DMC 743 tile beside the section name.
 *
 * Bigger than an eyebrow on purpose. It is the only repeated element on the
 * page, so it carries the numbering hierarchy, and the filled tile is where
 * the chapter's yellow states itself at full strength. Dark ink on the fill
 * rather than yellow type on paper, which is the only way this hue clears
 * WCAG at text sizes.
 */
function Marker({ n, label }: { n: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.8, ease: EASE.out }}
      className="flex items-center gap-4"
    >
      <span
        aria-hidden="true"
        className="grid h-11 w-11 flex-none place-items-center rounded-md bg-highlight font-display text-lg font-semibold tabular-nums text-highlight-foreground sm:h-12 sm:w-12 sm:text-xl"
      >
        {n}
      </span>
      <span className="font-body text-sm font-semibold uppercase tracking-[0.18em] text-foreground sm:text-base sm:tracking-[0.2em]">
        {label}
      </span>
    </motion.div>
  );
}

/** Slow vertical drift for a panel, driven by its own position on screen. */
function Drift({
  children,
  distance = 40,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/**
 * A photographic plate, framed the way the Brigade Schools lockup beside it
 * is framed: same radius, same deep soft shadow, same slow scale-in.
 *
 * If the file is not in the repo the `onError` path leaves a toned frame in
 * its place rather than a broken-image glyph, so the section still composes
 * while the photograph is being sourced.
 */
function Plate({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 1.1, ease: EASE.out }}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-secondary/60 shadow-[0_36px_80px_-46px_hsl(var(--foreground)/0.65)]',
        className
      )}
    >
      {failed ? (
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(72%_62%_at_50%_25%,hsl(var(--highlight)/0.4),transparent_74%)]" />
          <Grain className="opacity-[0.06]" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          // object-cover with a centre-weighted position: the frame changes
          // shape between phone and desktop and the crop has to stay on the
          // subject at both.
          className="h-full w-full object-cover object-center"
        />
      )}
      {/* The page's own ground along the lower edge, so the plate sits in
          the section instead of on top of it. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-background/25"
      />
    </motion.div>
  );
}

function Figure({
  value,
  prefix,
  suffix,
  label,
  delay,
}: (typeof HIGHLIGHTS)[number] & { delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, REVEAL_VIEWPORT);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.8, delay, ease: EASE.out }}
    >
      <p className="font-display text-5xl font-medium tracking-tight text-primary md:text-6xl">
        {prefix}
        <AnimatedNumber
          value={inView ? value : 0}
          springOptions={{ stiffness: 45, damping: 26 }}
        />
        {suffix}
      </p>
      <p className="mt-3 max-w-[24ch] font-body text-sm leading-relaxed text-muted-foreground">
        {label}
      </p>
    </motion.div>
  );
}

/* -------------------------------------------------------------------- */
/*  Did you know: a grid of cards, opening into a modal                  */
/* -------------------------------------------------------------------- */

type Fact = (typeof FACTS)[number];

/**
 * One card. The category sits on its own line above a rule, and the title
 * begins below it, so the two can never collide however long either runs.
 * The plus is the only thing that moves on hover, which keeps six of these
 * calm side by side.
 */
function FactCard({
  fact,
  index,
  onOpen,
}: {
  fact: Fact;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.7, delay: index * 0.06, ease: EASE.out }}
      aria-label={`${fact.tag}: ${fact.title}. Read more.`}
      className="group relative flex h-full min-h-[13rem] flex-col justify-between overflow-hidden rounded-xl border border-border bg-background p-7 text-left transition-[border-color,box-shadow,transform] duration-500 ease-out hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_28px_60px_-42px_hsl(var(--foreground)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:p-8"
    >
      {/* A wash of the chapter's yellow that arrives on hover, low enough to
          stay behind the type at every opacity. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,hsl(var(--highlight)/0.28),transparent_62%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="relative">
        <span className="block font-body text-2xs font-semibold uppercase tracking-[0.22em] text-primary">
          {fact.tag}
        </span>
        <span
          aria-hidden="true"
          className="mt-4 block h-px w-8 bg-primary/40 transition-[width] duration-500 group-hover:w-14"
        />
        <span className="mt-5 block max-w-[22ch] font-display text-2xl font-medium leading-snug tracking-tight text-foreground md:text-3xl">
          {fact.title}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="relative mt-7 grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors duration-500 group-hover:border-transparent group-hover:bg-highlight group-hover:text-highlight-foreground"
      >
        <Plus className="h-4 w-4" />
      </span>
    </motion.button>
  );
}

/**
 * The opened fact.
 *
 * A dialog rather than an expanding row: at six cards an accordion pushes
 * the page around under the reader, and the brief asked for the background
 * to recede instead. The backdrop blurs the whole page, the panel scales up
 * from just under its resting size, and both leave together so the close
 * reads as one gesture rather than two.
 *
 * The two halves run on SEPARATE clocks, and that is the whole trick to how
 * responsive this feels. The backdrop is the reader's acknowledgement that
 * the click landed, so it takes 140ms and starts at 0.35 opacity rather than
 * 0 — the blur is already legible on the very first frame instead of ramping
 * up from nothing. The panel keeps its slower 480ms arrival, which is what
 * makes the whole thing read as elegant rather than abrupt. Wrapping both in
 * one fading container, as this did before, forced the blur to wait out the
 * panel's timing and put a beat of nothing between click and response.
 */
function FactDialog({ fact, onClose }: { fact: Fact | null; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!fact) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Hold the page still underneath. The reader opened a card, not a
    // scroll, and Lenis will happily keep running otherwise.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus in, so the dialog is reachable from the keyboard the
    // instant it exists.
    const focus = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(focus);
    };
  }, [fact, onClose]);

  return (
    <AnimatePresence>
      {/* The wrapper is a motion element with NO animation props of its own.
          It has to be one so AnimatePresence propagates `exit` down to the
          backdrop and the panel and holds the unmount until they finish;
          giving it its own opacity, as it had before, is what made the blur
          wait for the panel's timing. */}
      {fact && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: 'linear' }}
            // `will-change` gets the compositor to prepare the backdrop
            // filter before the first painted frame, which is the other half
            // of why the blur now appears immediately.
            style={{ willChange: 'opacity, backdrop-filter' }}
            className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-xl"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.48, ease: EASE.out }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-[0_50px_110px_-40px_hsl(var(--foreground)/0.55)] md:p-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_0%_0%,hsl(var(--highlight)/0.24),transparent_60%)]"
            />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative">
              <p className="font-body text-2xs font-semibold uppercase tracking-[0.22em] text-primary">
                {fact.tag}
              </p>
              <GoldRule className="mt-4 w-12" />
              <h3
                id={titleId}
                className="mt-6 max-w-[18ch] pr-10 font-display text-3xl font-medium leading-tight tracking-tight text-foreground md:text-4xl"
              >
                {fact.title}
              </h3>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12, ease: EASE.out }}
                className="mt-6 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
              >
                {fact.body}
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------- */

export default function MissionPage() {
  const [openFact, setOpenFact] = useState<Fact | null>(null);

  return (
    <PageShell chapter={chapter} hero={<MissionHero />}>
      {/* 01 · Brigade Foundation ----------------------------------- */}
      {/* The hero's "Read the story" cue lands here; the scroll margin keeps
          the marker clear of the fixed navigation. */}
      <Band id="mission-story" className="scroll-mt-16">
        <div className="grid items-center gap-14 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-6">
            <Marker n="01" label="Who stands behind it" />
            <Rise delay={0.1} className="mt-5">
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                A trust built for
              </h2>
            </Rise>
            <Rise delay={0.18}>
              <h2 className="font-display text-4xl font-medium italic leading-[1.08] tracking-tight text-primary sm:text-5xl md:text-6xl">
                public good
              </h2>
            </Rise>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 0.9, delay: 0.3, ease: EASE.out }}
              className="mt-4 space-y-4 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              <p>
                Flash @ Brigade is run under Brigade Foundation, a
                not-for-profit trust that has worked in education, health and
                community development for over two decades.
              </p>
              <p>
                The Foundation looks for partners rather than patrons:
                individuals, organisations and groups who share the same
                concerns and want to put weight behind them. A carnival is a
                remarkably good way to find them.
              </p>
            </motion.div>
          </div>

          <Drift className="md:col-span-5 md:col-start-8" distance={28}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 1.1, ease: EASE.out }}
              className="overflow-hidden rounded-lg shadow-[0_30px_70px_-45px_hsl(var(--foreground)/0.6)]"
            >
              <BrigadeSchoolsMark className="aspect-[4/3] w-full" />
            </motion.div>
          </Drift>
        </div>
      </Band>

      {/* 02 · What the carnival is --------------------------------- */}
      <Band tone="raised">
        {/* Splits at `lg`, not `md`. A twelve-column track with a 56px
            gutter has very little column left at 768px, and a 260px measure
            beside the picture is exactly the cramped text the brief warned
            about. Tablets stack instead, which a landscape photograph is
            perfectly happy with: it simply runs the full width. */}
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          {/* The photograph leads on the left, and the writing answers it on
              the right. Section 01 runs the other way round, so the page
              alternates rather than settling into a column. Seven columns to
              five, because this frame is LANDSCAPE: at an even split it
              would have been a postage stamp beside a wall of type. */}
          <Drift className="lg:col-span-7 lg:row-start-1" distance={30}>
            <Plate
              src="/carnivalg3.jpg"
              alt="Students singing on the main stage at Rangeelo Rajasthan, the first edition of Flash @ Brigade"
              // 16:9 from `sm` up, which is the frame the photograph was
              // shot in, so the full stage survives. Phones take a slightly
              // tighter 3:2 for presence; the crop is centre-weighted, so
              // what it trims is the outer edge of the banners rather than
              // anything happening on the stage.
              className="aspect-[3/2] sm:aspect-[16/9]"
            />
          </Drift>

          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <Marker n="02" label="What it is" />
            <Rise delay={0.1} className="mt-5">
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                Built by students,
              </h2>
            </Rise>
            <Rise delay={0.18}>
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                start to finish
              </h2>
            </Rise>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 0.9, delay: 0.28, ease: EASE.out }}
              className="mt-4 space-y-5 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              <p>
                Flash is a student-led carnival: a day of food, performance,
                craft and noise, planned and run by the students themselves.
                Budgets, rosters, suppliers and stage times, all of it.
              </p>
              <p>
                Students, staff, families and alumni come together at The
                Brigade School @ Malleswaram, transforming it into a vibrant
                community celebration. More than a carnival, Flash is a
                celebration of culture, creativity and shared purpose, where
                every experience contributes towards a meaningful cause.
              </p>
              <p className="border-l-2 border-highlight pl-5 font-display text-xl italic leading-relaxed text-foreground md:text-2xl">
                Every rupee of surplus goes to the school's Passion with
                Compassion programme, funding education and healthcare for
                underprivileged children.
              </p>
            </motion.div>
          </div>
        </div>
      </Band>

      {/* 03 · The charity goal ------------------------------------- */}
      <Band>
        <Marker n="03" label="Our charity goal" />
        <Rise delay={0.1} className="mt-5">
          <h2 className="max-w-[18ch] font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
            A day of ours,
          </h2>
        </Rise>
        <Rise delay={0.18}>
          <h2 className="max-w-[18ch] font-display text-4xl font-medium italic leading-[1.08] tracking-tight text-primary sm:text-5xl md:text-6xl">
            a year of theirs
          </h2>
        </Rise>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.9, delay: 0.3, ease: EASE.out }}
          className="mt-4 max-w-2xl space-y-4 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          <p>
            Passion with Compassion pays school fees, buys books and uniforms,
            and covers medical treatment for children whose families cannot. It
            is unglamorous, continuous work, and it runs on what days like this
            one bring in.
          </p>
          <p>
            Which is why turning up matters more than it sounds. A ticket, a
            plate of food, a round on a stall. None of it feels like giving, and
            all of it is.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-10 border-t border-border pt-10 sm:grid-cols-3">
          {HIGHLIGHTS.map((h, i) => (
            <Figure key={h.label} {...h} delay={i * 0.12} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.8, ease: EASE.out }}
          className="mt-14"
        >
          <Link to={SUPPORT_PATH} className={primaryButton}>
            Support Us
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </motion.div>
      </Band>

      {/* 04 · Flash 1.0 -------------------------------------------- */}
      <Band tone="raised" aria-labelledby="flash-one">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Marker n="04" label="Flash 1.0 · 2023" />
            <Rise delay={0.1} className="mt-5">
              <h2
                id="flash-one"
                className="font-display text-5xl font-medium italic leading-[1.05] tracking-tight text-primary sm:text-6xl md:text-7xl"
              >
                Rangeelo Rajasthan
              </h2>
            </Rise>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={REVEAL_VIEWPORT}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE.out }}
            className="max-w-md font-body text-base leading-relaxed text-muted-foreground"
          >
            The first edition, Rangeelo Rajasthan in 2023, turned the school
            into a desert fair: mirrorwork and marigold, puppets at the gate,
            ghoomar on the main stage. It was a grand success and set the
            standard the second edition is chasing.
          </motion.p>
        </div>

        <div className="mt-14">
          <PhotoCarousel photos={RANGEELO} />
        </div>
      </Band>

      {/* 05 · The theme --------------------------------------------- */}
      <Band>
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-6 md:row-start-1">
            <Marker n="05" label="The theme" />
            <Rise delay={0.1} className="mt-5">
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                A country that built
              </h2>
            </Rise>
            <Rise delay={0.18}>
              <h2 className="font-display text-4xl font-medium italic leading-[1.08] tracking-tight text-primary sm:text-5xl md:text-6xl">
                its life outdoors
              </h2>
            </Rise>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 0.9, delay: 0.3, ease: EASE.out }}
              className="mt-4 space-y-4 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              <p>
                We wanted a theme that was already about gathering in public.
                Italy is the country that made the square the centre of the
                town: the market, the argument, the evening walk, the meal that
                runs long.
              </p>
              <p>
                It gives us food worth queueing for, music that carries across a
                courtyard, arches and colour to build with, and a way of
                treating an ordinary evening as something worth dressing for.
              </p>
            </motion.div>
          </div>

          <Drift className="md:col-span-5 md:col-start-8 md:row-start-1" distance={32}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 1.1, ease: EASE.out }}
              className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-secondary/50"
            >
              <div className="absolute inset-0 bg-[radial-gradient(75%_65%_at_50%_20%,hsl(var(--highlight)/0.35),transparent_74%)]" />
              <Grain className="opacity-[0.06]" />
              <div className="absolute inset-x-0 bottom-0 p-8">
                <GoldRule className="w-14" />
                <p className="mt-4 font-display text-3xl font-medium italic leading-tight tracking-tight text-foreground">
                  Namma Mia Carpisa
                </p>
              </div>
            </motion.div>
          </Drift>
        </div>
      </Band>

      {/* 06 · Did you know ----------------------------------------- */}
      <Band tone="raised">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-4">
            <Marker n="06" label="Did you know?" />
            <Rise delay={0.1} className="mt-5">
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
                Before you
              </h2>
            </Rise>
            <Rise delay={0.18}>
              <h2 className="font-display text-4xl font-medium italic leading-[1.08] tracking-tight text-primary sm:text-5xl">
                arrive
              </h2>
            </Rise>
          </div>

          <div className="grid gap-5 md:col-span-8 md:grid-cols-2">
            {FACTS.map((fact, i) => (
              <FactCard
                key={fact.title}
                fact={fact}
                index={i}
                onOpen={() => setOpenFact(fact)}
              />
            ))}
          </div>
        </div>
      </Band>

      <FactDialog fact={openFact} onClose={() => setOpenFact(null)} />

      {/* 07 · Support Flash ---------------------------------------- */}
      <Band className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="mx-auto max-w-2xl"
        >
          <GoldRule className="mx-auto w-20" />
          <h2 className="mt-8 font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Come for the day.
            <br />
            <span className="italic text-primary">Stay for the reason.</span>
          </h2>
          <div className="mt-10 space-y-3">
            <p className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              14 November 2026
            </p>
            <p className="font-body text-base text-muted-foreground sm:text-lg">
              The Brigade School @ Malleswaram
            </p>
          </div>
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={SUPPORT_PATH} className={ghostButton}>
              Support Us
            </Link>
            <Link to="/get-passes" className={primaryButton}>
              Get passes
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </Band>
    </PageShell>
  );
}
