import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE } from '@/utils/motion';
import { PortalShell, VolunteerMenu } from './PortalShell';
import { useVolunteerSession } from './session-context';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Your own account: who the gate records you as, and the one thing you can
 * change without an administrator — your password. Everything else about an
 * account (role, whether it is active) is deliberately not self-service.
 */
export default function ProfilePage() {
  const { state, refresh } = useVolunteerSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (state.phase !== 'signed-in') return null;
  const { volunteer } = state;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? 'The password could not be changed.');
      } else {
        setCurrent('');
        setNext('');
        setConfirm('');
        setDone(true);
        await refresh();
      }
    } catch {
      setError('Your device could not reach the portal.');
    }
    setBusy(false);
  };

  const field =
    'mt-2 w-full rounded-lg border border-border bg-background/40 px-4 py-3.5 font-body text-base text-foreground outline-none transition-[border-color,box-shadow] duration-300 focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]';
  const label =
    'mt-4 block font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground';

  return (
    <PortalShell chrome={<VolunteerMenu />}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE.out }}
      >
        <Link
          to="/verify-pass"
          className="group inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back to verification
        </Link>

        <div className="liquid-glass mt-5 rounded-xl border border-white/10 p-6">
          <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
            {volunteer.name}
          </h1>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-5">
            <div>
              <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                Role
              </dt>
              <dd className="mt-1 font-body text-sm text-foreground">
                {volunteer.role === 'admin' ? 'Administrator' : 'Volunteer'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 break-all font-body text-sm text-foreground">
                {volunteer.email}
              </dd>
            </div>
          </dl>
        </div>

        {volunteer.must_change_password && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-accent/50 px-4 py-3 font-body text-sm text-foreground"
          >
            This account is still on the password an administrator set. Choose
            your own below.
          </p>
        )}

        <form
          onSubmit={submit}
          className="liquid-glass mt-4 rounded-xl border border-white/10 p-6"
        >
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Change password
          </h2>

          <label htmlFor="current" className={label}>
            Current password
          </label>
          <input
            id="current"
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
            autoComplete="current-password"
            className={field}
          />

          <label htmlFor="next" className={label}>
            New password
          </label>
          <input
            id="next"
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={field}
          />
          <p className="mt-2 font-body text-xs text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters. A short phrase you can
            remember beats a mangled word.
          </p>

          <label htmlFor="confirm" className={label}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            autoComplete="new-password"
            className={field}
          />

          {error && (
            <p role="alert" className="mt-3 font-body text-sm text-destructive">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="mt-3 font-body text-sm text-accent">
              Password changed. Any other device signed in as you has been
              signed out.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Saving' : 'Change password'}
          </button>
        </form>
      </motion.div>
    </PortalShell>
  );
}
