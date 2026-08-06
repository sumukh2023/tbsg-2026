import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from 'framer-motion';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { CarnivalMark } from './CarnivalMark';
import { CHAPTERS } from './pages/chapters';

/** Honour the OS setting: a long smooth glide is exactly what it asks us not
 *  to do. Read at click time rather than cached, so a mid-session change of
 *  the setting is respected. */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [evening, setEvening] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const { pathname } = useLocation();

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 32));

  // A route change closes the mobile sheet. Without this it stays open over
  // the page you just navigated to.
  useEffect(() => setOpen(false), [pathname]);

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
    // `#sera` only exists on the landing page; elsewhere the observer simply
    // never fires and the bar keeps its marble register.
  }, [pathname]);

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
        {/* On the landing page the mark is a way BACK UP, not a navigation:
            clicking it glides to the top rather than remounting the page and
            throwing away the scroll-scrub films. Anywhere else it is an
            ordinary link home. */}
        <Link
          to="/"
          onClick={(event) => {
            if (pathname !== '/') return;
            event.preventDefault();
            window.scrollTo({
              top: 0,
              behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            });
          }}
          aria-label={
            pathname === '/'
              ? 'Flash @ Brigade — back to top'
              : 'Flash @ Brigade — home'
          }
          className="rounded-sm transition-opacity duration-300 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CarnivalMark className="h-7 w-auto md:h-8" />
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.path}>
              <NavLink
                to={chapter.path}
                className={({ isActive }) =>
                  cn(
                    'group relative font-body text-sm transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {chapter.label}
                    {/* The rule stays drawn on the page you are on, so the
                        bar says where you are, not just where you can go. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-1 left-0 h-px w-full origin-left bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100',
                        isActive ? 'scale-x-100' : 'scale-x-0'
                      )}
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link
            to="/get-passes"
            className="hidden items-center rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] md:inline-flex"
          >
            Get passes
          </Link>
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
              {CHAPTERS.map((chapter) => (
                <li key={chapter.path}>
                  <NavLink
                    to={chapter.path}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block border-b border-border/50 py-4 font-display text-2xl last:border-b-0',
                        isActive ? 'text-primary' : 'text-foreground'
                      )
                    }
                  >
                    {chapter.label}
                  </NavLink>
                </li>
              ))}
              <li className="py-4">
                <Link
                  to="/get-passes"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 font-body text-sm font-medium text-primary-foreground"
                >
                  Get passes
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
