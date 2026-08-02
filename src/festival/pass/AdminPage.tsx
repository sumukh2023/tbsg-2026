import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import { EASE } from '@/utils/motion';
import { PortalShell, VolunteerMenu } from './PortalShell';
import { useVolunteerSession } from './session-context';

type Account = {
  id: string;
  full_name: string;
  email: string;
  role: 'volunteer' | 'admin';
  active: boolean;
  last_login: string | null;
  created_at: string;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: string | null;
};

type ActivityRow = {
  id: string;
  created_at: string;
  action: string;
  result: string | null;
  pass_reference: string | null;
  volunteer_name: string;
  volunteer_role: string;
};

const MIN_PASSWORD_LENGTH = 12;

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** True while a lockout is still in force. */
function lockedNow(account: Account): boolean {
  return (
    account.locked_until !== null &&
    new Date(account.locked_until).getTime() > Date.now()
  );
}

/**
 * Administrator dashboard: the team, and what the gate has been doing.
 *
 * Everything here is a thin client over `/api/admin/*`, which checks the role
 * server-side on every call. Rendering this page for a volunteer would show
 * them nothing — the API would refuse each request — but the route guard
 * turns them away first so they get a sentence instead of a broken screen.
 *
 * Lock state is shown deliberately. A locked account is refused at sign-in
 * with the same "Invalid email or password." as any other failure, which is
 * correct for the login form and useless for the person trying to help: this
 * is where you can actually see why someone cannot get in.
 */
