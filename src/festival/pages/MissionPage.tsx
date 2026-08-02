import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { TextEffect } from '@/components/motion/text-effect';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { GoldRule, Grain, MarbleVeins } from '../materials';
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
/*  The photographs are not in the repo yet, so each plate renders as a  */
/*  toned frame with its caption already set. Add `src` to a record and  */
/*  that plate becomes a photograph — nothing else changes, and the      */
/*  carousel takes any number of them.                                   */
/* -------------------------------------------------------------------- */
const RANGEELO: Photo[] = [
  { year: '2023', caption: 'The courtyard, opening hour' },
  { year: '2023', caption: 'Puppetry at the west gate' },
  { year: '2023', caption: 'The mehndi stall' },
  { year: '2023', caption: 'Ghoomar on the main stage' },
  { year: '2023', caption: 'Lanterns over the food street' },
  { year: '2023', caption: 'The last hour, main ground' },
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

const FACTS = [
  {
    tag: 'Cuisine',
    title: 'There is no such thing as Italian food',
    body: 'There is Sicilian, Ligurian, Emilian. A recipe changes valley by valley, and every version is the correct one to the person cooking it.',
  },
  {
    tag: 'Heritage',
    title: 'No country holds more UNESCO World Heritage sites',
    body: 'Sixty of them. You can stand in a piazza that has been a market, a parade ground and a car park, and is now a piazza again.',
  },
  {
    tag: 'Art',
    title: 'One Florentine workshop trained Leonardo and Botticelli',
    body: "Verrocchio's bottega. Apprentices ground pigment for years before they were allowed to touch a panel — the craft came before the genius.",
  },
  {
    tag: 'Architecture',
    title: "Brunelleschi's dome was built without scaffolding from below",
    body: 'Four million bricks, laid in a herringbone that held itself up as it rose. Nobody has fully explained how he planned it.',
  },
  {
    tag: 'Music',
    title: 'Opera gave the world its musical vocabulary',
    body: 'Piano, forte, allegro, crescendo. A musician in any country still reads instructions in Italian.',
  },
  {
    tag: 'Everyday',
    title: 'The passeggiata is a scheduled aimless walk',
    body: 'Early evening, best clothes, no destination. The point is to be seen being unhurried — which is the whole spirit of a piazza.',
  },
];

const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';
const ghostButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

/* -------------------------------------------------------------------- */
/*  Hero                                                                 */
/* -------------------------------------------------------------------- */

function MissionHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  // Two speeds: the film drifts slowly, the words leave faster. That
  // difference IS the depth — no blur, no scale, nothing expensive.
  const filmY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', '46%']);
  const copyFade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <header
      ref={ref}
      className="relative isolate flex min-h-[92svh] items-end overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: filmY }}
        className="pointer-events-none absolute -inset-x-0 -bottom-[18%] -top-0 -z-10"
      >
        <HeroFilm
          src="/carnival.mp4"
          webmSrc="/carnival.webm"
          className="absolute inset-0"
          poster={
            // Until the film loads — and if it never does — the hero is the
            // site's own marble rather than a black rectangle.
            <div className="absolute inset-0 bg-background">
              <MarbleVeins className="opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_20%,hsl(var(--accent)/0.2),transparent_72%)]" />
            </div>
          }
        />
        {/* Scrim: the copy has to stay legible over whatever frame is
            underneath, and the base has to melt into the page below. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/25" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-background" />
        <Grain className="opacity-[0.045]" />
      </motion.div>

      <motion.div
        style={{ y: copyY, opacity: copyFade }}
        className="mx-auto w-full max-w-6xl px-6 pb-24 pt-40 md:px-10 md:pb-32 md:pt-52"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE.out }}
        >
          <FlashWordmark />
        </motion.div>

        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.2}
          className="mt-6 max-w-[14ch] font-display text-6xl font-medium leading-[0.98] tracking-tight sm:text-7xl md:text-8xl lg:text-9xl"
        >
          Our Mission
        </TextEffect>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: EASE.out }}
          className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-muted-foreground md:text-xl"
        >
          Once every three years, The Brigade School @ Malleswaram transforms —
          the corridors become streets, the ground becomes a piazza, and
          everything the day earns supports the cause of underprivileged
          children.
        </motion.p>
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
  return (
    <div className={cn('overflow-hidden', className)}>
      <motion.div
        initial={{ y: '110%' }}
        whileInView={{ y: '0%' }}
        viewport={REVEAL_VIEWPORT}
        transition={{ duration: 1, delay, ease: EASE.out }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Section marker: a numeral and a rule, in place of a repeated eyebrow. */
function Marker({ n, label }: { n: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.8, ease: EASE.out }}
      className="flex items-center gap-4"
    >
      <span className="font-display text-sm tabular-nums text-accent">{n}</span>
      <span className="h-px w-10 bg-accent/50" />
      <span className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
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

/**
 * Facts as an accordion list rather than a grid of cards — the landing page
 * already has card grids, and a list reads as editorial.
 */
function FactRow({
  fact,
  index,
}: {
  fact: (typeof FACTS)[number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.7, delay: index * 0.05, ease: EASE.out }}
      className="border-b border-border/70 first:border-t"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-start gap-6 py-7 text-left transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mt-1 w-20 flex-none font-body text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
          {fact.tag}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-2xl font-medium leading-snug tracking-tight text-foreground transition-colors duration-500 group-hover:text-primary md:text-3xl">
            {fact.title}
          </span>
          {/* 0fr -> 1fr collapses without measuring, so any body length
              animates smoothly. */}
          <span
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-500 ease-out',
              open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
          >
            <span className="overflow-hidden">
              <span className="block max-w-2xl pt-4 font-body text-base leading-relaxed text-muted-foreground">
                {fact.body}
              </span>
            </span>
          </span>
        </span>
        <Plus
          aria-hidden="true"
          className={cn(
            'mt-1 h-5 w-5 flex-none text-muted-foreground transition-transform duration-500',
            open && 'rotate-45 text-accent'
          )}
        />
      </button>
    </motion.div>
  );
}

/* -------------------------------------------------------------------- */

export default function MissionPage() {
  return (
    <PageShell chapter={chapter} hero={<MissionHero />}>
      {/* 01 · Brigade Foundation ----------------------------------- */}
      <Band>
        <div className="grid items-center gap-14 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-6">
            <Marker n="01" label="Who stands behind it" />
            <Rise delay={0.1} className="mt-6">
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
              className="mt-8 space-y-4 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              <p>
                Flash @ Brigade is run under Brigade Foundation, a
                not-for-profit trust that has worked in education, health and
                community development for over two decades.
              </p>
              <p>
                The Foundation looks for partners rather than patrons —
                individuals, organisations and groups who share the same
                concerns and want to put weight behind them. A carnival turns
                out to be a remarkably good way to find them.
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
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <Marker n="02" label="What it is" />
            <Rise delay={0.1} className="mt-6">
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                Built by students,
              </h2>
            </Rise>
            <Rise delay={0.18}>
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                start to finish
              </h2>
            </Rise>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={REVEAL_VIEWPORT}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE.out }}
            className="space-y-5 font-body text-base leading-relaxed text-muted-foreground md:col-span-6 md:col-start-7 md:text-lg"
          >
            <p>
              Flash is a student-led carnival: a day of food, performance,
              craft and noise, planned and run by the students themselves.
              Budgets, rosters, suppliers, stage times — all of it.
            </p>
            <p>
              Families, alumni, staff and neighbours come through the gates,
              and for a few hours the school belongs to the whole of
              Malleswaram. It is a celebration of culture and of making things,
              and the making is the point.
            </p>
            <p className="border-l-2 border-accent pl-5 font-display text-xl italic leading-relaxed text-foreground md:text-2xl">
              Every rupee of surplus goes to the school's Passion with
              Compassion programme, funding education and healthcare for
              underprivileged children.
            </p>
          </motion.div>
        </div>
      </Band>

      {/* 03 · The charity goal ------------------------------------- */}
      <Band>
        <Marker n="03" label="Why we raise" />
        <Rise delay={0.1} className="mt-6">
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
          className="mt-8 max-w-2xl space-y-4 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          <p>
            Passion with Compassion pays school fees, buys books and uniforms,
            and covers medical treatment for children whose families cannot. It
            is unglamorous, continuous work, and it runs on what days like this
            one bring in.
          </p>
          <p>
            Which is why turning up matters more than it sounds. A ticket, a
            plate of food, a round on a stall — none of it feels like giving,
            and all of it is.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-10 border-t border-border pt-12 sm:grid-cols-3">
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
          <p className="mt-3 font-body text-xs text-muted-foreground">
            Direct giving opens closer to the day. Until then, the front desk
            will point you the right way.
          </p>
        </motion.div>
      </Band>

      {/* 04 · Flash 1.0 -------------------------------------------- */}
      <Band tone="raised" aria-labelledby="flash-one">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Marker n="04" label="Flash 1.0 · 2023" />
            <Rise delay={0.1} className="mt-6">
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
            The first edition, in 2023, turned the school into a desert fair —
            mirrorwork and marigold, puppets at the gate, ghoomar on the main
            stage. It raised ten lakh rupees in a single day and set the
            standard the second edition is chasing.
          </motion.p>
        </div>

        <div className="mt-14">
          <PhotoCarousel photos={RANGEELO} />
        </div>
      </Band>

      {/* 05 · Why Italy -------------------------------------------- */}
      <Band>
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          <Drift className="md:col-span-5 md:row-start-1" distance={32}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 1.1, ease: EASE.out }}
              className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-secondary/50"
            >
              <div className="absolute inset-0 bg-[radial-gradient(75%_65%_at_50%_20%,hsl(var(--primary)/0.2),transparent_74%)]" />
              <Grain className="opacity-[0.06]" />
              <div className="absolute inset-x-0 bottom-0 p-8">
                <GoldRule className="w-14" />
                <p className="mt-4 font-display text-3xl font-medium italic leading-tight tracking-tight text-foreground">
                  Namma Mia Carpisa
                </p>
              </div>
            </motion.div>
          </Drift>

          <div className="md:col-span-6 md:col-start-7 md:row-start-1">
            <Marker n="05" label="Why Italy" />
            <Rise delay={0.1} className="mt-6">
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
              className="mt-8 space-y-4 font-body text-base leading-relaxed text-muted-foreground md:text-lg"
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
              <p>
                And it rhymes with Bengaluru more than you would expect — which
                is where the name comes from.
              </p>
            </motion.div>
          </div>
        </div>
      </Band>

      {/* 06 · Did you know ----------------------------------------- */}
      <Band tone="raised">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Marker n="06" label="Did you know" />
            <Rise delay={0.1} className="mt-6">
              <h2 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
                Before you
              </h2>
            </Rise>
            <Rise delay={0.18}>
              <h2 className="font-display text-4xl font-medium italic leading-[1.08] tracking-tight text-primary sm:text-5xl">
                arrive
              </h2>
            </Rise>
            <p className="mt-6 font-body text-sm text-muted-foreground">
              Six things worth knowing. Tap a line to open it.
            </p>
          </div>

          <div className="md:col-span-7 md:col-start-6">
            {FACTS.map((fact, i) => (
              <FactRow key={fact.title} fact={fact} index={i} />
            ))}
          </div>
        </div>
      </Band>

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
          <p className="mx-auto mt-6 max-w-lg font-body text-base leading-relaxed text-muted-foreground">
            14 November 2026. The Brigade School @ Malleswaram. Bring the
            family, bring an appetite, and know exactly where the money goes.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
