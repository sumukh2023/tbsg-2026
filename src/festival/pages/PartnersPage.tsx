import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { FilmVeil, GoldRule, Grain, MarbleVeins } from '../materials';
import { HeroFilm } from './HeroFilm';
import { PageShell, Band } from './PageShell';
import { CHAPTERS } from './chapters';

/**
 * /partners — sponsorship.
 *
 * Built on the same shell, tokens, type and motion vocabulary as Our Mission,
 * and deliberately NOT on its compositions. Mission is a ceremonial page: a
 * centred hero pool, arched doorways, a dialog that opens over everything.
 * This is a business page and reads like one — the hero copy sits low and
 * left against a rule instead of floating in the middle, the sponsorship
 * categories open IN PLACE rather than over the page, and the partner wall is
 * a quiet grid. Same house, different room.
 *
 * The palette is the partners chapter's own (burgundy on warm stone), which
 * `PageShell` selects through `data-chapter`. Nothing here names a colour.
 */

const chapter = CHAPTERS[2];

/** The real structure, mirrored from api/partner-interest.ts. Not tiers. */
const CATEGORIES = [
  {
    id: 'powered-by',
    label: 'Powered By',
    role: 'Title partner',
    summary: 'One organisation, named alongside the festival itself.',
    body: [
      'The Powered By partner is the single organisation whose name sits with Flash @ Brigade wherever the festival appears: the gate, the stage, the passes, the programme, and every announcement made on the day.',
      'It is one name because it is meant to be one relationship. The partner is not a logo among many; they are the reason the day runs at the scale it does.',
    ],
  },
  {
    id: 'co-powered-by',
    label: 'Co-powered By',
    role: 'Supporting partners',
    summary: 'Several organisations, each carrying a part of the day.',
    body: [
      'Co-powered By is where most partnerships sit, and it is a group by design. Several organisations each take on a part of the festival — a district of the piazza, a stage, the mercato, the volunteer effort behind it.',
      'Every Co-powered partner is named in the same weight as the others. There is no ranking inside the group, because the day does not happen without all of it.',
    ],
  },
  {
    id: 'event-organised-by',
    label: 'Event Organised By',
    role: 'Event partner',
    summary: 'The organisation that helps put the day on its feet.',
    body: [
      'The Event Organised By partner works on the festival rather than beside it: production, staging, sound, and the logistics of turning a school into a piazza for a day and back again by the evening.',
      'It is the partnership with the most contact with the student committee, and the one most often taken up by an organisation that would rather give its craft than a cheque.',
    ],
  },
] as const;

/**
 * Flash 1.0's partners, from 2023. PLACEHOLDERS: no logo artwork exists in
 * this repository, so each mark is set typographically in the display face
 * rather than shown as a fake image. When the artwork arrives each entry
 * gains a `logo` and the plate renders that instead — the grid is unchanged.
 */
const FLASH_ONE = [
  { name: 'Hombale Films' },
  { name: 'Prem' },
  { name: 'Living Bean' },
  { name: 'HCrazy Holidays' },
  { name: 'SwimLife' },
  { name: 'EUR' },
] as const;

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-9 py-4 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';

/* -------------------------------------------------------------------- */
/*  Hero                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Full-viewport film with the words held low and left against a rule.
 *
 * The parallax is the same two-speed idea the rest of the site uses — film
 * slower than copy, and that difference IS the depth — but the arrangement is
 * this page's own: no centred pool, no wordmark, a horizon instead.
 */
function PartnersHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const filmY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const copyY = useTransform(scrollYProgress, [0.2, 0.9], [0, -70]);
  const copyFade = useTransform(scrollYProgress, [0.3, 0.85], [1, 0]);

  return (
    <header
      ref={ref}
      aria-label="Partners"
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: filmY }}
        className="pointer-events-none absolute -bottom-[14%] inset-x-0 top-0 -z-10"
      >
        <HeroFilm
          // The school's own grounds from the air — the field that becomes
          // the piazza. Silent, like every film on this site.
          src="/ground.mp4"
          webmSrc="/ground.webm"
          className="absolute inset-0"
          poster={
            // Until the film loads, and if it never does, the hero is the
            // site's own marble rather than a black rectangle.
            <div className="absolute inset-0 bg-background">
              <MarbleVeins className="opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_30%_80%,hsl(var(--primary)/0.18),transparent_72%)]" />
            </div>
          }
        />
        {/* Far lighter than Our Mission's 0.7, and deliberately: that hero
            sets type across the MIDDLE of its frame and needs the whole thing
            calmed. Here the words are held at the bottom, so the veil only has
            to seat the film in the site's materials and the gradient below
            does the actual protecting. Stacking both at full strength was
            what turned the film into a pale wash. */}
        <FilmVeil opacity={0.34} />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--background)/0.96),hsl(var(--background)/0.72)_30%,hsl(var(--background)/0.2)_58%,transparent_78%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
        <Grain />
      </motion.div>

      <motion.div
        style={{ y: copyY, opacity: copyFade }}
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 md:px-10 md:pb-32"
      >
        <div className="flex gap-6 md:gap-8">
          {/* The spine. It returns at the head of every section below, which
              is what ties four different layouts into one page without any
              of them repeating another. */}
          <motion.div
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.1, delay: 0.35, ease: EASE.out }}
            className="mt-2 w-px origin-top bg-gradient-to-b from-accent via-accent/50 to-transparent"
          />
          <div className="min-w-0">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: EASE.out }}
              className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent"
            >
              Insieme · Partnership
            </motion.p>
            <TextEffect
              as="h1"
              per="char"
              preset="fade-in-blur"
              delay={0.65}
              className="mt-5 font-display text-6xl font-medium leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl lg:text-9xl"
            >
              Partners
            </TextEffect>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.1, ease: EASE.out }}
              className="mt-8 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Support a student-led carnival that brings together the community
              while raising funds for a meaningful cause.
            </motion.p>
          </div>
        </div>
      </motion.div>
    </header>
  );
}

/* -------------------------------------------------------------------- */
/*  Shared section furniture                                             */
/* -------------------------------------------------------------------- */

/** The page's section head: the spine, a number, and a title. */
function SectionHead({
  n,
  eyebrow,
  title,
  className,
}: {
  n: string;
  eyebrow: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-6 md:gap-8', className)}>
      <GoldRule className="mt-3 h-px w-10 shrink-0 md:w-16" />
      <div className="min-w-0">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          <span className="tabular-nums">{n}</span>
          <span aria-hidden="true"> · </span>
          {eyebrow}
        </p>
        <h2 className="mt-4 max-w-[20ch] font-display text-4xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {title}
        </h2>
      </div>
    </div>
  );
}

/**
 * Reveals its children once, on the way in.
 *
 * `useInView` on the WRAPPER rather than `whileInView` on the moving element:
 * an IntersectionObserver clips against ancestor overflow, so an element that
 * starts translated out of its own clip box is never observed as visible and
 * the reveal never fires. That cost this project a page of invisible headings
 * once already — see the Mission page's `Rise`.
 */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-12% 0px -12% 0px' });
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.9, delay, ease: EASE.out }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  02 · Sponsorship categories                                          */
/* -------------------------------------------------------------------- */

/**
 * A category that opens IN PLACE.
 *
 * Deliberately not the dialog Our Mission uses for its facts. Someone
 * comparing three sponsorships needs to open two and look between them; a
 * modal can only ever show one, and takes the page away to do it.
 */
