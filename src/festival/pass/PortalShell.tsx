import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePortalBase } from './routes';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, ScanLine, UserRound, Users } from 'lucide-react';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';
import { useVolunteerSession } from './session-context';

/**
 * The evening ground every portal page sits on: dark chapter, lantern glow,
 * grain — the same materials as the pass pages, so the gate tools read as
 * part of the site rather than as an admin console bolted to the side.
 *
 * Also paints `body` to match. The document root keeps the site's light
 * marble, which shows as a pale band whenever the page is shorter than the
 * visual viewport (a phone retracting its URL bar, a rubber-band overscroll).
 */
export function PortalShell({
  children,
  chrome,
  wide,
}: {
  children: ReactNode;
  /** The signed-in header. Off on the login page, which has no identity yet. */
  chrome?: ReactNode;
  /** Roster width for the dashboard; the gate tools stay phone-sized. */
  wide?: boolean;
}) {
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
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.12),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>

      <div
        className={
          'relative z-10 mx-auto flex min-h-[100dvh] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 ' +
          (wide ? 'max-w-3xl' : 'max-w-md')
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <CarnivalMark className="h-6 w-auto text-foreground" />
            <p className="font-body text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Gate verification
            </p>
          </div>
          {chrome}
        </div>

        <div
          className={
            'flex flex-1 flex-col py-10 ' + (wide ? '' : 'justify-center')
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Signed-in identity, top right: who you are and what you may do, then a
 * menu for the profile and for leaving. On a shared gate tablet the name is
 * the thing that stops the wrong person's check-ins being recorded against
 * you, so it stays visible rather than living behind the menu.
 */
export function VolunteerMenu() {
  /** Keeps every link under the address this visit arrived at. */
  const portalBase = usePortalBase();

  const { state, signOut } = useVolunteerSession();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (state.phase !== 'signed-in') return null;
  const { volunteer } = state;

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/10 py-1.5 pl-3 pr-2 text-right transition-colors duration-300 hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block truncate font-body text-xs font-medium text-foreground">
            {volunteer.name}
          </span>
          <span className="block font-body text-2xs uppercase tracking-[0.16em] text-accent">
            {volunteer.role === 'admin' ? 'Administrator' : 'Volunteer'}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={
            'h-4 w-4 flex-none text-muted-foreground transition-transform duration-300 ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE.out }}
            className="liquid-glass absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 p-1"
          >
            {volunteer.role === 'admin' && (
              <Link
                to={`${portalBase}/admin`}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-body text-sm text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Users aria-hidden="true" className="h-4 w-4" />
                Admin dashboard
              </Link>
            )}
            <Link
              to={portalBase}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-body text-sm text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ScanLine aria-hidden="true" className="h-4 w-4" />
              Verify passes
            </Link>
            <Link
              to={`${portalBase}/profile`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-body text-sm text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserRound aria-hidden="true" className="h-4 w-4" />
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-body text-sm text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