export default function AdminPage() {
  const { state } = useVolunteerSession();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New-account form.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'volunteer' | 'admin'>('volunteer');

  const load = useCallback(async () => {
    try {
      const [list, log] = await Promise.all([
        fetch('/api/admin/volunteers', { credentials: 'same-origin' }),
        fetch('/api/admin/activity?view=timeline&limit=25', {
          credentials: 'same-origin',
        }),
      ]);
      if (list.ok) setAccounts((await list.json()).volunteers ?? []);
      else setError('Could not load the team.');
      if (log.ok) setActivity((await log.json()).rows ?? []);
    } catch {
      setError('Could not reach the portal.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every mutation goes through here, then reloads, so the view never lies. */
  const act = async (body: Record<string, unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/volunteers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) setError(data?.error ?? 'That did not work.');
      else {
        setNotice(done);
        await load();
      }
    } catch {
      setError('Could not reach the portal.');
    }
    setBusy(false);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    await act(
      { action: 'create', full_name: name, email, password, role },
      `${name} can now sign in. Give them that password in person; they will be asked to change it.`
    );
    setName('');
    setEmail('');
    setPassword('');
    setRole('volunteer');
  };

  if (state.phase !== 'signed-in') return null;
  const me = state.volunteer;

  const field =
    'mt-2 w-full rounded-lg border border-border bg-background/40 px-4 py-3 font-body text-base text-foreground outline-none transition-[border-color,box-shadow] duration-300 focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]';
  const label =
    'block font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground';
  const chip =
    'rounded-full border px-2.5 py-0.5 font-body text-2xs uppercase tracking-[0.14em]';
  const action =
    'rounded-full border border-border px-3 py-1.5 font-body text-xs text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <PortalShell wide chrome={<VolunteerMenu />}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE.out }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
              Festival desk
            </h1>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Signed in as {me.name}. Manage who can work the gate, and see
              what the gate has been doing.
            </p>
          </div>
          <Link
            to="/verify-pass"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-6 py-3 font-body text-sm font-medium text-accent-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <ScanLine aria-hidden="true" className="h-4 w-4" />
            Verify passes
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-destructive/60 px-4 py-3 font-body text-sm text-foreground"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-5 rounded-lg border border-accent/50 px-4 py-3 font-body text-sm text-foreground"
          >
            {notice}
          </p>
        )}

        {/* Add someone */}
        <form
          onSubmit={create}
          className="liquid-glass mt-8 rounded-xl border border-white/10 p-6"
        >
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Add a volunteer
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            Set a starting password and pass it on in person. They will be
            asked to choose their own the first time they sign in.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-name" className={label}>
                Full name
              </label>
              <input
                id="new-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                autoComplete="off"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="new-email" className={label}>
                Email
              </label>
              <input
                id="new-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="off"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="new-password" className={label}>
                Starting password
              </label>
              <input
                id="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="off"
                className={field}
              />
              <p className="mt-2 font-body text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div>
              <label htmlFor="new-role" className={label}>
                Role
              </label>
              <select
                id="new-role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as 'volunteer' | 'admin')
                }
                className={field}
              >
                <option value="volunteer">Volunteer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-8 py-3 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Working' : 'Create account'}
          </button>
        </form>

        {/* The team */}
        <section className="liquid-glass mt-6 rounded-xl border border-white/10 p-6">
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            The team
          </h2>
          {accounts === null ? (
            <p className="mt-4 font-body text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {accounts.map((account) => {
                const locked = lockedNow(account);
                const self = account.id === me.id;
                return (
                  <li
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-foreground">
                        {account.full_name}
                        {self && (
                          <span className="ml-2 font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="break-all font-body text-xs text-muted-foreground">
                        {account.email}
                      </p>
                      <p className="mt-1 font-body text-2xs text-muted-foreground">
                        Last signed in {when(account.last_login)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          chip +
                          (account.role === 'admin'
                            ? ' border-accent/60 text-accent'
                            : ' border-border text-muted-foreground')
                        }
                      >
                        {account.role === 'admin' ? 'Admin' : 'Volunteer'}
                      </span>
                      {!account.active && (
                        <span
                          className={chip + ' border-destructive/60 text-destructive'}
                        >
                          Disabled
                        </span>
                      )}
                      {locked && (
                        <span
                          className={chip + ' border-destructive/60 text-destructive'}
                        >
                          Locked until {when(account.locked_until)}
                        </span>
                      )}
                      {account.must_change_password && (
                        <span className={chip + ' border-border text-muted-foreground'}>
                          Must change password
                        </span>
                      )}
                    </div>

                    {/* An administrator cannot act on their own account; the
                        server refuses it too, so nobody locks themselves out
                        of their own event. */}
                    {!self && (
                      <div className="flex flex-wrap gap-2">
                        {account.active ? (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                { action: 'disable', id: account.id },
                                `${account.full_name} can no longer sign in, and any device they were signed in on has been signed out.`
                              )
                            }
                            className={action}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                { action: 'enable', id: account.id },
                                `${account.full_name} can sign in again.`
                              )
                            }
                            className={action}
                          >
                            Enable
                          </button>
                        )}
                        {locked && account.active && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                { action: 'enable', id: account.id },
                                `${account.full_name} is unlocked and can try again now.`
                              )
                            }
                            className={action}
                          >
                            Unlock
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => {
                            const next = window.prompt(
                              `New password for ${account.full_name} (at least ${MIN_PASSWORD_LENGTH} characters). Give it to them in person.`
                            );
                            if (!next) return;
                            void act(
                              { action: 'reset', id: account.id, password: next },
                              `${account.full_name}'s password is reset. They will be asked to change it.`
                            );
                          }}
                          className={action}
                        >
                          Reset password
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act(
                              {
                                action:
                                  account.role === 'admin' ? 'demote' : 'promote',
                                id: account.id,
                              },
                              `${account.full_name} is now a ${account.role === 'admin' ? 'volunteer' : 'administrator'}, and has been signed out so the change takes effect.`
                            )
                          }
                          className={action}
                        >
                          {account.role === 'admin'
                            ? 'Make volunteer'
                            : 'Make admin'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* What the gate has been doing */}
        <section className="liquid-glass mt-6 rounded-xl border border-white/10 p-6">
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Recent gate activity
          </h2>
          {activity === null ? (
            <p className="mt-4 font-body text-sm text-muted-foreground">
              Loading…
            </p>
          ) : activity.length === 0 ? (
            <p className="mt-4 font-body text-sm text-muted-foreground">
              Nothing yet. Every verification, check-in and undo will appear
              here with the name of whoever did it.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {activity.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <span className="font-body text-sm text-foreground">
                    {row.volunteer_name}{' '}
                    <span className="text-muted-foreground">
                      {row.action === 'checkin'
                        ? 'checked in'
                        : row.action === 'undo'
                          ? 'undid a check-in for'
                          : row.action === 'lookup_failed'
                            ? 'scanned an unknown code'
                            : 'verified'}
                    </span>{' '}
                    {row.pass_reference && (
                      <span className="tracking-wide">{row.pass_reference}</span>
                    )}
                  </span>
                  <span className="font-body text-xs text-muted-foreground">
                    {when(row.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>
    </PortalShell>
  );
}
