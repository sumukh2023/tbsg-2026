import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { TextEffect } from '@/components/motion/text-effect';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { Tilt } from '@/components/motion/tilt';
import { cn } from '@/utils/cn';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { ArchFrame, GoldRule, Grain } from '../materials';
import { Band, PageShell } from './PageShell';
import { CHAPTERS, SUPPORT_PATH } from './chapters';

const chapter = CHAPTERS[0];

/* -------------------------------------------------------------------- */
/*  Flash 1.0 media.                                                     */
/*                                                                       */
/*  Photographs from Rangeelo Rajasthan are not in the repo yet. Rather  */
/*  than fake them, each frame renders as an arch — the same material    */
/*  the landing page uses — with its caption already in place. Drop a    */
/*  file into public/ and add `src` to a record here and that frame      */
/*  becomes a photograph; nothing else changes.                          */
/* -------------------------------------------------------------------- */
type Plate = { caption: string; span: string; src?: string };

const RANGEELO: Plate[] = [
  { caption: 'The courtyard, opening hour', span: 'md:col-span-7' },
  { caption: 'Puppetry at the west gate', span: 'md:col-span-5' },
  { caption: 'The mehndi stall', span: 'md:col-span-5' },
  { caption: 'Ghoomar, main stage', span: 'md:col-span-7' },
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
    title: 'Italy holds more UNESCO World Heritage sites than any country',
    body: 'Sixty of them. You can stand in a piazza that has been a market, a parade ground and a car park, and is now a piazza again.',
  },
  {
    tag: 'Art',
    title: 'A single Florentine workshop trained Leonardo and Botticelli',
    body: "Verrocchio's bottega. Apprentices ground pigment for years before they were allowed to touch a panel — the craft came before the genius.",
  },
  {
    tag: 'Architecture',
    title: "Brunelleschi's dome was built without scaffolding from below",
    body: 'Four million bricks, laid in a herringbone that held itself up as it rose. Nobody has fully explained how he planned it.',
  },
  {
    tag: 'Language',
    title: 'Opera gave the world its musical vocabulary',
    body: 'Piano, forte, allegro, crescendo. A musician in any country still reads instructions in Italian.',
  },
  {
    tag: 'Everyday',
    title: 'The passeggiata is a scheduled aimless walk',
    body: 'Early evening, best clothes, no destination. The point is to be seen being unhurried — which is the whole spirit of a piazza.',
  },
];

/** Two-column story block; `flip` alternates which side the panel sits on. */
function Story({
  eyebrow,
  title,
  children,
  panel,
  flip,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
  panel: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-12 md:gap-16">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={REVEAL_VIEWPORT}
        transition={{ duration: 0.9, ease: EASE.out }}
        className={cn(
          'md:col-span-6',
          flip ? 'md:order-2 md:col-start-7' : 'md:col-start-1'
        )}
      >
        <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </p>
        <h2 className="mt-5 font-display text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl">
          {title}
        </h2>
        <div className="mt-6 space-y-4 font-body text-base leading-relaxed text-muted-foreground">
          {children}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={REVEAL_VIEWPORT}
        transition={{ duration: 1, delay: 0.12, ease: EASE.out }}
        className={cn('md:col-span-5', flip ? 'md:order-1' : 'md:col-start-8')}
      >
        {panel}
      </motion.div>
    </div>
  );
}

/** A counting figure, on the same spring as the landing page's measures. */
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
      className="border-t border-border pt-6"
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

/** A fact card that opens on click, so nothing is a wall of text at rest. */
function Fact({ fact, index }: { fact: (typeof FACTS)[number]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Tilt rotationFactor={5} isRevese className="h-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex h-full w-full flex-col rounded-xl border border-border bg-card p-6 text-left transition-[border-color,box-shadow] duration-500 hover:border-accent/60 hover:shadow-[0_18px_40px_-28px_hsl(var(--foreground)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-start justify-between gap-4">
          <span className="font-body text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
            {fact.tag}
          </span>
          <Plus
            aria-hidden="true"
            className={cn(
              'h-4 w-4 flex-none text-muted-foreground transition-transform duration-500',
              open && 'rotate-45'
            )}
          />
        </span>
        <span className="mt-5 font-display text-2xl font-medium leading-snug tracking-tight text-foreground">
          {fact.title}
        </span>
        {/* 0fr -> 1fr: the row collapses without measuring anything, so the
            card animates smoothly at any text length. */}
        <span
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-500 ease-out',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <span className="overflow-hidden">
            <span className="block pt-4 font-body text-sm leading-relaxed text-muted-foreground">
              {fact.body}
            </span>
          </span>
        </span>
        <span className="sr-only">{open ? 'Collapse' : 'Expand'}</span>
        <span aria-hidden="true" className="flex-1" />
        <span className="mt-6 block h-px w-full origin-left scale-x-0 bg-accent/70 transition-transform duration-500 group-hover:scale-x-100" />
        <span className="sr-only">Fact {index + 1}</span>
      </button>
    </Tilt>
  );
}

