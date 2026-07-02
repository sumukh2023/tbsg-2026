import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';

const links = [
  { label: 'La Piazza', href: '#piazza' },
  { label: 'Regioni', href: '#regioni' },
  { label: 'Programma', href: '#programma' },
  { label: 'Mercato', href: '#mercato' },
  { label: 'La Missione', href: '#missione' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [evening, setEvening] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 32));

  // When the evening chapter reaches the top of the viewport, the nav
  // follows the page into dusk instead of floating as a marble bar.
  useEffect(() => {
    const sera = document.getElementById('sera');
    if (!sera) return;
    const observer = new IntersectionObserver(
      ([entry]) => setEvening(entry.isIntersecting),
      { rootMargin: '0px 0px -85% 0px' }
    );
    observer.observe(sera);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50', evening && 'dark')}>
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: EASE.out }}
        className={cn(
          'flex h-16 items-center justify-between px-6 transition-[background-color,border-color,backdrop-filter] duration-500 md:px-10',
          scrolled
            ? 'border-b border-border/70 bg-background/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
        aria-label="Main"
      >
        <a
          href="#top"
          className="font-body text-xs font-semibold uppercase tracking-[0.22em] text-foreground"
        >
          Flash <span className="text-primary">@</span> Brigade
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="group relative font-body text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100"
                />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="#finale"
            className="hidden items-center rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] md:inline-flex"
          >
            Get passes
          </a>
          <button
            className="grid h-10 w-10 place-items-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: EASE.out }}
            className="border-b border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="flex flex-col px-6 py-4">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-border/50 py-4 font-display text-2xl text-foreground last:border-b-0"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li className="py-4">
                <a
                  href="#finale"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 font-body text-sm font-medium text-primary-foreground"
                >
                  Get passes
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
