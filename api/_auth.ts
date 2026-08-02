/**
 * Volunteer/administrator authentication for the gate portal.
 *
 * Everything security-relevant about the portal lives here: password
 * hashing, session minting and validation, cookie handling, rate limiting
 * and the role gate. Route files call `requireVolunteer`/`requireAdmin` and
 * never reason about any of it themselves.
 *
 * Files prefixed with an underscore are not exposed as routes by Vercel.
 *
 * Design notes:
 * - Sessions are SERVER SIDE. The cookie carries an opaque 32-byte token and
 *   the database stores only its SHA-256 hash, so a leaked database dump
 *   cannot be replayed as a login — the same shape as the attendee pass
 *   tokens.
 * - Nothing about authentication is ever written where a script can read it.
 *   No localStorage, no readable cookie, no token in a response body.
 * - The attendee side is untouched: this module knows nothing about
 *   `registrations` or how a visitor retrieves a pass.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hash as argonHash, verify as argonVerify, Algorithm } from '@node-rs/argon2';
import { randomToken, send, sha256Hex, supabaseEnv } from './_shared.js';

export const VOLUNTEER_ROLES = ['volunteer', 'admin'] as const;
export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number];

export type Volunteer = {
  id: string;
  full_name: string;
  email: string;
  role: VolunteerRole;
  active: boolean;
  must_change_password: boolean;
};

/**
 * Cookie name. Deliberately NOT `__Host-` prefixed any more.
 *
 * `__Host-` is stricter — the browser refuses to store the cookie at all
 * unless Secure, Path=/ and no Domain all hold — and that strictness is
 * exactly the wrong trade here: when a prefixed cookie is rejected, it is
 * rejected SILENTLY. The response looks successful, nothing is stored, and
 * the next request arrives anonymous, which reads to the user as "my correct
 * password was refused". What it bought us was protection against a sibling
 * subdomain overwriting the cookie, and `vercel.app` is on the Public Suffix
 * List, so no sibling can set a cookie for the parent domain anyway.
 */
export const SESSION_COOKIE = 'fb_volunteer';
/** Idle-free absolute lifetime. One long event day plus travel either side. */
const SESSION_HOURS = 12;
/** Minimum password length. Length beats composition rules; see OWASP. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Argon2id at the OWASP-recommended second option: 19 MiB, 2 iterations,
 * 1 lane. Measured at ~120ms on this class of machine, which is the right
 * order for a login that happens once a shift, and hostile to offline
 * cracking. Parameters are stored inside the PHC string, so raising them
 * later re-hashes on next login rather than invalidating anyone.
 */
const ARGON = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON);
}

/**
 * Verify a password against a stored hash. Argon2 comparison is inherently
 * constant-time with respect to the hash, and a malformed or missing hash
 * returns false rather than throwing, so a damaged row cannot become an
 * authentication bypass.
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

/**
 * A dummy hash to verify against when the email does not exist, so a missing
 * account costs the same ~120ms as a wrong password. Without this, response
 * timing tells an attacker which addresses are real — which is precisely what
 * the single "Invalid email or password." message exists to hide.
 */
let decoyHash: string | null = null;
export async function burnTiming(password: string): Promise<void> {
  decoyHash ??= await hashPassword(randomToken(16));
  await verifyPassword(decoyHash, password);
}

/** Password policy. Returns an error message, or null when acceptable. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return 'Password is too long.';
  // Rejecting only the genuinely trivial. Long passphrases are the goal, and
  // composition rules push people towards short, mangled, forgotten strings.
  if (/^(.)\1+$/.test(password)) return 'Choose a less predictable password.';
  return null;
}

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 160) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

// ---------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------

/**
 * HttpOnly so no script can read it, Secure so it never crosses plain HTTP.
 *
 * SameSite=Lax rather than Strict. Lax already withholds the cookie from
 * cross-site POSTs, which is the CSRF case that matters, and every
 * state-changing route additionally checks the Origin header. Strict also
 * withholds it from top-level cross-site NAVIGATIONS — so a volunteer
 * opening the portal from a link in a message would arrive looking signed
 * out, on a shift, at a gate. That is a real cost for no real gain.
 */
function cookie(value: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  res.setHeader('Set-Cookie', cookie(token, SESSION_HOURS * 3600));
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader('Set-Cookie', cookie('', 0));
}

