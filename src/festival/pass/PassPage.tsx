import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';
import { type PassData } from '../getpasses/PassCard';
import { FloatingInput } from '../getpasses/fields';
import { PassDeck } from './PassDeck';
import { BookingList, type Booking } from './BookingList';

type LoadState =
  | { phase: 'loading' }
  /** Every pass in the booking, and when each was checked in. */
  | {
      phase: 'ready';
      passes: PassData[];
      checkedInAt: Record<string, string | null>;
    }
  | { phase: 'missing' }
  | { phase: 'error'; message: string };

function Chrome() {
  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: EASE.out }}
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl md:px-10"
      aria-label="Pass"
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

function Shell({ children }: { children: React.ReactNode }) {
  // The page paints its own dark ground, but `body` behind it stays the
  // site's light marble. Any moment the root is shorter than the visual
  // viewport — a phone retracting its URL bar, a rubber-band overscroll —
  // that marble shows as a pale band under the page. Painting the same dark
  // ground onto the document while this route is mounted means there is
  // nothing paler anywhere behind it, whatever the viewport does.
  const ground = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ground.current;
    if (!el) return;
    const { body } = document;
    const previous = body.style.backgroundColor;
    // Copied off the element rather than restating the token, so it cannot
    // drift from `--background` in globals.css.
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
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-6 pb-[env(safe-area-inset-bottom)] pt-16 md:px-8">
        {children}
      </div>
    </div>
  );
}

/**
 * The retrieval reply, as bookings, whatever shape it arrives in.
 *
 * `/api/retrieve` returns `bookings` now. It also still returns the flat
 * `tokens` it used to, and this reads that as a fallback: a visitor whose
 * browser has the new bundle cached against an older deployment of the
 * function would otherwise see "pass not found" for passes that exist. One
 * synthetic booking with no reference is a worse screen than the real thing
 * and a much better one than that.
 */
function normaliseBookings(data: unknown): Booking[] {
  const body = data as {
    bookings?: Booking[];
    tokens?: string[];
    token?: string;
  } | null;
  if (body?.bookings?.length) return body.bookings;
  const tokens = body?.tokens?.length
    ? body.tokens
    : body?.token
      ? [body.token]
      : [];
  if (!tokens.length) return [];
  return [
    {
      reference: null,
      booked_at: null,
      passes: tokens.length,
      total_amount: null,
      payment_status: null,
      status: 'active',
      tokens,
    },
  ];
}

function RetrieveForm({ onFound }: { onFound: (bookings: Booking[]) => void }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Same rules, messages and timing as the Reserve Your Passes form.
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    phone?: string;
    fullName?: string;
  }>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: { email?: string; phone?: string; fullName?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      next.email = 'That email address does not look right yet.';
    }
    if (!/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) {
      next.phone = 'Please enter a 10-digit Indian mobile number.';
    }
    // Only that SOMETHING was typed. Whether it is the right name is the
    // server's question, and answering it here would tell an enumerator
    // which of the three fields they got wrong.
    if (fullName.trim().length < 2) {
      next.fullName = 'Please enter the name you registered with.';
    }
    setFieldErrors(next);
    if (next.email || next.phone || next.fullName) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\s/g, ''),
          full_name: fullName.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      const bookings = normaliseBookings(data);
      if (response.ok && bookings.length) {
        /* THE DECKS STAY OFF THE URL. Retrieval returns every token in every
           booking, and a token IS the credential: putting them in the address
           bar would write a family's passes into browser history, the back
           button and anything that syncs it. Handing them up as state keeps
           them out of all three. `/pass/<token>` still works for one scanned
           link, which is the case that needs an address. */
        onFound(bookings);
        return;
      }
      setError(
        data?.error ??
          'Pass not found. Please check the details entered and try again.'
      );
    } catch {
      setError('The pass service is unreachable right now. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: EASE.out }}
      onSubmit={submit}
      className="liquid-glass mb-16 rounded-xl border border-white/10 p-6 md:p-10"
      noValidate
    >
      <div className="space-y-1">
        <FloatingInput
          id="retrieve-email"
          label="Email address"
          type="email"
          inputMode="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            setFieldErrors((e) => ({ ...e, email: undefined }));
          }}
          error={fieldErrors.email}
          autoComplete="email"
          maxLength={160}
        />
        <FloatingInput
          id="retrieve-phone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(v) => {
            setPhone(v);
            setFieldErrors((e) => ({ ...e, phone: undefined }));
          }}
          error={fieldErrors.phone}
          autoComplete="tel"
          maxLength={16}
        />
        <FloatingInput
          id="retrieve-name"
          label="Name"
          value={fullName}
          onChange={(v) => {
            setFullName(v);
            setFieldErrors((e) => ({ ...e, fullName: undefined }));
          }}
          error={fieldErrors.fullName}
          autoComplete="name"
          maxLength={120}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 font-body text-sm text-muted-foreground"
        >
          {error}
        </p>
      )}
      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
            />
          )}
          {busy ? 'Looking' : 'Find my pass'}
        </button>
      </div>
    </motion.form>
  );
}

