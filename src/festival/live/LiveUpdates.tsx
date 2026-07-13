import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';
import { InfiniteSlider } from '@/components/motion/infinite-slider';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';

export type LiveUpdate = {
  id: string;
  title: string;
  message: string;
  category: 'general' | 'performance' | 'food' | 'schedule' | 'important' | 'emergency';
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
    published_at: row.published_at ?? row.created_at ?? new Date().toISOString(),
  };
}

const SEEN_KEY = 'flash-live-seen';

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
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
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
  const [lastSeen, setLastSeen] = useState<string>(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const apply = (rows: LiveUpdate[]) => {
      if (!cancelled) setUpdates(sortDesc(rows.map(normalize)));
    };

    if (url && anon) {
      // Real-time path: anon reads via RLS + a postgres_changes stream.
      import('@supabase/supabase-js').then(({ createClient }) => {
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
          .then(({ data }) => {
            if (data) apply(data as LiveUpdate[]);
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
                  row.published ? [...rest, normalize(row as LiveUpdate)] : rest
                );
              });
            }
          )
          .subscribe((status) => {
            if (!cancelled) setLive(status === 'SUBSCRIBED');
          });
        cleanup = () => {
          client.removeChannel(channel);
        };
      });
    } else {
      // Fallback: poll the server endpoint quietly.
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
      cleanup = () => clearInterval(interval);
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const unread = useMemo(
    () =>
      updates.filter((u) => !lastSeen || u.published_at > lastSeen).length,
    [updates, lastSeen]
  );

  const markSeen = useCallback(() => {
    const newest = updates[0]?.published_at ?? new Date().toISOString();
    setLastSeen(newest);
    try {
      localStorage.setItem(SEEN_KEY, newest);
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
        update.category === 'emergency' && 'border-l-2 border-l-destructive pl-4'
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
    <motion.button
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.5, ease: EASE.out }}
      onClick={onOpen}
      aria-label={`Latest update: ${update.title}. Open live updates.`}
      className="liquid-glass-elevated origin-bottom-right cursor-pointer rounded-full py-2 pl-4 pr-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    </motion.button>
  );
}

export function LiveUpdates() {
  const { updates, unread, markSeen, live } = useLiveUpdates();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latest = updates[0];

  const openPanel = () => {
    setOpen(true);
    markSeen();
  };

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
          the glass surfaces live INSIDE this anchor, never on it. */}
      <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 md:bottom-[max(2rem,env(safe-area-inset-bottom))] md:right-8">
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

          <motion.button
            animate={flash ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 0.55, ease: EASE.inOut }}
            onClick={openPanel}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="liquid-glass-elevated flex cursor-pointer items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5 text-white transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-[2px]"
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Live carnival updates"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.45, ease: EASE.out }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-border/60 bg-background/80 backdrop-blur-2xl"
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
              <div className="flex-1 overflow-y-auto px-6">
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
