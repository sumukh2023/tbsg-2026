import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { Magnetic } from '@/components/motion/magnetic';
import { EASE } from '@/utils/motion';
import { HeroFilm } from './pages/HeroFilm';
import { FilmVeil, Grain, MarbleVeins } from './materials';

/**
 * The landing hero.
 *
 * The film used to be SCRUBBED: its playhead was seeked from scroll position
 * by `ScrollHero`, which is the most fragile code this project ever had. That
 * was retired on 4 Aug 2026 and the whole of it is preserved, byte for byte,
 * in `retired/scrub/` with `npm run scrub:restore` to put it back.
 *
 * What is here now is the treatment Our Mission proved: `HeroFilm` simply
 * autoplays and loops, with the shared `FilmVeil` over it and one radial pool
 * of page ground travelling with the copy. Far easier to get right on every
 * browser, and it cannot regress into the Safari problems the scrub had.
 *
 * The "Namma Mia Carpisa" arrival is UNCHANGED: same colonnade drawing
 * itself in, same eyebrow, same character-by-character reveal on both display
 * lines, same delays, same actions. Only what is behind it changed.
 */

/** The three portico arches draw themselves in: the piazza being built. */
function Colonnade() {
  const arches = [
    { d: 'M100,700 L100,300 A200,200 0 0 1 500,300 L500,700', delay: 0.4 },
    { d: 'M140,700 L140,320 A160,160 0 0 1 460,320 L460,700', delay: 0.7 },
    { d: 'M180,700 L180,340 A120,120 0 0 1 420,340 L420,700', delay: 1.0 },
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 700"
      className="pointer-events-none absolute bottom-0 left-1/2 h-[78%] w-auto -translate-x-1/2"
      fill="none"
    >
      {arches.map((arch, i) => (
        <motion.path
          key={arch.d}
          d={arch.d}
          className={i === 0 ? 'stroke-accent/60' : 'stroke-foreground/20'}
          strokeWidth={i === 0 ? 1.5 : 1}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, delay: arch.delay, ease: EASE.inOut }}
        />
      ))}
    </svg>
  );
}

/**
 * The veil, at the strength Our Mission settled on.
 *
 * `FilmVeil` is a fixed gradient (0.92 / 0.72 / 0.62 / 0.85 of the page
 * ground, top to bottom) whose OPACITY is the dial. At 0.7 the wash across
 * the middle of the frame is about 0.44, so appreciably more of the footage
 * comes through than the scrub version's opening held, and the copy is
 * covered by the radial pool underneath it instead.
 */
const HERO_VEIL = 0.7;

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  // Two speeds: the film drifts slowly, the words leave faster. That
  // difference IS the depth. No blur, no scale, nothing expensive.
  const filmY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const copyY = useTransform(scrollYProgress, [0.35, 0.85], [0, -80]);
  const copyFade = useTransform(scrollYProgress, [0.35, 0.8], [1, 0]);
  // The colonnade goes before the copy does, so the frame empties in order.
  const archFade = useTransform(scrollYProgress, [0.2, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      id="top"
      aria-label="Namma Mia Carpisa"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: filmY }}
        className="pointer-events-none absolute -inset-x-0 -bottom-[16%] -top-0 -z-10"
      >
        <HeroFilm
          src="/carnival.mp4"
          webmSrc="/carnival.webm"
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
        <motion.div style={{ opacity: archFade }} className="absolute inset-0">
          <Colonnade />
        </motion.div>
        {/* The last stretch melts into the page below, so the section change
            is a dissolve rather than an edge. */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        <Grain />
      </motion.div>

      <motion.div
        style={{ y: copyY, opacity: copyFade }}
        className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-16 text-center"
      >
        {/* Travels with the copy: keeps eyebrow, title and sub readable over
            the veil without dulling the footage at the edges. */}
        <div
          aria-hidden="true"
          className="absolute -inset-x-48 -inset-y-24 bg-[radial-gradient(60%_58%_at_50%_48%,hsl(var(--background)/0.9),hsl(var(--background)/0.55)_55%,transparent_80%)]"
        />
        <div className="relative">
          <TextEffect
            as="p"
            per="word"
            preset="fade"
            delay={0.3}
            className="font-body text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground"
          >
            The Brigade School @ Malleswaram · 14 November 2026
          </TextEffect>

          <h1 className="mt-8">
            <TextEffect
              as="span"
              per="char"
              preset="fade-in-blur"
              delay={0.7}
              speedReveal={1.4}
              className="block font-display text-[17vw] font-medium leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl lg:text-9xl"
            >
              Namma Mia
            </TextEffect>
            <TextEffect
              as="span"
              per="char"
              preset="fade-in-blur"
              delay={1.3}
              speedReveal={1.4}
              className="block pb-2 font-display text-[17vw] font-medium italic leading-[1.1] tracking-tight text-primary sm:text-7xl md:text-8xl lg:text-9xl"
            >
              Carpisa
            </TextEffect>
          </h1>

          <TextEffect
            as="p"
            per="line"
            preset="fade-in-blur"
            delay={2.0}
            className="mx-auto mt-8 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Our campus becomes an Italian piazza for one day, raising funds for
            children's education and healthcare.
          </TextEffect>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2.5, ease: EASE.out }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Magnetic intensity={0.2} range={80}>
              <Link
                to="/get-passes"
                className="inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
              >
                Get passes
              </Link>
            </Magnetic>
            <a
              href="#piazza"
              className="group inline-flex items-center gap-2 rounded-full px-4 py-3.5 font-body text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Walk the piazza
              <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
            </a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
