import { motion } from 'framer-motion';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';

const voices = [
  {
    quote:
      '“You forget it’s a school. For one day it genuinely is somewhere else.”',
    name: 'Sumukh Nayak',
    role: 'Class XII A',
    align: 'lg:col-span-8 lg:col-start-1',
  },
  {
    quote:
      '“We budget it, we build it, we run it. That is the whole point of Flash.”',
    name: 'Ryan Saha',
    role: 'Class XII A',
    align: 'lg:col-span-8 lg:col-start-5',
  },
  {
    quote:
      '“My first Flash was Rangeelo Rajasthan. Looking forward to the Italian themed Flash this year!”',
    name: 'Pranav Chauhan',
    role: 'Class XII A',
    align: 'lg:col-span-8 lg:col-start-2',
  },
];

export function Voci() {
  return (
    <section className="py-24 md:py-36" aria-label="Voices from past editions">
      {/* gap-x, not gap: at twelve columns a 6rem gutter is 11 gutters wide —
          1056px of gap alone, more than a 1024px page has to give — so the
          tracks collapsed and the offset quotes hung off the right edge of the
          document. Rows keep the generous spacing; columns get a gutter that
          leaves room for the columns themselves. */}
      <div className="mx-auto grid max-w-6xl gap-20 px-6 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-24 lg:px-10">
        {voices.map((voice, i) => (
          <motion.figure
            key={voice.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={REVEAL_VIEWPORT}
            transition={{ duration: 0.9, delay: (i % 2) * 0.1, ease: EASE.out }}
            className={voice.align}
          >
            <blockquote className="font-display text-3xl font-medium leading-[1.25] tracking-tight text-foreground md:text-4xl">
              {voice.quote}
            </blockquote>
            <figcaption className="mt-6 font-body text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {voice.name}
              </span>
              <span className="mt-0.5 block">{voice.role}</span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
