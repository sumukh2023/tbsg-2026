import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';
import { InfiniteSlider } from '@/components/motion/infinite-slider';
import {
  LiquidGlassButton,
  LiquidGlassModal,
  LiquidGlassTicker,
  useGlassQuality,
} from '@/components/motion/liquid-glass';
import { useMediaQuery } from '@/hooks';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { getLiveChromeReceded, subscribeLiveChrome } from './live-visibility';

export type LiveUpdate = {
  id: string;
  title: string;
  message: string;
  category:
    'general' | 'performance' | 'food' | 'schedule' | 'important' | 'emergency';
  priority: 'normal' | 'high';
  cta_label: string | null;
  cta_url: string | null;
  published_at: string;
  created_at?: string | null;
};

/** Rows published without a timestamp fall back to created_at, never 1970. */
function normalize(row: LiveUpdate): LiveUpdate {
  return {
    ...row,
    published_at:
      row.published_at ?? row.created_at ?? new Date().toISOString(),
  };
}

const SEEN_KEY = 'flash-live-seen';

/**
 * Timestamp → epoch ms, tolerant of every format the pipeline produces
 * (Postgres "2026-11-14 09:00:00+00", ISO with or without zone). Safari's
 * Date.parse rejects space separators and bare two-digit offsets, so both
 * are normalised first — unread counting must agree across engines.
 */
function toEpoch(value: string | null | undefined): number {
  if (!value) return 0;
  let s = value.replace(' ', 'T');
  if (/[+-]\d{2}$/.test(s)) s += ':00';
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

const categoryLabel: Record<LiveUpdate['category'], string> = {
  general: 'General',
  performance: 'Performance',
  food: 'Food',
  schedule: 'Schedule',
  important: 'Important',
  emergency: 'Emergency',
};

/** The actual published_at, date and time, in the visitor's locale. */
function publishedLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sortDesc(updates: LiveUpdate[]): LiveUpdate[] {
  return [...updates].sort(
    (a, b) => toEpoch(b.published_at) - toEpoch(a.published_at)
  );
}

/**
 * Live updates feed. With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set,
 * reads published updates through RLS and subscribes to Supabase Realtime
 * (the anon key is public by design; RLS limits it to published rows).
 * Without them, falls back to polling the server endpoint.
 */
function useLiveUpdates() {
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [live, setLive] = useState(false);
  // Session-scoped on purpose: every new visit starts with the unread count
  // showing (a permanent watermark meant the badge never reappeared once the
  // panel had been opened in that browser). Opening the panel clears it for
  // the session; realtime arrivals afterwards still increment it.
  const [lastSeen, setLastSeen] = useState<string>(() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let polling = false;

    const apply = (rows: LiveUpdate[]) => {
      if (!cancelled) setUpdates(sortDesc(rows.map(normalize)));
    };

    // Server-endpoint polling: the fallback path, and the safety net the
    // realtime path drops to if Supabase ever fails to load, query or
    // subscribe — updates (and the unread badge) must never silently vanish.
    const startPolling = () => {
      if (polling || cancelled) return;
      polling = true;
      const load = async () => {
        try {
          const response = await fetch('/api/updates');
          if (!response.ok) return;
          const data = await response.json();
          if (Array.isArray(data.updates)) apply(data.updates);
        } catch {
          // Quiet: the panel simply shows the empty state.
        }
      };
      void load();
      const interval = setInterval(load, 60_000);
      const stop = cleanup;
      cleanup = () => {
        clearInterval(interval);
        stop?.();
      };
    };

    if (url && anon) {
      // Real-time path: anon reads via RLS + a postgres_changes stream.
      import('@supabase/supabase-js')
        .then(({ createClient }) => {
          if (cancelled) return;
          const client = createClient(url, anon);
          client
            .from('updates')
            .select(
              'id,title,message,category,priority,cta_label,cta_url,published_at,created_at'
            )
            .eq('published', true)
            .order('published_at', { ascending: false, nullsFirst: false })
            .limit(50)
            .then(({ data, error }) => {
              if (data) apply(data as LiveUpdate[]);
              if (error) startPolling();
            });
          const channel = client
            .channel('live-updates')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'updates' },
              (payload) => {
                const row = payload.new as LiveUpdate & { published?: boolean };
                if (!row?.id) return;
                setUpdates((current) => {
                  const rest = current.filter((u) => u.id !== row.id);
                  return sortDesc(
                    row.published
                      ? [...rest, normalize(row as LiveUpdate)]
                      : rest
                  );
                });
              }
            )
            .subscribe((status) => {
              if (cancelled) return;
              setLive(status === 'SUBSCRIBED');
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                startPolling();
              }
            });
          cleanup = () => {
            client.removeChannel(channel);
          };
        })
        .catch(startPolling);
    } else {
      startPolling();
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const unread = useMemo(() => {
    const seenMs = toEpoch(lastSeen);
    return updates.filter((u) => toEpoch(u.published_at) > seenMs).length;
  }, [updates, lastSeen]);

  const markSeen = useCallback(() => {
    // Nothing loaded yet → nothing was seen. Stamping "now" here would
    // poison the stored watermark and hide the badge for rows that arrive
    // a moment later.
    const newest = updates[0]?.published_at;
    if (!newest) return;
    setLastSeen(newest);
    try {
      sessionStorage.setItem(SEEN_KEY, newest);
    } catch {
      // Private mode: unread state simply resets next visit.
    }
  }, [updates]);

  return { updates, unread, markSeen, live };
}

