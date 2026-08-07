import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUpRight, Play } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { FilmVeil, Grain, MarbleVeins } from '../materials';
import { CHAPTERS } from './chapters';
import { PageShell, Band } from './PageShell';
import { HeroFilm } from './HeroFilm';
import { Lightbox } from '../gallery/Lightbox';
import { MasonryWall } from '../gallery/MasonryWall';
import { Plate } from '../gallery/Plate';
import {
  CATALOGUE,
  FILMS,
  FLASH_ONE,
  thumbnailFor,
  type Film,
  type Photo,
} from '../gallery/photos';

const chapter = CHAPTERS[3];

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-9 py-4 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';

const quietButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-background/50 px-9 py-4 font-body text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]';


/**
 * Section 02, in the order it happened.
 *
 * `photo` where one exists, `figure` where none does. See the note in the
 * section itself for why the two are interchangeable rather than one being a
 * fallback for the other.
 */
const LENS: {
  n: string;
  title: string;
  body: string;
  photo?: Photo;
  figure?: string;
  figureLabel?: string;
}[] = [
  {
    n: '01',
    title: 'It starts in a classroom',
    body: 'A student committee, a teacher who agreed to sponsor it, and a list of everything that would have to be true by November. The first meeting is nine months out and mostly consists of finding out how much nobody knows yet.',
    figure: '9',
    figureLabel: 'months between the first committee meeting and the gate opening',
  },
  {
    n: '02',
    title: 'Everything is painted by hand',
    body: 'No panel on the ground was bought. The camels, the arches, the fort skyline behind the stage: all of it drawn, cut and painted in school, in the weeks when the art room stopped being an art room and became a workshop.',
    photo: FLASH_ONE.find((p) => p.id === 'decorations'),
  },
  {
    n: '03',
    title: 'The ground becomes a mela',
    body: 'The stage goes up over two days. The canopies go up in one morning. By eight on the Saturday the field a school plays football on has forty-two stalls, a sound rig and a queue at the gate.',
    figure: '42',
    figureLabel: 'stalls raised on a football field in a single morning',
  },
  {
    n: '04',
    title: 'And then it opens',
    body: 'Every year the last hour before the ribbon is the same: nothing is finished, and then all at once everything is. The people who built it spend the day watching everybody else enjoy it, which is the part they signed up for.',
    figure: '10',
    figureLabel: 'lakh rupees raised by the first edition, in one day',
  },
];

/* -------------------------------------------------------------------- */
/*  Shared furniture                                                     */
/* -------------------------------------------------------------------- */

/**
 * Reveals its children once, on the way in.
 *
 * `useInView` on the WRAPPER rather than `whileInView` on the moving element:
 * an IntersectionObserver clips against ancestor overflow, so an element that
 * starts translated out of its own clip box is never observed as visible and
 * the reveal never fires. That cost this project a page of invisible headings
 * once already. Same reasoning as Partners' `Reveal` and Mission's `Rise`.
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
  const inView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' });
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.9, delay, ease: EASE.out }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The Gallery's section head.
 *
 * DELIBERATELY NOT Partners' rule-and-number or Mission's numbered tile. This
 * is a page about looking, so its heading is a plate: the number sits in a
 * small framed square, like a contact-sheet index, and the title runs beside
 * it. Same type scale and the same eyebrow colour as every other district, so
 * it belongs; a different object, so it does not read as the same page twice.
 */
function SectionHead({
  n,
  eyebrow,
  title,
  lede,
  align = 'left',
  className,
}: {
  n: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === 'center' && 'mx-auto max-w-3xl text-center',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-4',
          align === 'center' && 'justify-center'
        )}
      >
        <span
          aria-hidden="true"
          className="grid h-9 w-9 flex-none place-items-center rounded-[0.3rem] border border-accent/45 font-body text-xs tabular-nums text-accent"
        >
          {n}
        </span>
        <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </p>
      </div>
      <h2
        className={cn(
          'mt-6 font-display text-4xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl',
          align === 'left' && 'max-w-[18ch]'
        )}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            'mt-6 font-body text-base leading-relaxed text-muted-foreground md:text-lg',
            align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-xl'
          )}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

