import { InView } from '@/components/motion/in-view';
import { TextEffect } from '@/components/motion/text-effect';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { EASE } from '@/utils/motion';
import { GoldRule } from './materials';

/** Large serif statement lines that surface one by one as the reader arrives. */
function Statement({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-20% 0px' });

  return (
    <div ref={ref} className={className}>
      {lines.map((line, i) => (
        <TextEffect
          key={line}
          as="span"
          per="word"
          preset="fade-in-blur"
          trigger={inView}
          delay={i * 0.35}
          speedReveal={1.6}
          segmentTransition={{ duration: 0.7, ease: EASE.out }}
          // The three lines are a deliberate typographic break at the widths
          // that can hold them. Narrower than that they are just a sentence
          // cut into thirds, so each fragment ends early and leaves a ragged
          // hole: inline until `md`, where they run together and wrap where
          // the measure actually ends.
          className="inline font-display text-4xl font-medium leading-[1.15] tracking-tight text-foreground sm:text-5xl md:block md:text-6xl"
        >
          {/* Trailing space so consecutive fragments do not fuse while
              inline; TextEffect keeps whitespace as its own segment. */}
          {i < lines.length - 1 ? `${line} ` : line}
        </TextEffect>
      ))}
    </div>
  );
}

export function Overture() {
  return (
    <section
      className="relative py-32 md:py-44"
      aria-labelledby="overture-heading"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <h2 id="overture-heading" className="sr-only">
          About Flash
        </h2>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: false, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="origin-left"
        >
          <GoldRule />
        </motion.div>

        <Statement
          className="mt-10 md:max-w-4xl"
          lines={[
            'Flash is the day this school',
            'hands the keys to its students,',
            'and the campus answers in Italian.',
          ]}
        />

        <div className="mt-16 grid gap-10 md:mt-24 md:grid-cols-12">
          <div className="md:col-span-5">
            <InView
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.9, ease: EASE.out }}
              viewOptions={{ once: false, margin: '-15% 0px' }}
            >
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Flash began in November 2023, when Rangeelo Rajasthan turned
                this campus into a swirl of Ghoomar, qawwali and a 120-strong
                dance troupe. Every edition is imagined, budgeted and run
                entirely by students. Teachers advise. Students decide.
              </p>
            </InView>
          </div>
          <div className="md:col-span-5 md:col-start-8">
            <InView
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.9, delay: 0.15, ease: EASE.out }}
              viewOptions={{ once: false, margin: '-15% 0px' }}
            >
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                The tradition continues; the destination changes. This year the
                courtyards become piazzas, the corridors become arcades, and
                every stall, stage and kitchen follows one map: Italy. Every
                rupee raised goes to the education and healthcare of
                underprivileged children.
              </p>
            </InView>
          </div>
        </div>
      </div>
    </section>
  );
}
