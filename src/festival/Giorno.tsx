import { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { EASE } from '@/utils/motion';

const moments = [
  { time: '09:30', title: 'Gates open', body: 'The campanile bell rings the piazza awake.' },
  { time: '10:00', title: 'Parata delle Regioni', body: 'Six troupes, six flags, one lap of the campus.' },
  { time: '11:30', title: 'La Passerella', body: 'The runway show fills the auditorium foyer.' },
  { time: '13:00', title: 'The long lunch', body: 'The mercato at full roar; find a table under the awnings.' },
  { time: '15:00', title: 'Main-stage afternoon', body: 'Tarantella, street theatre and the choir in the courtyard.' },
  { time: '18:00', title: 'Notte Italiana', body: 'Lights come up over the piazza for the closing set.' },
  { time: '20:00', title: 'Arrivederci', body: 'The bell again. The piazza becomes a school overnight.' },
];

export function Giorno() {
  const rail = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: rail,
    offset: ['start 75%', 'end 55%'],
  });
  // The gold thread is drawn by the reader's own scroll: the day advancing.
  const drawn = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });

  return (
    <section
      className="border-y border-border/70 bg-card py-24 md:py-36"
      aria-labelledby="giorno-heading"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="max-w-2xl"
        >
          <h2
            id="giorno-heading"
            className="font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
          >
            Il Giorno
          </h2>
          <p className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
            Ten and a half hours, from first bell to last.
          </p>
        </motion.div>

        <div className="relative mt-16 md:mt-20">
          <ol ref={rail} className="relative ml-2 space-y-14 md:ml-4 md:space-y-16">
            <div
              aria-hidden="true"
              className="absolute -left-2 top-1 h-full w-px bg-border md:-left-4"
            />
            <motion.div
              aria-hidden="true"
              style={{ scaleY: drawn }}
              className="absolute -left-2 top-1 h-full w-px origin-top bg-accent md:-left-4"
            />
            {moments.map((moment, i) => (
              <motion.li
                key={moment.time}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, margin: '-20% 0px' }}
                transition={{ duration: 0.7, delay: (i % 2) * 0.05, ease: EASE.out }}
                className="grid gap-2 pl-8 md:grid-cols-12 md:gap-6 md:pl-12"
              >
                <span className="font-body text-sm font-medium tabular-nums tracking-[0.18em] text-accent md:col-span-2 md:pt-2">
                  {moment.time}
                </span>
                <div className="md:col-span-10">
                  <h3 className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
                    {moment.title}
                  </h3>
                  <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
                    {moment.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
