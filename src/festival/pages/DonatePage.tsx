import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { GoldRule, Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';

/**
 * Where "Support Us" leads until direct giving is live.
 *
 * Deliberately built on the Get Passes / Your Pass shell rather than the
 * districts' PageShell: everything transactional on this site is an evening
 * page. Dark ground, one wash of accent, a glass panel, and no navigation to
 * get lost in. A donation page that looked like an editorial chapter would
 * read as another article rather than an action.
 */
function Chrome() {
  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: EASE.out }}
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl md:px-10"
      aria-label="Support"
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

export default function DonatePage() {
  // The page paints its own dark ground while `body` stays marble. Any moment
  // the root is shorter than the visual viewport shows that marble as a pale
  // band; painting the same ground onto the document removes it. Same reason
  // as PassPage, same technique.
  const ground = useRef<HTMLDivElement>(null);
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
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.14),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>
      <Chrome />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-16 md:px-8">
        <header className="pb-10 pt-14 md:pt-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE.out }}
          >
            <GoldRule className="w-20" />
          </motion.div>
          <TextEffect
            as="h1"
            per="word"
            preset="fade-in-blur"
            delay={0.2}
            className="mt-7 font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl"
          >
            Support Flash
          </TextEffect>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: EASE.out }}
          className="liquid-glass mb-16 rounded-xl border border-white/10 p-8 md:p-12"
        >
          <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Coming soon
          </p>
          <p className="mt-5 font-display text-3xl font-medium italic leading-tight tracking-tight text-foreground sm:text-4xl">
            Direct giving opens closer to the day.
          </p>
          <p className="mt-6 max-w-xl font-body text-base leading-relaxed text-muted-foreground">
            Every rupee raised by Flash @ Brigade goes to Passion with
            Compassion, the school programme that pays fees, buys books and
            uniforms, and covers medical treatment for children whose families
            cannot. When giving opens, it will open here, with the amount and
            the destination stated plainly.
          </p>
          <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-muted-foreground">
            Until then, the surest way to support the day is to be at it.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/get-passes"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
            >
              Get passes
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              Return to home
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