/**
 * A figure standing in for a photograph that was never taken.
 *
 * NOT A PLACEHOLDER. The plate it replaces would have said "being digitised"
 * over a grey rectangle, which reads as a page that is not finished. This is
 * a number set at the size a photograph would have been, on the page's own
 * materials, and it carries a fact the picture could only have implied. A
 * reader who never sees the photograph is not being shown an absence.
 */
function Figure({ value, label }: { value?: string; label?: string }) {
  return (
    <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card px-8 text-center">
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(65%_60%_at_50%_35%,hsl(var(--accent)/0.13),transparent_75%)]" />
        <Grain className="opacity-[0.05]" />
      </div>
      <p className="relative font-display text-6xl font-medium leading-none tracking-tight text-primary sm:text-7xl md:text-8xl">
        {value}
      </p>
      <p className="relative mt-5 max-w-[22ch] font-body text-sm leading-relaxed text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Hero                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Full-viewport film with the words centred in the frame.
 *
 * The structure is the one Our Mission and Partners settled on, because the
 * brief asks for the three headers to be the same object: same two-speed
 * parallax, same veil strength, same travelling pool behind the copy, same
 * wordmark-eyebrow. What differs is only what the tokens make different, and
 * on this district that is sea blue.
 */
function GalleryHero() {
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
      aria-label="Gallery"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: filmY }}
        className="pointer-events-none absolute inset-x-0 -bottom-[14%] top-0 -z-10"
      >
        <HeroFilm
          // The carnival film, which is Flash 1.0 footage and therefore the
          // right thing behind this page's title. Declared with the same webm
          // companion the landing hero names, so a browser without H.264
          // picks it up the day that file lands.
          src="/carnival.mp4"
          webmSrc="/carnival.webm"
          className="absolute inset-0"
          poster={
            <div className="absolute inset-0 bg-background">
              <MarbleVeins className="opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_40%,hsl(var(--primary)/0.18),transparent_72%)]" />
            </div>
          }
        />
        <FilmVeil opacity={0.7} />
        <div className="absolute inset-0 bg-[radial-gradient(58%_44%_at_50%_50%,hsl(var(--background)/0.72),transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        <Grain />
      </motion.div>

      <motion.div
        style={{ y: copyY, opacity: copyFade }}
        className="relative z-10 mx-auto w-full max-w-3xl px-6 text-center md:px-10"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE.out }}
          className="font-body text-xs font-semibold uppercase tracking-[0.3em] text-foreground"
        >
          Flash <span className="text-primary">@</span> Brigade
        </motion.p>
        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.7}
          className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Gallery
        </TextEffect>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.15, ease: EASE.out }}
          className="mx-auto mt-8 max-w-xl font-body text-base italic leading-relaxed text-muted-foreground md:text-lg"
        >
          Relive the moments that brought a school together, celebrate the
          journey of Flash 1.0, and follow the story as Flash @ Brigade 2026
          comes to life.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.45, ease: EASE.out }}
          className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a href="#the-gallery" className={primaryButton}>
            Explore Gallery
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
          <a href="#highlights" className={quietButton}>
            Read More
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
/*  03 · Film card                                                       */
/* -------------------------------------------------------------------- */

/**
 * A video, as a card that opens where the video lives.
 *
 * NO IFRAME. Two embedded players is two third-party bundles and a set of
 * cookies from another origin on a page whose whole job is photographs. The
 * card costs one still.
 *
 * THE STILL COMES FROM YOUTUBE and may not arrive: the container this is
 * developed in cannot reach `img.youtube.com` at all, and in the world a
 * video can be made private long after this card was written. Either way the
 * frame falls back to the page's own material rather than to a broken image,
 * so the card is always a card.
 */
