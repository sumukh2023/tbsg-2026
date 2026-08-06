import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PORTAL_PAGES, usePortalBase } from './routes';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { PortalShell, VolunteerMenu } from './PortalShell';
import { QrScanner } from './QrScanner';
import { useVolunteerSession } from './session-context';

/** One label-and-value row in the booking panel. */
function BookingLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="font-body text-sm text-foreground sm:mt-1">{value}</dd>
    </div>
  );
}

type Guest = {
  name: string;
  visitor_type: string;
  number_of_passes: number;
  /** Which pass of the booking this is, from 1. */
  sequence?: number;
  /** The booking this pass belongs to. Informational at the gate. */
  booking_reference?: string | null;
  purchaser?: string | null;
  purchaser_email?: string | null;
  /** School roll, returned for student passes only. */
  student_name?: string | null;
  usn?: string | null;
  class?: string | null;
  section?: string | null;
};

type VerifyState =
  | { phase: 'checking' }
  // Signed in at /verify-pass with no pass yet: choose scan or type.
  | { phase: 'portal' }
  | {
      phase: 'result';
      result:
        | 'valid'
        | 'checked_in'
        | 'already_checked_in'
        | 'cancelled'
        | 'invalid'
        | 'undone';
      reference?: string;
      guest?: Guest;
      checkedInAt?: string | null;
      checkedInBy?: string | null;
    }
  // The service answered but cannot verify (config/database unavailable).
  | { phase: 'service'; message: string }
  // The browser could not reach the service at all.
  | { phase: 'network' };

