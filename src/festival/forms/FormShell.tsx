import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE } from '@/utils/motion';
import { CarnivalMark } from '../CarnivalMark';

/**
 * The furniture every transactional page on this site shares: the slim bar at
 * the top and the numbered section heading. The button shapes and the ground
 * trick live next door in `formStyles.ts`, because a module that exports both
 * components and plain values breaks React Fast Refresh.
 *
 * Extracted from DonatePage, which had all of it inline and was about to have
 * it copied a third time. These are the pieces where drift is most obvious to
 * a reader — a back link in a different place, a button with a different
 * radius — and the least defensible, since none of it is page-specific.
 *
 * The FORMS themselves are not shared, and should not be. Reserving a pass,
 * making a donation and offering to sponsor ask genuinely different questions
 * in a different order; a component that tried to be all three would be
 * configuration, not design.
 */

/** The slim bar: the mark home, and the way back to the piazza. */
export function FormChrome({ label }: { label: string }) {
  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: EASE.out }}
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl md:px-10"
      aria-label={label}
    >
      <Link
        to="/"
        aria-label="Flash @ Brigade home"
        className="text-foreground transition-colors duration-300 hover:text-primary"
      >
        <CarnivalMark className="h-7 w-auto md:h-8" />
      </Link>
      <Link
        to="/"
        className="group inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        Back to the piazza
      </Link>
    </motion.nav>
  );
}

/** A titled block inside the glass panel. */
export function FormSection({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border/60 pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden="true"
          className="font-display text-sm tabular-nums text-primary"
        >
          {n}
        </span>
        <h2 className="font-display text-xl font-medium tracking-tight text-foreground md:text-2xl">
          {title}
        </h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
