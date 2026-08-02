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
function safeNext(raw: string | null): string {
  if (!raw) return '/verify-pass';
  // A leading `//` or a backslash is a protocol-relative URL to elsewhere.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/verify-pass';
  }
  return raw.startsWith('/verify-pass') ? raw : '/verify-pass';
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
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — including the moment refresh() confirms the new
  // session — so leave rather than showing a form that has nothing to do.
  useEffect(() => {
    if (state.phase === 'signed-in') navigate(next, { replace: true });
  }, [state.phase, navigate, next]);

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
      // The server sends one sentence for every credential failure; this
      // renders whatever it said rather than inventing a more specific one.
      setError(data?.error ?? 'Invalid email or password.');
      // Clearing only the password keeps a long address typed on a phone.
      setPassword('');
      return;
    }

    // The cookie is already set; refresh() reads the identity back from the
    // server, and the effect above does the navigating.
    await refresh();
    setBusy(false);
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
