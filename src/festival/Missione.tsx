import { useRef } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { Grain } from './materials';

type MeasureData = {
  value: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  /** Ordinal indicator that rolls with the number, e.g. 1st -> 2nd. */
  sup?: { from: string; to: string };
  label: string;
};

const measures: MeasureData[] = [
  {
    value: 2,
    from: 1,
    sup: { from: 'st', to: 'nd' },
    label: 'student-led carnival',
  },
  {
    value: 10,
    prefix: '₹',
    suffix: ' lakh',
    label: 'raised at Rangeelo Rajasthan',
  },
  { value: 3160, label: 'children supported so far' },
  { value: 240, label: 'student organisers this year' },
];

function Measure({
  value,
  from = 0,
  prefix,
  suffix,
  sup,
  label,
  delay,
}: MeasureData & { delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, REVEAL_VIEWPORT);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.8, delay, ease: EASE.out }}
      className="border-t border-border pt-6"
    >
      <p className="font-display text-6xl font-medium tracking-tight text-primary md:text-7xl">
        {prefix}
        <AnimatedNumber
          value={inView ? value : from}
          springOptions={{ stiffness: 45, damping: 26 }}
        />
        {sup && (
          <span className="relative -top-[0.85em] inline-block w-[1.5ch] text-[0.42em] leading-none">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={inView ? sup.to : sup.from}
                initial={{ opacity: 0, y: '0.5em' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '-0.5em' }}
                transition={{ duration: 0.5, delay: 0.35, ease: EASE.out }}
                className="inline-block"
              >
                {inView ? sup.to : sup.from}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
        {suffix}
      </p>
      <p className="mt-3 max-w-[22ch] font-body text-sm leading-relaxed text-muted-foreground">
        {label}
      </p>
    </motion.div>
  );
}

export function Missione() {
  const headRef = useRef<HTMLDivElement>(null);
  const headInView = useInView(headRef, REVEAL_VIEWPORT);

  return (
    <section
      id="missione"
      className="relative overflow-hidden bg-background py-28 text-foreground md:py-44"
      aria-labelledby="missione-heading"
    >
      {/* Lantern light over the evening piazza */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,hsl(var(--accent)/0.14),transparent_70%)]"
      />
      <Grain className="opacity-[0.04]" />

      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <div ref={headRef} className="max-w-3xl">
          <h2 id="missione-heading" className="sr-only">
            The mission
          </h2>
          <TextEffect
            as="p"
            per="word"
            preset="fade-in-blur"
            trigger={headInView}
            speedReveal={1.4}
            className="font-display text-4xl font-medium leading-[1.15] tracking-tight sm:text-5xl md:text-6xl"
          >
            The carnival is the means.
          </TextEffect>
          <TextEffect
            as="p"
            per="word"
            preset="fade-in-blur"
            trigger={headInView}
            delay={0.5}
            speedReveal={1.4}
            className="font-display text-4xl font-medium italic leading-[1.15] tracking-tight text-primary sm:text-5xl md:text-6xl"
          >
            This is the end.
          </TextEffect>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={headInView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, delay: 0.9, ease: EASE.out }}
            className="mt-10 max-w-xl font-body text-base leading-relaxed text-muted-foreground"
          >
            When the lights go down over the piazza, the surplus goes to work:
            school fees, textbooks, uniforms and medical care for children in
            Malleswaram and beyond. It is the promise Flash has kept since
            Rangeelo Rajasthan in 2023, and the students who run the carnival
            sit on the committee that spends what it raises.
          </motion.p>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-x-8 gap-y-12 md:mt-28 md:grid-cols-4">
          {measures.map((m, i) => (
            <Measure key={m.label} {...m} delay={i * 0.12} />
          ))}
        </div>
      </div>
    </section>
  );
}
