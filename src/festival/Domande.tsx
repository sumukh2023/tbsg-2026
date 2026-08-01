import { motion } from 'framer-motion';
import { FAQ } from '@/components/FAQ';
import { EASE, REVEAL_TRANSITION, REVEAL_VIEWPORT } from '@/utils/motion';

const items = [
  {
    question: 'Who can come?',
    answer:
      'Everyone. Families, alumni, friends of the school and invited schools. Passes are available in advance through class teachers, and day passes are sold at both gates.',
  },
  {
    question: 'What does entry cost?',
    answer:
      'Entry is ₹150 per person; children under five come in free. Stalls, games and the mercato are priced individually, and everything you spend goes to the fund.',
  },
  {
    question: 'How do I pay inside?',
    answer:
      'Every stall takes UPI, and coupon cards are sold at counters near both gates for younger visitors. No stall handles loose cash.',
  },
  {
    question: 'Where does the money go?',
    answer:
      "Every rupee of surplus funds the education and healthcare of underprivileged children through the school's Reach Out programme. Accounts are audited and published to the school community each January.",
  },
  {
    question: 'Is the campus accessible?',
    answer:
      'Yes. Step-free routes connect the piazzas, seating is spread through the arcades, and a quiet room runs all day near the library for anyone who needs a pause.',
  },
  {
    question: 'Timings and parking?',
    answer:
      'Gates open at 09:30 and close at 20:00. Parking is at the grounds on 18th Cross with a shuttle every ten minutes; autos and the metro drop you two minutes from the main gate.',
  },
];

export function Domande() {
  return (
    <section className="py-24 md:py-36" aria-labelledby="domande-heading">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid gap-12 md:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={REVEAL_VIEWPORT}
            transition={REVEAL_TRANSITION}
            className="md:col-span-4"
          >
            <h2
              id="domande-heading"
              className="font-display text-5xl font-medium tracking-tight text-foreground md:text-6xl"
            >
              Domande
            </h2>
            <p className="mt-5 max-w-xs font-body text-base leading-relaxed text-muted-foreground">
              The practical part. For anything else, contact the{' '}
              <a
                href="#contact"
                className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                School Reception
              </a>
              .
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={REVEAL_VIEWPORT}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE.out }}
            className="md:col-span-8"
          >
            <FAQ
              items={items}
              className="max-w-none [&_h3>button]:py-6 [&_h3>button]:font-display [&_h3>button]:text-xl md:[&_h3>button]:text-2xl"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
