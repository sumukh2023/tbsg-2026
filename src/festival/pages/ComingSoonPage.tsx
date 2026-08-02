import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { GoldRule } from '../materials';
import { Band, PageShell } from './PageShell';
import type { Chapter } from './chapters';

/**
 * The shape every page-in-waiting takes.
 *
 * Deliberately NOT an empty page with a word on it: it carries the same hero,
 * the same materials, the same footer and its own district colour, and it
 * says what will be here and what to do meanwhile. A placeholder that looks
 * unfinished makes the whole site look unfinished.
 *
 * `previews` are the sections that page will eventually hold, shown as
 * titles. When the real page is built it replaces this component wholesale;
 * nothing here needs unpicking.
 */
export function ComingSoonPage({
  chapter,
  eyebrow,
  title,
  lede,
  previews,
  note,
}: {
  chapter: Chapter;
  eyebrow: string;
  title: string;
  lede: string;
  previews: { title: string; body: string }[];
  note: string;
}) {
  return (
    <PageShell
      chapter={chapter}
      eyebrow={eyebrow}
      title={title}
      lede={<p>{lede}</p>}
    >
      <Band tone="raised">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={REVEAL_VIEWPORT}
          transition={{ duration: 0.8, ease: EASE.out }}
          className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <GoldRule className="w-16" />
            <p className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              Coming soon
            </p>
            <p className="mt-4 max-w-md font-body text-base leading-relaxed text-muted-foreground">
              {note}
            </p>
          </div>
          <Link
            to="/get-passes"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
          >
            Get passes
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </motion.div>

        <AnimatedGroup
          preset="blur-slide"
          className="mt-16 grid gap-4 md:grid-cols-3"
        >
          {previews.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-background/60 p-6"
            >
              <p className="font-display text-2xl font-medium leading-snug tracking-tight text-foreground">
                {item.title}
              </p>
              <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </AnimatedGroup>
      </Band>
    </PageShell>
  );
}