function UpdateItem({ update }: { update: LiveUpdate }) {
  const urgent =
    update.category === 'emergency' ||
    update.category === 'important' ||
    update.priority === 'high';
  return (
    <li
      className={cn(
        'border-b border-border/60 py-5 last:border-b-0',
        update.category === 'emergency' &&
          'border-l-2 border-l-destructive pl-4'
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'font-body text-2xs font-semibold uppercase tracking-[0.16em]',
            update.category === 'emergency'
              ? 'text-destructive'
              : urgent
                ? 'text-primary'
                : 'text-muted-foreground'
          )}
        >
          {categoryLabel[update.category] ?? 'General'}
        </span>
        <time
          dateTime={update.published_at}
          className="font-body text-xs tabular-nums text-muted-foreground"
        >
          {publishedLabel(update.published_at)}
        </time>
      </div>
      <h3 className="mt-2 font-display text-xl font-medium leading-snug text-foreground">
        {update.title}
      </h3>
      <p className="mt-1.5 font-body text-sm leading-relaxed text-muted-foreground">
        {update.message}
      </p>
      {update.cta_label && update.cta_url && (
        <a
          href={update.cta_url}
          className="mt-3 inline-flex items-center gap-1.5 font-body text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {update.cta_label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}

/** Compact latest-update ticker that emanates from the Live Updates control. */
function Ticker({
  update,
  onOpen,
}: {
  update: LiveUpdate;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const text = `${update.title} · ${update.message}`;

  return (
    <LiquidGlassTicker
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.5, ease: EASE.out }}
      onClick={onOpen}
      aria-label={`Latest update: ${update.title}. Open live updates.`}
      className="pointer-events-auto origin-bottom-right px-4 py-2.5"
    >
      <span className="flex max-w-[min(19rem,calc(100vw-5rem))] items-center md:max-w-xs">
        {reduce ? (
          <span className="truncate font-body text-xs leading-relaxed">
            {text}
          </span>
        ) : (
          <span
            className="block min-w-0 flex-1 overflow-hidden"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
              maskImage:
                'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            }}
          >
            <InfiniteSlider gap={56} speed={28} speedOnHover={6}>
              <span className="whitespace-nowrap font-body text-xs leading-relaxed">
                {text}
              </span>
            </InfiniteSlider>
          </span>
        )}
      </span>
    </LiquidGlassTicker>
  );
}

export function LiveUpdates() {
  const { updates, unread, markSeen, live } = useLiveUpdates();
  const quality = useGlassQuality();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latest = updates[0];
  // Small screens only: the floating chrome recedes while the ground-film
  // caption is scrubbed and while the footer's social row is on screen (the
  // cluster would otherwise sit on top of the icons and swallow their taps).
  // Desktop keeps the cluster visible at all times.
  const compact = useMediaQuery('(max-width: 767px)');
  const filmActive = useSyncExternalStore(
    subscribeLiveChrome,
    getLiveChromeReceded
  );
  const [footerNear, setFooterNear] = useState(false);
  useEffect(() => {
    const socials = document.getElementById('footer-socials');
    if (!socials) return;
    const observer = new IntersectionObserver(([entry]) =>
      setFooterNear(entry.isIntersecting)
    );
    observer.observe(socials);
    return () => observer.disconnect();
  }, []);
  const receded = compact && (filmActive || footerNear);

  const openPanel = () => setOpen(true);

  // Reading the panel marks everything current as read — including updates
  // that arrive in realtime while it is open.
  useEffect(() => {
    if (open) markSeen();
  }, [open, markSeen]);

  // A new arrival nudges the control once, without interrupting anyone.
  const prevLatestId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const changed =
      latest?.id && prevLatestId.current && latest.id !== prevLatestId.current;
    prevLatestId.current = latest?.id;
    if (!changed) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(timer);
  }, [latest?.id]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Plain fixed wrapper: .liquid-glass declares position:relative, so
          the glass surfaces live INSIDE this anchor, never on it. The anchor
          also carries the mobile recede fade (film caption, footer socials),
          ending hidden so the invisible controls can't be tabbed or tapped.
          pointer-events: only the buttons themselves are hit targets — the
          wrapper boxes must never swallow taps meant for page content. */}
      <motion.div
        animate={
          receded && !open
            ? { opacity: 0, y: 12, transitionEnd: { visibility: 'hidden' } }
            : { opacity: 1, y: 0, visibility: 'visible' }
        }
        transition={{ duration: 0.5, ease: EASE.inOut }}
        className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 md:bottom-[max(2rem,env(safe-area-inset-bottom))] md:right-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 4.0, ease: EASE.out }}
          className="flex flex-col items-end gap-2.5"
        >
          <AnimatePresence mode="popLayout">
            {latest && !open && (
              <Ticker key={latest.id} update={latest} onOpen={openPanel} />
            )}
          </AnimatePresence>

          <LiquidGlassButton
            layout
            animate={flash ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 0.55, ease: EASE.inOut }}
            onClick={openPanel}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="pointer-events-auto flex items-center gap-2.5 py-2.5 pl-4 pr-5 transition-transform duration-300 hover:-translate-y-0.5"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-body text-sm font-medium">Live Updates</span>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE.out }}
                  className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 font-body text-2xs font-semibold tabular-nums text-primary-foreground"
                  aria-label={`${unread} unread updates`}
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </LiquidGlassButton>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setOpen(false)}
              className={cn(
                'fixed inset-0 z-40 bg-foreground/25',
                // A full-screen backdrop-filter is one of the most expensive
                // layers a phone can composite; the dim alone reads fine there.
                quality === 'full' && 'backdrop-blur-[2px]'
              )}
              aria-hidden="true"
            />
            <LiquidGlassModal
              aria-label="Live carnival updates"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.45, ease: EASE.out }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-5">
                <div>
                  <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">
                    Live Updates
                  </h2>
                  <p className="mt-1 font-body text-xs text-muted-foreground">
                    {live
                      ? 'Connected, updates arrive as they are published'
                      : 'Refreshed every minute'}
                  </p>
                </div>
                <button
                  ref={closeRef}
                  onClick={() => setOpen(false)}
                  aria-label="Close updates"
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-[env(safe-area-inset-bottom)]">
                {updates.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center pb-16 text-center">
                    <p className="font-display text-2xl italic text-muted-foreground">
                      La piazza è tranquilla.
                    </p>
                    <p className="mt-3 max-w-[16rem] font-body text-sm leading-relaxed text-muted-foreground">
                      Event-day announcements will appear here the moment they
                      are published.
                    </p>
                  </div>
                ) : (
                  <ul>
                    {updates.map((update) => (
                      <UpdateItem key={update.id} update={update} />
                    ))}
                  </ul>
                )}
              </div>
            </LiquidGlassModal>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
