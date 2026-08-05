import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  Eye,
  GraduationCap,
  HeartHandshake,
  MonitorSmartphone,
  Plus,
  Sprout,
  Users,
} from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { FilmVeil, GoldRule, Grain, MarbleVeins } from '../materials';
import { HeroFilm } from './HeroFilm';
import { PageShell, Band } from './PageShell';
import { CHAPTERS } from './chapters';

/**
 * /partners, sponsorship.
 *
 * Built on the same shell, tokens, type and motion vocabulary as Our Mission,
 * and deliberately NOT on its compositions. Mission is a ceremonial page: a
 * centred hero pool, arched doorways, a dialog that opens over everything.
 * This is a business page and reads like one. The sponsorship
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
    ],
  },
  {
    id: 'co-powered-by',
    label: 'Co-powered By',
    role: 'Supporting partners',
    summary: 'Several organisations, each carrying a part of the day.',
    body: [
      'Co-powered By is where most partnerships sit, and it is a group by design. Several organisations each take on a part of the festival: a district of the piazza, a stage, the mercato, the volunteer effort behind it.',
    ],
  },
  {
    id: 'event-organised-by',
    label: 'Event Organised By',
    role: 'Event partner',
    summary: 'The organisation that helps put the day on its feet.',
    body: [
      'The Event Organised By partner works on the festival rather than beside it: production, staging, sound, and the logistics of turning a school into a memorable piazza, creating an unforgettable experience for visitors.',
    ],
  },
] as const;

/**
 * What a partner actually gets. Written as six things rather than three
 * paragraphs because this is the part a sponsor scans, not the part they
 * read.
 */
const BENEFITS = [
  {
    icon: Eye,
    title: 'Brand Visibility',
    body: 'Your name on the gate, the stage, the passes and the programme, in front of everyone who comes through.',
  },
  {
    icon: Users,
    title: 'Thousands of Visitors',
    body: 'Families, alumni, staff and neighbours across one day, arriving because it is their school\u2019s carnival.',
  },
  {
    icon: HeartHandshake,
    title: 'Community Engagement',
    body: 'A local audience that already knows the school, met somewhere they chose to be rather than through an ad.',
  },
  {
    icon: GraduationCap,
    title: 'Student Collaboration',
    body: 'The committee is students. Partners work with them directly, which is the part most partners say they remember.',
  },
  {
    icon: Sprout,
    title: 'CSR Opportunity',
    body: 'Every rupee raised goes to children\u2019s education and healthcare, with the accounts published afterwards.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Digital & On-ground',
    body: 'Named on this site and across the festival\u2019s channels, as well as everywhere the day itself is signed.',
  },
] as const;

/**
 * EXAMPLES, and the wording has to keep saying so. Nothing here is promised
 * to any partner: what a given partnership carries is settled in the
 * conversation, and a page that reads like a rate card would be writing
 * cheques the committee has not agreed to.
 */
const RECOGNITION = [
  {
    title: 'Main Entrance Branding',
    body: 'The arch everyone walks through, and the first thing photographed.',
    tone: ['hsl(var(--primary)/0.22)', 'hsl(var(--accent)/0.14)'],
  },
  {
    title: 'Stage Branding',
    body: 'The backdrop behind every performance and every announcement.',
    tone: ['hsl(var(--accent)/0.2)', 'hsl(var(--primary)/0.12)'],
  },
  {
    title: 'Social Media',
    body: 'In the run-up and on the day, across the festival\u2019s own channels.',
    tone: ['hsl(var(--accent)/0.18)', 'hsl(var(--primary)/0.16)'],
  },
  {
    title: 'Event Announcements',
    body: 'Read out from the stage through the day, not only at the opening.',
    tone: ['hsl(var(--primary)/0.2)', 'hsl(var(--accent)/0.12)'],
  },
  {
    title: 'Digital Screens',
    body: 'The screens beside the stage and around the piazza, between acts.',
    tone: ['hsl(var(--accent)/0.16)', 'hsl(var(--primary)/0.2)'],
  },
  {
    title: 'Printed Collateral',
    body: 'Programmes, passes, signage and the map handed out at the gate.',
    tone: ['hsl(var(--primary)/0.14)', 'hsl(var(--accent)/0.18)'],
  },
] as const;

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-9 py-4 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';

/** The second action, which must not compete with the first. */
const quietButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-background/50 px-9 py-4 font-body text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';

/* -------------------------------------------------------------------- */
/*  Hero                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Full-viewport film with the words centred in the frame.
 *
 * The parallax is the same two-speed idea the rest of the site uses: film
 * slower than copy, and that difference IS the depth.
 */
function PartnersHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const filmY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const copyY = useTransform(scrollYProgress, [0.25, 0.9], [0, -70]);
  const copyFade = useTransform(scrollYProgress, [0.35, 0.85], [1, 0]);

  return (
    <header
      ref={ref}
      aria-label="Partners"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: filmY }}
        className="pointer-events-none absolute inset-x-0 -bottom-[14%] top-0 -z-10"
      >
        <HeroFilm
          src="/hero.mp4"
          webmSrc="/hero.webm"
          className="absolute inset-0"
          poster={
            <div className="absolute inset-0 bg-background">
              <MarbleVeins className="opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_40%,hsl(var(--primary)/0.18),transparent_72%)]" />
            </div>
          }
        />
        {/* Type sits in the MIDDLE of the frame now rather than along the
            bottom, so the whole film has to be calmed rather than just seated.
            This is Our Mission's strength for Our Mission's reason. */}
        <FilmVeil opacity={0.7} />
        {/* The pool travels with the copy, which is what stops a centred hero
            reading as a caption laid on a video. */}
        <div className="absolute inset-0 bg-[radial-gradient(58%_44%_at_50%_50%,hsl(var(--background)/0.72),transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        <Grain />
      </motion.div>

      <motion.div
        style={{ y: copyY, opacity: copyFade }}
        className="relative z-10 mx-auto w-full max-w-3xl px-6 text-center md:px-10"
      >
        {/* The wordmark reads as ink, with the @ carrying the page's accent.
            One character of colour is enough to place it, and it keeps the
            eyebrow from competing with the title underneath. */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE.out }}
          className="font-body text-xs font-semibold uppercase tracking-[0.3em] text-foreground"
        >
          Flash <span className="text-accent">@</span> Brigade
        </motion.p>
        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.7}
          className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Partner With Us
        </TextEffect>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.15, ease: EASE.out }}
          className="mx-auto mt-8 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Support a student-led carnival that brings together the community
          while raising funds for a meaningful cause.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.45, ease: EASE.out }}
          className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link to="/partner-interest" className={primaryButton}>
            Partner With Us
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <a href="#why-partner" className={quietButton}>
            Read More
            {/* The same arrow the landing page uses to send you down the
                page: it settles, then nudges once under the cursor. */}
            <motion.span
              aria-hidden="true"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <ArrowDown className="h-4 w-4" />
            </motion.span>
          </a>
        </motion.div>
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
 * once already. See the Mission page's `Rise`.
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

/**
 * A benefit. Everything that moves on hover moves TOGETHER, the plate lifting
 * as the rule draws and the icon warms, because three separate little
 * animations on one card is a card that fidgets.
 */
function BenefitCard({
  benefit,
}: {
  benefit: (typeof BENEFITS)[number];
}) {
  const Icon = benefit.icon;
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: EASE.out }}
      className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card p-7 transition-shadow duration-500 hover:shadow-[0_24px_50px_-28px_hsl(var(--primary)/0.45)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent/60 to-transparent transition-transform duration-700 group-hover:scale-x-100"
      />
      <Icon
        aria-hidden="true"
        className="h-6 w-6 text-accent transition-transform duration-500 group-hover:scale-110"
      />
      <h3 className="mt-5 font-display text-2xl font-medium tracking-tight text-foreground">
        {benefit.title}
      </h3>
      <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
        {benefit.body}
      </p>
    </motion.article>
  );
}

/**
 * A recognition example.
 *
 * The plate at the top is a WASH, not a photograph, and that is not a
 * placeholder waiting to be filled: there is no photograph of a 2026 entrance
 * arch because the arch does not exist yet, and staging a mock-up of one
 * would be showing a sponsor something that has not been built. The wash
 * carries the page's own colours and the label does the work.
 */
function RecognitionCard({
  item,
}: {
  item: (typeof RECOGNITION)[number];
}) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: EASE.out }}
      className="group h-full overflow-hidden rounded-2xl border border-border/60 bg-background transition-shadow duration-500 hover:shadow-[0_24px_50px_-28px_hsl(var(--primary)/0.4)]"
    >
      <div
        aria-hidden="true"
        className="relative h-28 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${item.tone[0]}, ${item.tone[1]})`,
        }}
      >
        <MarbleVeins className="opacity-40" />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(60%_120%_at_20%_0%,hsl(var(--background)/0.55),transparent_70%)]"
          initial={false}
          whileHover={{ opacity: 0.6 }}
        />
        <span className="absolute inset-x-0 bottom-0 h-px bg-accent/50" />
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl font-medium tracking-tight text-foreground">
          {item.title}
        </h3>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          {item.body}
        </p>
      </div>
    </motion.article>
  );
}

/* -------------------------------------------------------------------- */