export default function PassPage() {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  /* Bookings found by retrieval, held in state rather than the URL. */
  const [found, setFound] = useState<Booking[] | null>(null);
  /* Which booking's deck is open, by POSITION in the list. Not by reference:
     the compatibility shape above has no reference, and `null === null` would
     have opened a booking nobody chose. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  /* THE CONFIRMATION PAGE HANDS THE WHOLE BOOKING OVER.
     "View QR Pass" used to link to `/pass/<first token>`, which opened a deck
     of one: everybody after the first person in the booking was simply not on
     the screen they had just been sent to. It now navigates here with every
     token in router state, which keeps them out of the address bar for the
     same reason retrieval does. */
  const handed = useMemo(() => {
    const state = location.state as { tokens?: unknown } | null;
    const tokens = state?.tokens;
    return Array.isArray(tokens) && tokens.every((t) => typeof t === 'string')
      ? (tokens as string[])
      : null;
  }, [location.state]);

  /* One booking opens straight into its deck: a list of one is a step that
     exists only to be clicked through. Several show the list first. */
  const open = found
    ? found.length === 1
      ? found[0]
      : openIndex !== null
        ? found[openIndex]
        : undefined
    : undefined;
  const tokens = token
    ? [token]
    : handed?.length
      ? handed
      : (open?.tokens ?? null);
  const choosing = Boolean(found && found.length > 1 && !open);

  useEffect(() => {
    if (!tokens || tokens.length === 0) return;
    let cancelled = false;
    const load = async () => {
      setState({ phase: 'loading' });
      try {
        /* IN PARALLEL. A booking of ten fetched one after another is ten
           round trips end to end before anything appears; asked for at
           once it is one. They are independent reads of independent
           passes, so there is nothing to serialise them for. */
        const results = await Promise.all(
          tokens.map(async (each) => {
            const response = await fetch(
              `/api/pass?token=${encodeURIComponent(each)}`
            );
            if (!response.ok) return null;
            const data = await response.json();
            return { each, data };
          })
        );
        if (cancelled) return;

        const found = results.filter(
          (r): r is NonNullable<typeof r> => r !== null
        );
        if (found.length === 0) {
          setState({ phase: 'missing' });
          return;
        }

        const checkedInAt: Record<string, string | null> = {};
        const passes = found.map(({ each, data }) => {
          checkedInAt[each] = data.pass.checked_in_at ?? null;
          return {
            token: each,
            reference: data.pass.reference,
            status: data.pass.status,
            guestName: data.pass.guest.name,
            visitorType: data.pass.guest.visitor_type,
            numberOfPasses: data.pass.of ?? data.pass.guest.number_of_passes,
            sequence: data.pass.sequence,
            usn: data.pass.guest.usn,
            studentClass: data.pass.guest.class,
            section: data.pass.guest.section,
          } satisfies PassData;
        });
        setState({ phase: 'ready', passes, checkedInAt });
      } catch {
        if (!cancelled) {
          setState({
            phase: 'error',
            message: 'The pass service is unreachable right now.',
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // The array identity changes on every render when it comes from a param,
    // so the join is what keeps this from refetching for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.join(',')]);

  return (
    <Shell>
      <header className="pb-10 pt-14 md:pt-20">
        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.2}
          className="font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl"
        >
          {/* A scanned `/pass/<token>` link is one person's pass and says so.
              Everything reached by retrieval is a booking. */}
          {token ? 'Your Pass' : 'Your Bookings'}
        </TextEffect>
        {!tokens && !choosing && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: EASE.out }}
            className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground"
          >
            Enter the email address and mobile number you registered with, and
            we will bring your pass back.
          </motion.p>
        )}
        {choosing && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE.out }}
            className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground"
          >
            {`You hold ${found?.length} bookings on these details, newest first. Open one to see every pass in it.`}
          </motion.p>
        )}
        {/* Back to the list, and only when there is a list to go back to. */}
        {open && found && found.length > 1 && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: EASE.out }}
            onClick={() => setOpenIndex(null)}
            className="group mt-5 inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft
              aria-hidden="true"
              className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5"
            />
            {open.reference
              ? `All bookings · ${open.reference}`
              : 'All bookings'}
          </motion.button>
        )}
      </header>

      {choosing && found ? (
        <BookingList
          bookings={found}
          onOpen={(booking) => setOpenIndex(found.indexOf(booking))}
        />
      ) : !tokens ? (
        <RetrieveForm onFound={setFound} />
      ) : state.phase === 'loading' ? (
        <div
          className="mx-auto mb-16 h-[480px] w-full max-w-sm animate-pulse rounded-xl border border-border bg-card"
          aria-label="Loading pass"
        />
      ) : state.phase === 'ready' ? (
        <PassDeck passes={state.passes} checkedInAt={state.checkedInAt} />
      ) : (
        <div className="liquid-glass mb-16 rounded-xl border border-white/10 p-8 text-center md:p-10">
          <p className="font-display text-2xl italic text-foreground">
            {state.phase === 'missing'
              ? 'No pass matches this link.'
              : 'The pass service is unreachable right now.'}
          </p>
          <p className="mx-auto mt-3 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
            {state.phase === 'missing'
              ? 'Links change when a pass is re-retrieved. You can fetch the current one with your registration details.'
              : 'Nothing is lost. Please try again in a moment.'}
          </p>
          <Link
            to="/pass"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retrieve my pass
          </Link>
        </div>
      )}
    </Shell>
  );
}
