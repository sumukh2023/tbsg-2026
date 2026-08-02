import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';

/**
 * Shell shared by the Terms and the Privacy Policy. Same evening chapter as
 * the pass pages — dark ground, lantern glow, grain — so the legal reading
 * belongs to the site rather than looking bolted on, but with a measure and a
 * type scale set for prose rather than for a form.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const ground = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [title]);

  // The page paints its own dark ground; `body` behind it is the site's light
  // marble, which shows as a pale band whenever the root is shorter than the
  // visual viewport. Painting the document to match removes the seam.
  useEffect(() => {
    const el = ground.current;
    if (!el) return;
    const { body } = document;
    const previous = body.style.backgroundColor;
    body.style.backgroundColor = getComputedStyle(el).backgroundColor;
    return () => {
      body.style.backgroundColor = previous;
    };
  }, []);

  return (
    <div
      ref={ground}
      className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.12),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-8 md:px-8">
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE.out }}
          className="flex items-center justify-between gap-4"
        >
          <Link
            to="/"
            className="group inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Back to the piazza
          </Link>
          <CarnivalMark className="h-6 w-auto text-foreground" />
        </motion.nav>

        <header className="pb-10 pt-14 md:pb-14 md:pt-20">
          <TextEffect
            as="h1"
            per="word"
            preset="fade-in-blur"
            delay={0.15}
            className="font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            {title}
          </TextEffect>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE.out }}
            className="mt-4 font-body text-xs uppercase tracking-[0.22em] text-muted-foreground"
          >
            Flash @ Brigade 2026 · {updated}
          </motion.p>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: EASE.out }}
          className="liquid-glass rounded-xl border border-white/10 p-6 md:p-10"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/** One numbered clause: heading plus its prose. */
export function Clause({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 font-body text-sm leading-relaxed text-muted-foreground [&_a:hover]:text-primary [&_a]:text-foreground [&_a]:underline [&_a]:decoration-accent/60 [&_a]:underline-offset-4">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list in the same register as the prose. */
export function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-2 marker:text-accent/70">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** The contact block both documents end on. */
export function ContactBlock() {
  return (
    <p>
      Landline:{' '}
      <a href="tel:+918041148397" className="whitespace-nowrap">
        +91 80411 48397
      </a>
      <br />
      Mobile:{' '}
      <a href="tel:+919686669805" className="whitespace-nowrap">
        +91 96866 69805
      </a>
      <br />
      Email:{' '}
      <a
        href="mailto:bfcommunication@brigadeschools.edu.in"
        className="break-all"
      >
        bfcommunication@brigadeschools.edu.in
      </a>
    </p>
  );
}