function CategoryCard({
  category,
  index,
}: {
  category: (typeof CATEGORIES)[number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `category-${category.id}`;

  return (
    <motion.div
      layout
      transition={{ duration: 0.5, ease: EASE.out }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card/70 transition-colors duration-500',
        open ? 'border-primary/45' : 'border-border/60 hover:border-primary/30'
      )}
    >
      {/* Reads as a card, behaves as a disclosure: the whole head is the
          control, so there is no small target to hunt for on a phone. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex flex-col items-start gap-5 p-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:p-8"
      >
        <span className="flex w-full items-start justify-between gap-4">
          <span className="font-body text-2xs font-semibold uppercase tracking-[0.22em] text-accent">
            {String(index + 1).padStart(2, '0')} · {category.role}
          </span>
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.4, ease: EASE.out }}
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors duration-500',
              open
                ? 'border-primary/50 text-primary'
                : 'border-border/70 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary'
            )}
          >
            <Plus className="h-4 w-4" />
          </motion.span>
        </span>

        <span className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          {category.label}
        </span>
        <span className="font-body text-sm leading-relaxed text-muted-foreground">
          {category.summary}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE.out }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border/60 px-7 py-7 md:px-8">
              {category.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="font-body text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* -------------------------------------------------------------------- */

export default function PartnersPage() {
  return (
    <PageShell chapter={chapter} hero={<PartnersHero />}>
      {/* 01 · Why partner with Flash -------------------------------- */}
      <Band>
        <SectionHead
          n="01"
          eyebrow="Why partner"
          title="A day the whole neighbourhood turns up for"
        />

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* The picture takes the wider column, so the section is asymmetric
              rather than a two-up. */}
          <Reveal className="lg:col-span-7">
            <figure className="relative">
              <div className="overflow-hidden rounded-2xl">
                <motion.img
                  src="/partners-ground.jpg"
                  alt="The Brigade School's ground seen from the air, with students on the field."
                  loading="lazy"
                  decoding="async"
                  width={1810}
                  height={814}
                  initial={{ scale: 1.08 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true, margin: '-10%' }}
                  transition={{ duration: 1.4, ease: EASE.out }}
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="mt-4 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">
                The ground, before it becomes a piazza
              </figcaption>
            </figure>
          </Reveal>

          <div className="lg:col-span-5">
            <AnimatedGroup preset="blur-slide" className="space-y-6">
              <p className="font-body text-lg leading-relaxed text-foreground">
                Flash @ Brigade is a charitable carnival run by the students of
                The Brigade School @ Malleswaram. They plan it, they build it,
                and on 14 November they run it.
              </p>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                For one day the school opens to everyone it belongs to —
                students and their families, alumni who have not walked through
                the gate in years, teachers, neighbours, and much of
                Malleswaram besides. The first edition raised ₹10 lakh.
              </p>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                A partner makes that day possible, and is seen making it
                possible: in front of a crowd that came because it is their
                school's carnival, not because they were sold a ticket to
                something.
              </p>
            </AnimatedGroup>

            <Reveal delay={0.15} className="mt-10">
              <dl className="grid grid-cols-3 gap-6 border-t border-border/60 pt-8">
                {[
                  ['₹10L', 'raised by Flash 1.0'],
                  ['1 day', '14 November 2026'],
                  ['100%', 'to the cause'],
                ].map(([figure, label]) => (
                  <div key={label}>
                    <dt className="font-display text-3xl font-medium tracking-tight text-primary md:text-4xl">
                      {figure}
                    </dt>
                    <dd className="mt-2 font-body text-xs leading-snug text-muted-foreground">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </Band>

      {/* 02 · Sponsorship categories -------------------------------- */}
      <Band tone="raised">
        <SectionHead
          n="02"
          eyebrow="How partnership works"
          title="Three ways to stand with the carnival"
        />
        <Reveal className="mt-8">
          <p className="max-w-2xl pl-16 font-body text-base leading-relaxed text-muted-foreground md:pl-24">
            Flash does not sell tiers. It has three kinds of partner, and they
            differ in what the partnership involves rather than in what it
            costs. Open one to read what it means.
          </p>
        </Reveal>

        <div className="mt-12 grid items-start gap-6 md:grid-cols-3">
          {CATEGORIES.map((category, i) => (
            <Reveal key={category.id} delay={i * 0.08}>
              <CategoryCard category={category} index={i} />
            </Reveal>
          ))}
        </div>
      </Band>

      {/* 03 · Flash 1.0 partners ------------------------------------ */}
      <Band>
        <SectionHead
          n="03"
          eyebrow="Flash 1.0 · 2023"
          title="Who stood with us the first time"
        />

        <Reveal className="mt-14">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
            {FLASH_ONE.map((partner, i) => (
              <motion.li
                key={partner.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: '-8%' }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: EASE.out }}
                className="group relative flex min-h-32 items-center justify-center bg-card px-6 py-10 text-center transition-colors duration-500 hover:bg-card/60 md:min-h-40"
              >
                {/* A gold hairline that draws itself under the name on hover:
                    the smallest gesture that still reads as a response. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-8 bottom-7 h-px origin-left scale-x-0 bg-accent/70 transition-transform duration-500 group-hover:scale-x-100"
                />
                <span className="font-display text-xl font-medium tracking-tight text-muted-foreground transition-colors duration-500 group-hover:text-foreground md:text-2xl">
                  {partner.name}
                </span>
              </motion.li>
            ))}
          </ul>
        </Reveal>
      </Band>

      {/* 04 · Become a partner -------------------------------------- */}
      <Band tone="raised">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-background px-8 py-16 text-center md:px-16 md:py-24">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <MarbleVeins className="opacity-40" />
              <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />
            </div>

            <div className="relative">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                04 · Become a partner
              </p>
              <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-4xl font-medium leading-[1.06] tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Tell us what you have in mind
              </h2>
              <p className="mx-auto mt-7 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg">
                Organisations interested in partnering with Flash @ Brigade can
                send an Expression of Interest. It takes a couple of minutes,
                commits you to nothing, and puts you in front of the student
                committee rather than a queue.
              </p>

              <div className="mt-11 flex flex-col items-center gap-4">
                <Link to="/partner-interest" className={primaryButton}>
                  Partner With Us
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <p className="font-body text-xs text-muted-foreground">
                  Or write to the{' '}
                  <Link
                    to="/enquiry"
                    className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
                  >
                    Festival Desk
                  </Link>{' '}
                  if you would rather ask something first.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Band>
    </PageShell>
  );
}