export default function PartnersPage() {
  return (
    <PageShell chapter={chapter} hero={<PartnersHero />}>
      {/* 01 · Why partner with Flash -------------------------------- */}
      <Band id="why-partner">
        <SectionHead
          n="01"
          eyebrow="Why partner"
          title="A day the whole city turns up for"
        />

        {/* Tightened from mt-14/gap-12/gap-16. The picture and the words are
            one thought and were reading as two, with a corridor of empty
            column between them. */}
        <div className="mt-9 grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
          {/* The picture takes the wider column, so the section is asymmetric
              rather than a two-up. */}
          <Reveal className="lg:col-span-8">
            <figure className="relative">
              <div className="overflow-hidden rounded-2xl">
                <motion.img
                  // The space in the filename is percent-encoded, exactly as
                  // "Our Mission.mp4" is: an unencoded space is not a valid
                  // URL and Safari will not fetch it.
                  src="/carnival%20ground.png"
                  alt="The carnival in full swing on the school ground, seen from the air."
                  loading="lazy"
                  decoding="async"
                  initial={{ scale: 1.08 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true, margin: '-10%' }}
                  transition={{ duration: 1.4, ease: EASE.out }}
                  className="h-full w-full object-cover"
                />
              </div>
            </figure>
          </Reveal>

          <div className="lg:col-span-4">
            <AnimatedGroup preset="blur-slide" className="space-y-6">
              <p className="font-body text-lg leading-relaxed text-foreground">
                Flash @ Brigade is a charitable carnival run by the students of
                The Brigade School @ Malleswaram. They plan it, they build it,
                and on 14 November they run it.
              </p>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                For one day the school opens to everyone it belongs to:
                students and their families, alumni who have not walked through
                the gate in years, teachers, and much of the neighbourhood.
              </p>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                The Brigade Foundation looks for partners rather than patrons:
                people and organisations who share the concern and want to put
                weight behind it.
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
            Flash offers three partnership categories, each defined by the
            nature of the collaboration rather than sponsorship value. Open a
            category to learn more.
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

      {/* 03 · What a partnership carries ---------------------------- */}
      <Band id="benefits">
        <SectionHead
          n="03"
          eyebrow="Sponsorship benefits"
          title="What a partnership carries"
        />

        {/* `auto-rows-fr` is the fix for the sixth card standing taller than
            the rest: without it each ROW sizes to its own tallest card, so one
            title wrapping to a second line lifted the whole bottom row. */}
        <div className="mt-12 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit, i) => (
            <Reveal key={benefit.title} delay={i * 0.07}>
              <BenefitCard benefit={benefit} />
            </Reveal>
          ))}
        </div>
      </Band>

      {/* 04 · Examples of recognition ------------------------------- */}
      <Band tone="raised" id="recognition">
        <SectionHead
          n="04"
          eyebrow="Recognition"
          title="Examples of recognition opportunities"
        />
        <Reveal className="mt-8">
          <p className="max-w-2xl pl-16 font-body text-base leading-relaxed text-muted-foreground md:pl-24">
            These are examples of how a partner can appear across the festival,
            not a fixed list and not a guarantee. What any particular
            partnership carries is agreed with the student committee when you
            talk to them.
          </p>
        </Reveal>

        <div className="mt-12 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECOGNITION.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.06}>
              <RecognitionCard item={item} />
            </Reveal>
          ))}
        </div>
      </Band>

      {/* 05 · Current sponsors -------------------------------------- */}
      <Band>
        <SectionHead
          n="05"
          eyebrow="Current sponsors"
          title="Confirmed partners"
        />

        <Reveal className="mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-8 py-20 text-center md:py-28">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <MarbleVeins className="opacity-30" />
              <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--accent)/0.14),transparent_70%)]" />
            </div>
            <div className="relative">
              <GoldRule className="mx-auto w-16" />
              <p className="mt-7 font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
                Coming soon
              </p>
              <p className="mx-auto mt-6 max-w-lg font-body text-base leading-relaxed text-muted-foreground">
                Sponsor applications are currently open. Confirmed partners
                will be shown here as they join Flash @ Brigade 2026.
              </p>
              {/* Flash 1.0's partners are not listed here on purpose: this
                  section answers who is with us THIS year, and filling it with
                  2023 would answer a question nobody asked. */}
            </div>
          </div>
        </Reveal>
      </Band>

      {/* Become a partner. Unnumbered: it is the page's close, not another
          chapter of it. --------------------------------------------- */}
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
                Become a partner
              </p>
              <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-4xl font-medium leading-[1.06] tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Tell us what you have in mind
              </h2>
              <p className="mx-auto mt-7 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg">
                Organisations interested in partnering with Flash @ Brigade can
                send an Expression of Interest by filling the form below.
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