const visitorLabels: Record<string, string> = {
  student: 'Student',
  parent: 'Parent',
  other: 'Visitor',
  // Retired categories, kept so passes issued before the change still read
  // correctly at the gate.
  guest: 'Guest',
  alumni: 'Alumni',
  faculty: 'Faculty',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Event-day verifier for gate volunteers. Every decision comes from the
 * server (/api/verify); this page only renders the result.
 *
 * Authorisation is the volunteer's session cookie, which the browser attaches
 * on its own — no credential is held or sent by this component, and the
 * volunteer whose session it is becomes the attribution recorded against
 * every check-in they make. The route is wrapped in <RequireVolunteer>, so
 * reaching this component at all means the server has already confirmed a
 * session; a 401 mid-shift means it ended, and refresh() bounces to login.
 */
export default function VerifyPage() {
  /** Keeps every link under the address this visit arrived at. */
  const portalBase = usePortalBase();

  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { state: session, refresh } = useVolunteerSession();
  const isAdmin =
    session.phase === 'signed-in' && session.volunteer.role === 'admin';

  // Typed ticket code, used when no token came in through the URL.
  const [reference, setReference] = useState('');
  const [typing, setTyping] = useState(false);
  // Which pass the current result belongs to. Check-in is a second call and
  // must name the SAME pass the verify named — a pass reached by typed
  // reference has no token to fall back on.
  const subjectRef = useRef<{ token?: string; reference?: string } | null>(
    null
  );
  const [scanning, setScanning] = useState(false);
  const [state, setState] = useState<VerifyState>(
    token ? { phase: 'checking' } : { phase: 'portal' }
  );

  const call = useCallback(
    async (
      action: 'verify' | 'checkin' | 'undo',
      subject?: { token?: string; reference?: string }
    ) => {
      setState({ phase: 'checking' });
      if (subject) subjectRef.current = subject;
      const identify =
        subject ?? subjectRef.current ?? (token ? { token } : {});

      // Only a failed fetch is a network problem; everything else is an
      // answer from the service and gets its own state.
      let response: Response;
      try {
        response = await fetch('/api/verify', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...identify }),
        });
      } catch {
        setState({ phase: 'network' });
        return;
      }

      // The session ended underneath us (expired, logged out elsewhere, or
      // the account was disabled). Re-asking the server flips the provider to
      // anonymous, and the route guard takes it from there.
      if (response.status === 401) {
        await refresh();
        return;
      }

      const data = await response.json().catch(() => null);

      if (response.status === 403) {
        setState({
          phase: 'service',
          message: data?.error ?? 'That action is not available to you.',
        });
        return;
      }

      // 200 valid/checked_in/undone · 404 invalid · 409 already checked in ·
      // 410 cancelled: all carry a `result` the volunteer can act on.
      if (data?.result) {
        setState({
          phase: 'result',
          result: data.result,
          reference: data.pass?.reference,
          guest: data.pass?.guest,
          checkedInAt: data.pass?.checked_in_at,
          checkedInBy: data.pass?.checked_in_by,
        });
        return;
      }

      setState({
        phase: 'service',
        message:
          data?.error ??
          (response.status === 503
            ? 'Verification service unavailable.'
            : 'Unexpected server error.'),
      });
    },
    [token, refresh]
  );

  useEffect(() => {
    // With a token in the URL this page is the single-pass verifier it has
    // always been. Without one it is the portal: nothing to look up yet.
    if (!token) return;
    subjectRef.current = { token };
    void call('verify', { token });
  }, [call, token]);

  const submitReference = (event: React.FormEvent) => {
    event.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!value) return;
    void call('verify', { reference: value });
  };

  const backToPortal = () => {
    if (token) {
      setScanning(true);
      return;
    }
    setReference('');
    setTyping(false);
    subjectRef.current = null;
    setState({ phase: 'portal' });
  };

  return (
    <PortalShell chrome={<VolunteerMenu />}>
      {state.phase === 'portal' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE.out }}
          className="liquid-glass rounded-xl border border-white/10 p-6"
        >
          <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
            Verify a pass
          </h1>
          <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            Scan the QR on the guest's pass, or type the reference printed
            beneath it.
          </p>

          <button
            type="button"
            onClick={() => setScanning(true)}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-8 py-3.5 font-body text-sm font-medium text-accent-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            Scan QR code
          </button>

          {typing ? (
            <form onSubmit={submitReference} className="mt-3">
              <label
                htmlFor="reference"
                className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Ticket code
              </label>
              <input
                id="reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="FB26-XXXXX"
                className="mt-2 w-full rounded-lg border border-border bg-background/40 px-4 py-3.5 font-body text-base uppercase tracking-[0.12em] text-foreground outline-none transition-[border-color,box-shadow] duration-300 placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              />
              <button
                type="submit"
                disabled={!reference.trim()}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Verify pass
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              Enter ticket code
            </button>
          )}
        </motion.div>
      )}

      {state.phase === 'checking' && (
        <div
          className="flex flex-col items-center gap-4 text-center"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
          />
          <p className="font-body text-sm text-muted-foreground">
            Verifying pass
          </p>
        </div>
      )}

      {(state.phase === 'network' || state.phase === 'service') && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Unable to verify
          </p>
          <p className="mt-3 font-display text-3xl font-medium text-foreground">
            {state.phase === 'network'
              ? 'Network unavailable'
              : 'Service unavailable'}
          </p>
          <p className="mx-auto mt-3 max-w-xs font-body text-sm leading-relaxed text-muted-foreground">
            {state.phase === 'network'
              ? 'Your device could not reach the verification service. This is not a verdict on the pass; reconnect and try again.'
              : `${state.message} This is not a verdict on the pass; alert the festival desk if it persists.`}
          </p>
          <button
            onClick={() => void call('verify')}
            className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      {state.phase === 'result' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.out }}
          className={cn(
            'rounded-xl border p-6',
            state.result === 'valid' ||
              state.result === 'checked_in' ||
              state.result === 'undone'
              ? 'border-accent/60 bg-card'
              : state.result === 'already_checked_in'
                ? 'border-border bg-card'
                : 'border-destructive/60 bg-card'
          )}
          aria-live="polite"
        >
          <p
            className={cn(
              'font-body text-xs font-semibold uppercase tracking-[0.18em]',
              state.result === 'valid' ||
                state.result === 'checked_in' ||
                state.result === 'undone'
                ? 'text-accent'
                : state.result === 'already_checked_in'
                  ? 'text-muted-foreground'
                  : 'text-destructive'
            )}
          >
            {state.result === 'valid'
              ? 'Valid pass'
              : state.result === 'checked_in'
                ? 'Checked in'
                : state.result === 'undone'
                  ? 'Check-in undone'
                  : state.result === 'already_checked_in'
                    ? 'Already checked in'
                    : 'Cancelled / invalid pass'}
          </p>

          {state.guest ? (
            <>
              <p className="mt-4 font-display text-4xl font-medium leading-tight text-foreground">
                {state.guest.name}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border/60 pt-5">
                <div>
                  <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                    Type
                  </dt>
                  <dd className="mt-1 font-body text-sm text-foreground">
                    {visitorLabels[state.guest.visitor_type] ??
                      state.guest.visitor_type}
                  </dd>
                </div>
                <div>
                  <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                    Pass
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-medium leading-none text-foreground">
                    {state.guest.sequence ?? 1}
                    <span className="font-body text-sm text-muted-foreground">
                      {' '}
                      of {state.guest.number_of_passes}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                    Reference
                  </dt>
                  <dd className="mt-1 font-body text-sm tracking-wide text-foreground">
                    {state.reference}
                  </dd>
                </div>
                {/* The school roll, on the same card in the same register,
                    and only for students: rendering empty cells for a
                    parent would make every other pass look incomplete. */}
                {state.guest.visitor_type === 'student' && state.guest.usn && (
                  <div>
                    <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                      USN
                    </dt>
                    <dd className="mt-1 font-body text-sm tabular-nums tracking-wide text-foreground">
                      {state.guest.usn}
                    </dd>
                  </div>
                )}
                {state.guest.visitor_type === 'student' && state.guest.class && (
                  <div>
                    <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                      Class
                    </dt>
                    <dd className="mt-1 font-body text-sm text-foreground">
                      {state.guest.class}
                    </dd>
                  </div>
                )}
                {state.guest.visitor_type === 'student' &&
                  state.guest.section && (
                    <div>
                      <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                        Section
                      </dt>
                      <dd className="mt-1 font-body text-sm text-foreground">
                        {state.guest.section}
                      </dd>
                    </div>
                  )}
              </dl>

              {/* THE BOOKING, and it is INFORMATION ONLY.
                  Set apart from the attendee panel above on purpose: a
                  volunteer's decision is about the person in front of them,
                  and the booking is context for a question they might be
                  asked ("my husband has the other one"). Nothing here
                  changes what the button does. */}
              {state.guest.booking_reference && (
                <div className="mt-5 rounded-xl border border-border/60 bg-background/30 p-4">
                  <p className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                    Booking
                  </p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    <BookingLine
                      label="Reference"
                      value={state.guest.booking_reference}
                    />
                    <BookingLine
                      label="Passes in booking"
                      value={String(state.guest.number_of_passes)}
                    />
                    {state.guest.purchaser && (
                      <BookingLine
                        label="Booked by"
                        value={state.guest.purchaser}
                      />
                    )}
                    {state.guest.purchaser_email && (
                      <BookingLine
                        label="Email"
                        value={state.guest.purchaser_email}
                      />
                    )}
                  </dl>
                  <p className="mt-3 font-body text-2xs leading-relaxed text-muted-foreground">
                    Checking this guest in does not check in the rest of the
                    booking. Each pass is scanned separately.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
              This code does not match any pass. Direct the guest to the
              festival desk at the main gate.
            </p>
          )}

          {(state.result === 'already_checked_in' ||
            state.result === 'checked_in') &&
            state.checkedInAt && (
              <p className="mt-4 rounded-lg border border-border/60 px-4 py-3 font-body text-sm text-muted-foreground">
                {state.result === 'already_checked_in'
                  ? `First checked in at ${formatTime(state.checkedInAt)}`
                  : `Checked in at ${formatTime(state.checkedInAt)}`}
                {state.checkedInBy ? ` by ${state.checkedInBy}` : ''}
              </p>
            )}

          <div className="mt-6 flex flex-col gap-3">
            {state.result === 'valid' && (
              <button
                onClick={() => void call('checkin')}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-4 font-body text-base font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              >
                {/* ALWAYS ONE. This used to read "Check in 4 guests" off
                    the booking size, which was true when a booking was a
                    single shared QR code and became a lie the moment every
                    attendee got their own. A volunteer pressing it admits
                    the person in front of them and nobody else. */}
                Check in Guest
              </button>
            )}
            {/* Undoing reverses a decision already taken at the gate, so it
                is an administrator's call. The server enforces this too; the
                button is simply not offered to a volunteer. */}
            {isAdmin &&
              (state.result === 'already_checked_in' ||
                state.result === 'checked_in') && (
                <button
                  onClick={() => void call('undo')}
                  className="inline-flex w-full items-center justify-center rounded-full border border-destructive/60 px-8 py-3 font-body text-sm text-foreground transition-colors duration-300 hover:border-destructive hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Undo check-in
                </button>
              )}
            <button
              onClick={() => void call('verify')}
              className="inline-flex w-full items-center justify-center rounded-full border border-border px-8 py-3 font-body text-sm text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Re-check this pass
            </button>
            {/* Every completed outcome — checked in, already checked in,
                cancelled, invalid — flows to the next guest through the
                same shared scanner. Only 'valid' holds, because its
                primary action is the check-in itself. */}
            {state.result !== 'valid' && (
              <button
                onClick={backToPortal}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-4 font-body text-base font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              >
                {token ? 'Scan Next Guest' : 'Verify Next Guest'}
              </button>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {scanning && (
          <QrScanner
            onClose={() => setScanning(false)}
            onToken={(next) => {
              setScanning(false);
              if (next === token) {
                // Same code scanned again: re-check so the volunteer sees
                // the duplicate state immediately.
                void call('verify', { token: next });
              } else {
                navigate(`${portalBase}/${PORTAL_PAGES.verify}/${next}`);
              }
            }}
          />
        )}
      </AnimatePresence>
    </PortalShell>
  );
}
