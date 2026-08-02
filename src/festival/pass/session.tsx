import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PortalShell } from './PortalShell';
import {
  SessionContext,
  useVolunteerSession,
  type SessionState,
  type Volunteer,
} from './session-context';

export function VolunteerSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ phase: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        // Same-origin cookies are sent by default, but being explicit here
        // documents that this request is *about* the cookie.
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = (await response.json().catch(() => null)) as {
        volunteer?: Volunteer | null;
      } | null;
      setState(
        data?.volunteer
          ? { phase: 'signed-in', volunteer: data.volunteer }
          : { phase: 'anonymous' }
      );
    } catch {
      setState({ phase: 'offline' });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // The server-side row may well be gone already; either way the local
      // view of the session must not survive the attempt.
    }
    setState({ phase: 'anonymous' });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ state, refresh, signOut }),
    [state, refresh, signOut]
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/**
 * Route guard. Renders its children only for a signed-in volunteer, and
 * sends everyone else to the login page carrying where they were headed, so
 * a scanned QR link survives the detour and lands on the right pass.
 *
 * This is a convenience, not the security boundary: the APIs check the
 * session themselves on every call, so a client that skipped this guard
 * would simply get 401s and see nothing.
 */
export function RequireVolunteer({
  children,
  role,
}: {
  children: ReactNode;
  role?: 'admin';
}) {
  const { state } = useVolunteerSession();
  const location = useLocation();

  if (state.phase === 'loading') {
    return (
      <PortalShell>
        <div
          className="flex flex-col items-center gap-4 text-center"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
          />
          <p className="font-body text-sm text-muted-foreground">
            Checking your access
          </p>
        </div>
      </PortalShell>
    );
  }

  if (state.phase === 'offline') {
    return (
      <PortalShell>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Unable to sign in
          </p>
          <p className="mt-3 font-display text-3xl font-medium text-foreground">
            Network unavailable
          </p>
          <p className="mx-auto mt-3 max-w-xs font-body text-sm leading-relaxed text-muted-foreground">
            Your device could not reach the portal. Reconnect and reload; your
            session has not been lost.
          </p>
        </div>
      </PortalShell>
    );
  }

  if (state.phase === 'anonymous') {
    const next = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/verify-pass/login?next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  if (role === 'admin' && state.volunteer.role !== 'admin') {
    return (
      <PortalShell>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Not available
          </p>
          <p className="mt-3 font-display text-3xl font-medium text-foreground">
            Administrators only
          </p>
          <p className="mx-auto mt-3 max-w-xs font-body text-sm leading-relaxed text-muted-foreground">
            Your account can verify and check in passes. Ask an administrator
            if you need access to this page.
          </p>
        </div>
      </PortalShell>
    );
  }

  return <>{children}</>;
}
