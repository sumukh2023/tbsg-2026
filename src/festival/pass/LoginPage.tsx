import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE } from '@/utils/motion';
import { PortalShell } from './PortalShell';
import { useVolunteerSession } from './session-context';

/**
 * Only paths inside this site, and only the portal. A `next` value arrives
 * from the URL, so it is attacker-controllable: without this check a crafted
 * link could bounce a volunteer to another origin immediately after they
 * typed their password, which is the classic open-redirect phishing setup.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  // A leading `//` or a backslash is a protocol-relative URL to elsewhere.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return null;
  }
  if (!raw.startsWith('/verify-pass')) return null;
  // The portal root is where the guard sends everyone who simply opened the
  // portal, so it is not a REQUEST for anywhere — treating it as one is what
  // stopped administrators ever landing on their dashboard. Only a deeper
  // link (a scanned pass, a profile) says where someone actually meant to go.
  const path = raw.split('?')[0].replace(/\/$/, '');
  return path === '/verify-pass' ? null : raw;
}

/**
 * Volunteer and administrator sign-in. There is no sign-up and no password
 * recovery link by design: accounts are created by an administrator, which
 * is what keeps the gate closed to anyone who merely knows the URL.
 */
export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, refresh } = useVolunteerSession();
  const requested = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — including the moment refresh() confirms the new
  // session — so leave rather than showing a form that has nothing to do.
  //
  // Where to: whatever was asked for (a scanned QR link survives the detour
  // through this page), and otherwise the landing that fits the account.
  // An administrator arriving with no destination in mind wants the desk,
  // not the scanner; a volunteer only has the scanner.
  useEffect(() => {
    if (state.phase !== 'signed-in') return;
    const home =
      state.volunteer.role === 'admin' ? '/verify-pass/admin' : '/verify-pass';
    navigate(requested ?? home, { replace: true });
  }, [state, navigate, requested]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setBusy(false);
      setError('Your device could not reach the portal. Check the connection.');
      return;
    }

    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setBusy(false);
      // Render what the server said. The fallback is chosen by STATUS rather
      // than assuming a credential failure: a 500 with no JSON body used to
      // surface as "Invalid email or password.", which sent everyone hunting
      // for a typo in a password that was never the problem.
      setError(
        data?.error ??
          (response.status === 401
            ? 'Invalid email or password.'
            : response.status === 429
              ? 'Too many sign-in attempts. Wait a few minutes and try again.'
              : `The sign-in service failed (error ${response.status}). This is not a problem with your password.`)
      );
      // Clearing only the password keeps a long address typed on a phone.
      setPassword('');
      return;
    }

    // The password was accepted and a cookie was sent. Whether this browser
    // KEPT it is a separate question, and the answer decides what to say.
    const who = await refresh();
    setBusy(false);
    if (!who) {
      // Authenticated, but the session did not come back — the cookie was
      // not stored or not returned. Saying "invalid password" here would be
      // a lie, and the wrong thing to go and check.
      setError(
        'Your password was accepted, but this browser did not keep the session cookie. ' +
          'Allow cookies for this site (Safari: Settings → Privacy → uncheck "Block all cookies"), ' +
          'leave Private Browsing, then try again.'
      );
      setPassword('');
    }
  };

  return (
    <PortalShell>
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE.out }}
        onSubmit={submit}
        className="liquid-glass rounded-xl border border-white/10 p-6"
      >
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
          Volunteer sign in
        </h1>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          Sign in with the account the festival desk created for you.
        </p>

        <label
          htmlFor="email"
          className="mt-6 block font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-border bg-background/40 px-4 py-3.5 font-body text-base text-foreground outline-none transition-[border-color,box-shadow] duration-300 focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
        />

        <label
          htmlFor="password"
          className="mt-4 block font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-border bg-background/40 px-4 py-3.5 font-body text-base text-foreground outline-none transition-[border-color,box-shadow] duration-300 focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
        />

        {error && (
          <p role="alert" className="mt-3 font-body text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
            />
          )}
          {busy ? 'Signing in' : 'Sign In'}
        </button>

        <p className="mt-5 border-t border-border/60 pt-4 font-body text-xs leading-relaxed text-muted-foreground">
          Accounts are issued by the festival desk. If you cannot sign in, ask
          an administrator to reset your password rather than sharing another
          volunteer's account.
        </p>
      </motion.form>
    </PortalShell>
  );
}