function FilmCard({ film, index }: { film: Film; index: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <Reveal delay={index * 0.1}>
      <a
        href={film.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block focus-visible:outline-none"
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-lg border border-border bg-secondary/50 transition-shadow duration-500 group-hover:shadow-[0_36px_90px_-50px_hsl(var(--foreground)/0.65)] group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background',
            film.orientation === 'landscape'
              ? 'aspect-video'
              : 'mx-auto aspect-[9/16] max-w-[19rem]'
          )}
        >
          {failed ? (
            <div aria-hidden="true" className="absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_35%,hsl(var(--accent)/0.2),transparent_75%)]" />
              <Grain className="opacity-[0.07]" />
            </div>
          ) : (
            <img
              src={thumbnailFor(film.youtubeId)}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
            />
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(205_45%_7%/0.86)] via-[hsl(205_45%_7%/0.25)] to-[hsl(205_45%_7%/0.15)]" />

          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:border-white/60 group-hover:bg-white/20 md:h-20 md:w-20">
              <Play
                aria-hidden="true"
                // Nudged right: an equilateral triangle in a circle looks
                // off-centre unless its optical centre is, which is a
                // millimetre of care nobody notices until it is missing.
                className="ml-0.5 h-6 w-6 fill-current md:h-7 md:w-7"
              />
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-body text-[0.7rem] uppercase tracking-[0.2em] text-white/60">
                  {film.orientation === 'landscape'
                    ? 'The film'
                    : 'Vertical cut'}
                  {film.duration && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">{film.duration}</span>
                    </>
                  )}
                </p>
                <h3 className="mt-2 font-display text-xl font-medium leading-tight tracking-tight text-white md:text-2xl">
                  {film.title}
                </h3>
              </div>
              <ArrowUpRight
                aria-hidden="true"
                className="mt-1 h-5 w-5 flex-none text-white/70 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
              />
            </div>
          </div>
        </div>
        <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
          {film.blurb}
        </p>
        <span className="sr-only">Opens on YouTube in a new tab</span>
      </a>
    </Reveal>
  );
}

/* -------------------------------------------------------------------- */
/*  Page                                                                 */
/* -------------------------------------------------------------------- */