function readCookie(req: VercelRequest, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * SameSite=Lax already keeps the cookie off cross-site POSTs, so this is
 * defence in depth rather than the only line: reject a state-changing
 * call whose Origin is not our own host. Same-origin fetches from the portal
 * always send one.
 */
export function originAllowed(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser client; the cookie gate still applies
  const host = req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------

export type Env = NonNullable<ReturnType<typeof supabaseEnv>>;

async function query<T>(
  env: Env,
  path: string,
  init?: RequestInit
): Promise<T | null> {
  const response = await fetch(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...env.headers, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    console.error(`[auth] supabase_status=${response.status} path=${path.split('?')[0]}`);
    return null;
  }
  // A successful write that did not ask for `Prefer: return=representation`
  // comes back with NO BODY — 204 for a PATCH, and 201 with an empty body for
  // an INSERT. Calling .json() on that throws "Unexpected end of JSON input",
  // which is not a failed request but reads like a crashed one: it took down
  // every login AFTER the attempt row had been written, so the database said
  // the sign-in succeeded while the browser got a 500.
  //
  // Read the body as text and decide from what is actually there, rather than
  // from the status code. An empty body is a successful write with nothing to
  // report, which is exactly what the callers expect.
  const text = await response.text();
  if (!text.trim()) return [] as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(
      `[auth] non-JSON body from ${path.split('?')[0]} (status ${response.status})`
    );
    return [] as unknown as T;
  }
}

const VOLUNTEER_SELECT =
  'select=id,full_name,email,role,active,must_change_password';

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

/** Mint a session, returning the raw token exactly once (for the cookie). */
export async function createSession(
  env: Env,
  volunteerId: string,
  clientLabel: string | null
): Promise<string | null> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const rows = await query<Array<{ id: string }>>(env, 'volunteer_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      volunteer_id: volunteerId,
      token_hash: await sha256Hex(token),
      expires_at: expires.toISOString(),
      client_label: clientLabel,
    }),
  });
  return rows && rows.length > 0 ? token : null;
}

export async function revokeSession(env: Env, token: string): Promise<void> {
  await query(
    env,
    `volunteer_sessions?token_hash=eq.${await sha256Hex(token)}&revoked_at=is.null`,
    {
      method: 'PATCH',
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    }
  );
}

/** Revoke every live session for one volunteer (disable, demote, reset). */
export async function revokeAllSessions(
  env: Env,
  volunteerId: string
): Promise<void> {
  await query(
    env,
    `volunteer_sessions?volunteer_id=eq.${volunteerId}&revoked_at=is.null`,
    {
      method: 'PATCH',
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    }
  );
}

type SessionRow = {
  id: string;
  expires_at: string;
  revoked_at: string | null;
  volunteer_id: string;
};

/** Fetch one volunteer by id. Used to resolve a session and to name an actor. */
export async function findVolunteerById(
  env: Env,
  id: string
): Promise<Volunteer | null> {
  const rows = await query<Volunteer[]>(
    env,
    `volunteers?${VOLUNTEER_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows?.[0] ?? null;
}

/**
 * Resolve the cookie to a live volunteer, or null. Expiry and revocation are
 * re-checked HERE on every request rather than trusted from the cookie, which
 * is what makes logout and "disable this account" take effect immediately
 * rather than whenever a token happens to run out.
 *
 * TWO PLAIN QUERIES, deliberately, rather than one with an embedded
 * `volunteers(...)`. A PostgREST embed is the one thing in this file whose
 * behaviour depends on the server: which relationship it picks when several
 * exist, and whether a to-one embed comes back as an object or as a
 * single-element array. Guess wrong about either and this returns null for a
 * session that is perfectly valid — the login succeeds, the cookie is set,
 * and the volunteer is bounced back to the sign-in page with no error. The
 * extra round trip is worth never having to be right about that.
 */
export async function sessionFromRequest(
  req: VercelRequest,
  env: Env
): Promise<{ volunteer: Volunteer; token: string } | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return null;

  const rows = await query<SessionRow[]>(
    env,
    `volunteer_sessions?select=id,expires_at,revoked_at,volunteer_id` +
      `&token_hash=eq.${await sha256Hex(token)}&limit=1`
  );
  const row = rows?.[0];
  if (!row || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  const volunteer = await findVolunteerById(env, row.volunteer_id);
  if (!volunteer || !volunteer.active) return null;

  // Fire-and-forget liveness stamp; a failure here must never fail the call.
  void query(env, `volunteer_sessions?id=eq.${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => {});

  return { volunteer, token };
}

// ---------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------

export type AuthContext = { env: Env; volunteer: Volunteer; token: string };

/**
 * Gate a route on a valid session. Responds and returns null when the caller
 * is not authenticated, so a handler reads:
 *
 *     const auth = await requireVolunteer(req, res);
 *     if (!auth) return;
 *
 * 401 means "not signed in" and is what the client turns into a redirect to
 * the login page. It never says whether the session was missing, expired or
 * revoked: all three mean sign in again.
 */
export async function requireVolunteer(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const env = supabaseEnv('auth');
  if (!env) {
    send(res, 503, { error: 'Verification service unavailable.' });
    return null;
  }
  const session = await sessionFromRequest(req, env);
  if (!session) {
    send(res, 401, { error: 'Sign in to continue.' });
    return null;
  }
  return { env, volunteer: session.volunteer, token: session.token };
}

/** As above, and additionally requires the administrator role. */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const auth = await requireVolunteer(req, res);
  if (!auth) return null;
  if (auth.volunteer.role !== 'admin') {
    // 403, not 404: the caller is known, and hiding the route from a signed-in
    // volunteer buys nothing while making a real permission error unreadable.
    send(res, 403, { error: 'Administrator access is required.' });
    return null;
  }
  return auth;
}