const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';
const ghostButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

export default function MissionPage() {
  return (
    <PageShell
      chapter={chapter}
      eyebrow="Flash @ Brigade 2026"
      title="Our Mission"
      lede={
        <>
          <p>
            One day a year, a school in Malleswaram stops being a school. The
            corridors become streets, the quadrangle becomes a piazza, and
            everything the day earns goes to children who will never walk
            through our gates.
          </p>
        </>
      }
    >
      {/* 1 · Brigade Foundation ------------------------------------- */}
      <Band>
        <Story
          eyebrow="Who stands behind it"
          title={
            <>
              A trust built for
              <span className="italic text-primary"> public good</span>
            </>
          }
          panel={
            <ArchFrame className="aspect-[3/4] max-h-[460px] w-full">
              {/* Content sits in the lower half: the arch's top radius is
                  enormous, so anything high in the frame gets clipped. */}
              <div className="flex h-full flex-col justify-end gap-3 bg-secondary/60 p-8 pt-24">
                <GoldRule className="w-16" />
                <p className="font-display text-3xl font-medium leading-tight tracking-tight text-foreground">
                  Brigade Foundation
                </p>
                <p className="font-body text-sm leading-relaxed text-muted-foreground">
                  Registered under the Karnataka Societies Registration Act,
                  13 July 2003. Recognised under section 80G of the Income Tax
                  Act, 1961.
                </p>
              </div>
            </ArchFrame>
          }
        >
          <p>
            Flash @ Brigade is run under Brigade Foundation, a not-for-profit
            trust that has worked in education, health and community
            development for over two decades.
          </p>
          <p>
            The Foundation looks for partners rather than patrons —
            individuals, organisations and groups who share the same concerns
            and want to put weight behind them. A carnival turns out to be a
            remarkably good way to find them.
          </p>
        </Story>
      </Band>

      {/* 2 · What the carnival is ----------------------------------- */}
      <Band tone="raised">
        <Story
          flip
          eyebrow="What it is"
          title={
            <>
              Built by students,
              <br />
              start to finish
            </>
          }
          panel={
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['240', 'student organisers'],
                ['42', 'stalls'],
                ['1', 'day'],
                ['100%', 'of surplus given away'],
              ].map(([n, l]) => (
                <div
                  key={l}
                  className="rounded-xl border border-border bg-background/60 p-6"
                >
                  <p className="font-display text-4xl font-medium tracking-tight text-primary">
                    {n}
                  </p>
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    {l}
                  </p>
                </div>
              ))}
            </div>
          }
        >
          <p>
            Flash is a student-led carnival: a day of food, performance, craft
            and noise, planned and run by the students themselves. Budgets,
            rosters, suppliers, stage times — all of it.
          </p>
          <p>
            Families, alumni, staff and neighbours come through the gates, and
            for a few hours the school belongs to the whole of Malleswaram. It
            is a celebration of culture and of making things, and the making
            is the point.
          </p>
          <p className="font-medium text-foreground">
            Every rupee of surplus goes to the school's Passion with
            Compassion programme, funding education and healthcare for
            underprivileged children.
          </p>
        </Story>
      </Band>

      {/* 3 · The charity goal --------------------------------------- */}
      <Band>
        <div className="max-w-3xl">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Why we raise
          </p>
          <TextEffect
            as="h2"
            per="word"
            preset="fade-in-blur"
            className="mt-5 font-display text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl md:text-6xl"
          >
            A day of ours, a year of theirs
          </TextEffect>
          <div className="mt-8 space-y-4 font-body text-base leading-relaxed text-muted-foreground">
            <p>
              Passion with Compassion pays school fees, buys books and uniforms,
              and covers medical treatment for children whose families cannot.
              It is unglamorous, continuous work, and it runs on what days like
              this one bring in.
            </p>
            <p>
              Which is why turning up matters more than it sounds. A ticket, a
              plate of food, a round on a stall — none of it feels like giving,
              and all of it is.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-10 sm:grid-cols-3">
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

      {/* 4 · Flash 1.0 ---------------------------------------------- */}
      <Band tone="raised" aria-labelledby="flash-one">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Flash 1.0 · 2024
            </p>
            <h2
              id="flash-one"
              className="mt-5 font-display text-4xl font-medium italic leading-[1.12] tracking-tight text-primary sm:text-5xl md:text-6xl"
            >
              Rangeelo Rajasthan
            </h2>
          </div>
          <p className="max-w-md font-body text-base leading-relaxed text-muted-foreground">
            The first edition turned the school into a desert fair — mirrorwork
            and marigold, puppets at the gate, ghoomar on the main stage. It
            raised ten lakh rupees in a single day and set the standard the
            second edition is chasing.
          </p>
        </div>

        {/* A plain grid, not AnimatedGroup: that component wraps each child
            in its own motion div, so the column spans would land inside the
            grid cell instead of on it, and every plate would come out the
            same narrow width. Each figure animates itself instead. */}
        <div className="mt-14 grid gap-4 md:grid-cols-12">
          {RANGEELO.map((plate, i) => (
            <motion.figure
              key={plate.caption}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={REVEAL_VIEWPORT}
              transition={{ duration: 0.8, delay: i * 0.08, ease: EASE.out }}
              className={cn('group', plate.span)}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-secondary/50">
                {plate.src ? (
                  <img
                    src={plate.src}
                    alt={plate.caption}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_20%,hsl(var(--accent)/0.16),transparent_75%)]" />
                    <Grain className="opacity-[0.05]" />
                    <div className="absolute inset-0 grid place-items-center">
                      <GoldRule className="w-14" />
                    </div>
                  </>
                )}
              </div>
              <figcaption className="mt-3 font-body text-sm text-muted-foreground">
                {plate.caption}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </Band>

      {/* 5 · Why Italy ---------------------------------------------- */}
      <Band>
        <Story
          eyebrow="Why Italy"
          title={
            <>
              A country that built its
              <span className="italic text-primary"> life outdoors</span>
            </>
          }
          panel={
            <ArchFrame className="aspect-[3/4] max-h-[460px] w-full">
              <div className="relative flex h-full items-end bg-secondary/60 p-8 pt-24">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(75%_65%_at_50%_15%,hsl(var(--primary)/0.16),transparent_72%)]"
                />
                <p className="relative font-display text-3xl font-medium italic leading-tight tracking-tight text-foreground">
                  Namma Mia Carpisa
                </p>
              </div>
            </ArchFrame>
          }
        >
          <p>
            We wanted a theme that was already about gathering in public. Italy
            is the country that made the square the centre of the town: the
            market, the argument, the evening walk, the meal that runs long.
          </p>
          <p>
            It gives us food worth queueing for, music that carries across a
            courtyard, arches and colour to build with, and a way of treating
            an ordinary evening as something worth dressing for.
          </p>
          <p>
            And it rhymes with Bengaluru more than you would expect — which is
            where the name comes from.
          </p>
        </Story>
      </Band>

      {/* 6 · Did you know ------------------------------------------- */}
      <Band tone="raised">
        <div className="max-w-2xl">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Did you know
          </p>
          <h2 className="mt-5 font-display text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl">
            Six things worth knowing before you arrive
          </h2>
          <p className="mt-5 font-body text-base leading-relaxed text-muted-foreground">
            Tap a card.
          </p>
        </div>

        <AnimatedGroup
          preset="blur-slide"
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FACTS.map((fact, i) => (
            <Fact key={fact.title} fact={fact} index={i} />
          ))}
        </AnimatedGroup>
      </Band>

      {/* 7 · Support Flash ------------------------------------------ */}
      <Band className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="mx-auto max-w-2xl"
        >
          <GoldRule className="mx-auto w-20" />
          <h2 className="mt-8 font-display text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl md:text-6xl">
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
