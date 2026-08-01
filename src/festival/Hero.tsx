import { motion, useTransform, type MotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import { ScrollHero } from '@/components/ScrollHero';
import { TextEffect } from '@/components/motion/text-effect';
import { Magnetic } from '@/components/motion/magnetic';
import { EASE } from '@/utils/motion';
import { FilmVeil, Grain } from './materials';

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

function HeroContent({ progress }: { progress: MotionValue<number> }) {
  // As the reader scrubs deeper into the film, the copy bows out so the
  // final stretch belongs to the video before the next chapter arrives.
  const contentOpacity = useTransform(progress, [0.45, 0.8], [1, 0]);
  const contentY = useTransform(progress, [0.45, 0.8], [0, -80]);
  // The full marble veil holds only for the film's first beats; as the
  // drone crosses into the school grounds it eases down to the thin veil
  // and the footage carries its own colour. The colonnade still dissolves
  // over the final two seconds so the ending feels composed, not cut.
  const veilOpacity = useTransform(progress, [0.18, 0.4], [1, 0.35]);
  const archOpacity = useTransform(progress, [0.74, 0.94], [1, 0]);

  return (
    <>
      {/* Marble veil: keeps the ink typography cleanly readable over film. */}
      <FilmVeil opacity={veilOpacity} />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_-5%,hsl(var(--accent)/0.14),transparent_70%)]"
      />
      <motion.div
        aria-hidden="true"
        style={{ opacity: archOpacity }}
        className="absolute inset-0"
      >
        <Colonnade />
      </motion.div>
      <Grain />

      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative z-10 flex h-full items-center justify-center"
      >
        <div className="relative mx-auto max-w-4xl px-6 pt-16 text-center">
          {/* Travels with the copy: keeps eyebrow, title and sub readable
              over the thin veil without dulling the footage at the edges. */}
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
              Our campus becomes an Italian piazza for one day, raising funds
              for children's education and healthcare.
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
        </div>
      </motion.div>
    </>
  );
}

export function Hero() {
  return (
    <section id="top" aria-label="Namma Mia Carpisa">
      <ScrollHero
        src="/hero.mp4"
        webmSrc="/hero.webm"
        mobileSrc="/hero-mobile.mp4"
        heightVh={340}
      >
        {(progress) => <HeroContent progress={progress} />}
      </ScrollHero>
    </section>
  );
}