// ---------------------------------------------------------------------
// Rate limiting and lockout
// ---------------------------------------------------------------------

/** Failures tolerated per address, and per source, in the window below. */
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 15;

/**
 * Hash of the client IP. The address itself is never stored — the limiter
 * only needs to know that two attempts came from the same place.
 */
export async function clientIpHash(req: VercelRequest): Promise<string | null> {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = raw?.split(',')[0]?.trim();
  return ip ? sha256Hex(ip) : null;
}

export async function recordLoginAttempt(
  env: Env,
  entry: {
    email: string;
    ipHash: string | null;
    successful: boolean;
    volunteerId?: string | null;
    reason?: string;
  }
): Promise<void> {
  await query(env, 'volunteer_login_attempts', {
    method: 'POST',
    body: JSON.stringify({
      email: entry.email,
      ip_hash: entry.ipHash,
      successful: entry.successful,
      volunteer_id: entry.volunteerId ?? null,
      reason: entry.reason ?? null,
    }),
  });
}

/**
 * True when this address or this source has failed too often lately. Counted
 * from the durable ledger because a serverless function remembers nothing
 * between invocations, so an in-memory limiter would reset on every cold
 * start — which is to say, constantly.
 */
export async function loginRateLimited(
  env: Env,
  email: string,
  ipHash: string | null
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const base = `volunteer_login_attempts?select=id&successful=is.false&created_at=gte.${since}`;

  const byEmail = await query<Array<{ id: number }>>(
    env,
    `${base}&email=eq.${encodeURIComponent(email)}&limit=${MAX_FAILURES_PER_EMAIL}`
  );
  if (byEmail && byEmail.length >= MAX_FAILURES_PER_EMAIL) return true;

  if (ipHash) {
    const byIp = await query<Array<{ id: number }>>(
      env,
      `${base}&ip_hash=eq.${ipHash}&limit=${MAX_FAILURES_PER_IP}`
    );
    if (byIp && byIp.length >= MAX_FAILURES_PER_IP) return true;
  }
  return false;
}

type AccountRow = Volunteer & {
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
};

/** Look up an account for login, including the fields only login needs. */
export async function findAccountByEmail(
  env: Env,
  email: string
): Promise<AccountRow | null> {
  const rows = await query<AccountRow[]>(
    env,
    `volunteers?${VOLUNTEER_SELECT},password_hash,failed_attempts,locked_until` +
      `&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  return rows?.[0] ?? null;
}

export function accountLocked(account: AccountRow): boolean {
  return (
    account.locked_until !== null &&
    new Date(account.locked_until).getTime() > Date.now()
  );
}

/** Count a failure against the account, locking it once it crosses the line. */
export async function noteFailure(
  env: Env,
  account: AccountRow
): Promise<void> {
  const failed = account.failed_attempts + 1;
  const locked =
    failed >= MAX_FAILURES_PER_EMAIL
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
      : account.locked_until;
  await query(env, `volunteers?id=eq.${account.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      failed_attempts: failed,
      locked_until: locked,
      updated_at: new Date().toISOString(),
    }),
  });
}

/** Clear lockout state and stamp the login. */
export async function noteSuccess(env: Env, volunteerId: string): Promise<void> {
  await query(env, `volunteers?id=eq.${volunteerId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      failed_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

// ---------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------

export type VerificationAction = 'verify' | 'checkin' | 'undo' | 'lookup_failed';

/**
 * Record what a volunteer did. The role is stored as it was AT THE TIME, so
 * promoting someone later does not rewrite the authority their past actions
 * were taken under. The display name is deliberately NOT stored — it is
 * joined from `volunteers`, so correcting a spelling fixes every past report.
 *
 * Never throws and never blocks the caller's result: a gate that cannot write
 * its log must still be able to admit the queue.
 */
export async function recordVerification(
  env: Env,
  entry: {
    volunteer: Volunteer;
    action: VerificationAction;
    passId?: string | null;
    reference?: string | null;
    result?: string | null;
  }
): Promise<void> {
  try {
    await query(env, 'verification_events', {
      method: 'POST',
      body: JSON.stringify({
        pass_id: entry.passId ?? null,
        volunteer_id: entry.volunteer.id,
        volunteer_role: entry.volunteer.role,
        action: entry.action,
        result: entry.result ?? null,
        pass_reference: entry.reference ?? null,
      }),
    });
  } catch {
    console.error('[auth] stage=audit write failed');
  }
}

/** The shape the portal shows in its profile chip. Never includes a hash. */
export function publicProfile(volunteer: Volunteer) {
  return {
    id: volunteer.id,
    name: volunteer.full_name,
    email: volunteer.email,
    role: volunteer.role,
    must_change_password: volunteer.must_change_password,
  };
}