export default function GalleryPage() {
  /* ONE LIGHTBOX FOR THE WHOLE PAGE, holding the list it was opened from.
     Each section is a different set of photographs, and the arrows have to
     move through the set the reader actually clicked, not through the
     catalogue: someone paging through the mosaic should not find themselves
     in the middle of the wall. */
  const [viewer, setViewer] = useState<{
    photos: Photo[];
    index: number;
  } | null>(null);

  const open = useCallback((photo: Photo, within: Photo[]) => {
    const list = within.filter((p) => p.src);
    const index = list.findIndex((p) => p.id === photo.id);
    if (index >= 0) setViewer({ photos: list, index });
  }, []);
  const close = useCallback(() => setViewer(null), []);
  const navigate = useCallback(
    (index: number) => setViewer((v) => (v ? { ...v, index } : v)),
    []
  );

  // The mosaic's own composition, by position rather than by index maths, so
  // the shape is readable here rather than computed somewhere else.
  const [ribbon, ground, stageWide, choir, folk, massDance, crowd, decorations] =
    FLASH_ONE;

  return (
    <PageShell chapter={chapter} hero={<GalleryHero />}>
      {/* 01 · Flash 1.0 Highlights ------------------------------------ */}
      <Band id="highlights">
        <Reveal>
          <SectionHead
            n="01"
            eyebrow="Flash 1.0 · 2023"
            title={
              <>
                One day, and a school
                <br />
                <span className="italic text-primary">nobody recognised</span>
              </>
            }
            lede="Rangeelo Rajasthan turned a Bengaluru school ground into a Rajasthani mela for a single Saturday, and raised ten lakh rupees doing it. These are the photographs that survived the day."
          />
        </Reveal>

        {/* THE MOSAIC IS A COMPOSITION, not a grid with gaps.
            Twelve columns, and each photograph takes the span its shape
            deserves: the aerial of the whole ground runs full width because
            it is the only picture that shows the scale, the two stage
            photographs sit as a pair because they are the same subject an
            hour apart, and the portraits of the crowd break the rhythm so
            the eye does not settle into a pattern. On a phone it becomes one
            column in the same order, which is the order the day ran. */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-12 md:gap-5">
          <Plate
            photo={ground}
            onOpen={() => open(ground, FLASH_ONE)}
            priority
            sizes="(min-width: 768px) 100vw, 100vw"
            className="md:col-span-12"
          />
          <Plate
            photo={ribbon}
            onOpen={() => open(ribbon, FLASH_ONE)}
            sizes="(min-width: 768px) 58vw, 100vw"
            className="md:col-span-7"
          />
          <Plate
            photo={decorations}
            onOpen={() => open(decorations, FLASH_ONE)}
            sizes="(min-width: 768px) 42vw, 100vw"
            className="md:col-span-5"
          />
          <Plate
            photo={stageWide}
            onOpen={() => open(stageWide, FLASH_ONE)}
            sizes="(min-width: 768px) 42vw, 100vw"
            className="md:col-span-5"
          />
          <Plate
            photo={massDance}
            onOpen={() => open(massDance, FLASH_ONE)}
            sizes="(min-width: 768px) 58vw, 100vw"
            className="md:col-span-7"
          />
          <Plate
            photo={folk}
            onOpen={() => open(folk, FLASH_ONE)}
            sizes="(min-width: 768px) 34vw, 100vw"
            className="md:col-span-4"
          />
          <Plate
            photo={crowd}
            onOpen={() => open(crowd, FLASH_ONE)}
            sizes="(min-width: 768px) 34vw, 100vw"
            className="md:col-span-4"
          />
          <Plate
            photo={choir}
            onOpen={() => open(choir, FLASH_ONE)}
            sizes="(min-width: 768px) 34vw, 100vw"
            className="md:col-span-4"
          />
        </div>
      </Band>

      {/* 02 · Through the Lens ---------------------------------------- */}
      <Band tone="raised" id="through-the-lens">
        <Reveal>
          <SectionHead
            n="02"
            eyebrow="Through the Lens"
            title={
              <>
                The nine months
                <br />
                <span className="italic text-primary">before the gate opened</span>
              </>
            }
            lede="A carnival looks effortless for one day because a hundred people spent the better part of a year making sure it would. This is the part of Flash nobody photographed enough of, told in the order it happened."
          />
        </Reveal>

        {/* AN EDITORIAL COLUMN, not another grid. Section 01 and section 04
            are both walls of photographs; a third would make the page one
            idea repeated. Here the story carries the section and the
            photographs illustrate it, so the chapters alternate side to side
            and the type has room to be read.

            A CHAPTER WITH NO PHOTOGRAPH GETS A NUMBER, NOT AN EMPTY FRAME.
            Only one of these four moments was photographed, because the
            cameras came out once the carnival started, and a run of grey
            plates reading "being digitised" made the section look broken
            rather than unfinished. A figure set large is a real editorial
            device and it carries the same fact the missing picture would
            have: the nine months, the forty-two stalls, the ten lakh. */}
        <div className="mt-16 space-y-16 md:mt-24 md:space-y-28">
          {LENS.map((entry, i) => (
            <Reveal key={entry.n}>
              <div
                className={cn(
                  'grid items-center gap-8 md:grid-cols-12 md:gap-14',
                  // Alternating, so the column has a rhythm rather than a
                  // left margin of identical objects.
                  i % 2 === 1 && 'md:[&>*:first-child]:order-2'
                )}
              >
                <div className="md:col-span-6">
                  {entry.photo ? (
                    <Plate
                      photo={entry.photo}
                      onOpen={() => open(entry.photo as Photo, FLASH_ONE)}
                      caption={false}
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  ) : (
                    <Figure value={entry.figure} label={entry.figureLabel} />
                  )}
                </div>
                <div className="md:col-span-6">
                  <p className="font-body text-xs tabular-nums uppercase tracking-[0.24em] text-accent">
                    {entry.n}
                  </p>
                  <h3 className="mt-4 font-display text-2xl font-medium leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
                    {entry.title}
                  </h3>
                  <p className="mt-5 font-body text-base leading-relaxed text-muted-foreground">
                    {entry.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* 03 · Flash 1.0 Film ------------------------------------------ */}
      <Band id="film">
        <Reveal>
          <SectionHead
            n="03"
            eyebrow="Il Film"
            title={
              <>
                Rangeelo Rajasthan,
                <br />
                <span className="italic text-primary">moving</span>
              </>
            }
            lede="Two cuts of the same day, both shot on the ground. They open on YouTube, where they live."
            align="center"
          />
        </Reveal>

        <div className="mt-14 grid items-start gap-10 md:mt-20 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-7">
            <FilmCard film={FILMS[0]} index={0} />
          </div>
          <div className="md:col-span-5">
            <FilmCard film={FILMS[1]} index={1} />
          </div>
        </div>

        {/* STILLS FROM THE FILM, as a strip rather than as cards. A row of
            wide crops under a video reads as frames pulled from it, which is
            what they are. */}
        <Reveal delay={0.1} className="mt-20 md:mt-28">
          <p className="font-body text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Stills from the day
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
            {[choir, folk, crowd].map((photo) => (
              <Plate
                key={photo.id}
                photo={photo}
                onOpen={() => open(photo, [choir, folk, crowd])}
                sizes="(min-width: 640px) 33vw, 100vw"
              />
            ))}
          </div>
        </Reveal>
      </Band>

      {/* 04 · The Gallery --------------------------------------------- */}
      <Band tone="raised" id="the-gallery">
        <Reveal>
          <SectionHead
            n="04"
            eyebrow="L'Archivio"
            title={
              <>
                Everything,
                <br />
                <span className="italic text-primary">in one wall</span>
              </>
            }
            lede="The full archive, by subject. Open any photograph to see it full screen, and use the arrow keys to move through the set."
            align="center"
          />
        </Reveal>

        <div className="mt-14 md:mt-20">
          <MasonryWall photos={CATALOGUE} onOpen={open} />
        </div>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-14 max-w-xl text-center font-body text-sm leading-relaxed text-muted-foreground">
            The Flash 1.0 archive is still being digitised, so this wall grows.
            If you photographed Rangeelo Rajasthan and would like your pictures
            here, the{' '}
            <Link
              to="/enquiry"
              className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              front desk
            </Link>{' '}
            would like to hear from you.
          </p>
        </Reveal>
      </Band>

      {/* 05 · Looking Ahead ------------------------------------------- */}
      <Band>
        <Reveal>
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* The 2026 section is a FRAME WITH NOTHING IN IT YET, and says
                so with the site's own materials rather than with an empty
                state. The photograph behind it is from the last edition,
                pushed back under a heavy veil: the past, out of focus,
                behind the year that has not happened. */}
            <div aria-hidden="true" className="absolute inset-0">
              <img
                src={ground.src}
                alt=""
                width={ground.width}
                height={ground.height}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-background/[0.90] backdrop-blur-[3px]" />
              <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_40%,hsl(var(--accent)/0.16),transparent_75%)]" />
              <Grain className="opacity-[0.05]" />
            </div>

            <div className="relative px-6 py-20 text-center md:px-16 md:py-28">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                Flash <span className="text-primary">@</span> Brigade 2026
              </p>
              <h2 className="mx-auto mt-6 max-w-[16ch] font-display text-4xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Memories waiting
                <br />
                <span className="italic text-primary">to be made</span>
              </h2>
              <p className="mx-auto mt-7 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg">
                On 14 November 2026 the ground becomes an Italian piazza and
                this page starts filling again. Photographs from Namma Mia
                Carpisa will appear here after the day, alongside the ones
                above.
              </p>

              {/* Three empty frames, which is the whole idea said visually.
                  They carry the page's own material rather than a dashed
                  border, so they read as plates waiting for pictures instead
                  of as an upload control. */}
              <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-3 md:gap-5">
                {['Il Mercato', 'La Piazza', 'La Sera'].map((label, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-10% 0px' }}
                    transition={{
                      duration: 0.8,
                      delay: 0.1 + i * 0.12,
                      ease: EASE.out,
                    }}
                    /* `bg-card`, not a translucent wash. Over the veiled
                       photograph behind this panel a semi-transparent plate
                       nearly vanished, so three frames waiting for pictures
                       read as three smudges. Opaque, they read as frames. */
                    className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(65%_60%_at_50%_30%,hsl(var(--accent)/0.14),transparent_75%)]" />
                    <Grain className="opacity-[0.06]" />
                    <p className="absolute inset-x-0 bottom-0 p-3 text-center font-body text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground md:text-[0.7rem]">
                      {label}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/get-passes" className={primaryButton}>
                  Get passes
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link to="/mission" className={quietButton}>
                  Our Mission
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Band>

      <Lightbox
        photos={viewer?.photos ?? []}
        index={viewer?.index ?? null}
        onClose={close}
        onNavigate={navigate}
      />
    </PageShell>
  );
}
