import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { TextEffect } from '@/components/motion/text-effect';
import { Magnetic } from '@/components/motion/magnetic';
import { EASE } from '@/utils/motion';

export function Finale() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-15% 0px' });

  return (
    <section
      id="finale"
      className="relative overflow-hidden bg-background py-32 text-foreground md:py-48"
      aria-labelledby="finale-heading"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_100%,hsl(var(--primary)/0.10),transparent_70%)]"
      />
      <div ref={ref} className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 id="finale-heading">
          <TextEffect
            as="span"
            per="char"
            preset="fade-in-blur"
            trigger={inView}
            speedReveal={1.2}
            className="block pb-2 font-display text-5xl font-medium italic leading-[1.1] tracking-tight sm:text-6xl md:text-8xl"
          >
            Ci vediamo in piazza.
          </TextEffect>
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, delay: 0.9, ease: EASE.out }}
          className="mx-auto mt-8 max-w-xl font-body text-base leading-relaxed text-muted-foreground"
        >
          <span className="block">Saturday, 14 November 2026, 09:30 to 20:00.</span>
          <span className="block sm:whitespace-nowrap">
            The Brigade School @ Malleswaram, Bengaluru.
          </span>
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, delay: 1.15, ease: EASE.out }}
          className="mt-10"
        >
          <Magnetic intensity={0.2} range={90}>
            <Link
              to="/get-passes"
              className="inline-flex items-center rounded-full bg-primary px-10 py-4 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
            >
              Get passes
            </Link>
          </Magnetic>
        </motion.div>
      </div>
    </section>
  );
}
