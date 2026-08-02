/**
 * /api/auth — the volunteer portal's authentication endpoint.
 *
 *   GET  /api/auth/session            who is signed in, if anyone
 *   POST /api/auth/login              { email, password }
 *   POST /api/auth/logout
 *   POST /api/auth/password           { current_password, new_password }
 *
 * One function serving four actions, dispatched on `?action=` — the pretty
 * paths above are rewritten to it in vercel.json. They were four separate
 * files until the Hobby plan's twelve-function ceiling made that a deployment
 * failure rather than a style choice; the routes and their semantics are
 * unchanged, so nothing that calls them had to move.
 *
 * Status semantics:
 *   200 ok (session: also when nobody is signed in) · 400 malformed
 *   401 invalid credentials / not signed in        · 403 blocked origin
 *   405 wrong method       · 422 rejected password · 429 rate limited
 *   503 configuration/database unavailable
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonBody, send, supabaseEnv } from './_shared.js';
import {
  accountLocked,
  burnTiming,
  clearSessionCookie,
  clientIpHash,
  createSession,
  findAccountByEmail,
  hashPassword,
  loginRateLimited,
  noteFailure,
  noteSuccess,
  normaliseEmail,
  originAllowed,
  passwordProblem,
  publicProfile,
  recordLoginAttempt,
  requireVolunteer,
  revokeAllSessions,
  revokeSession,
  sessionFromRequest,
  setSessionCookie,
  verifyPassword,
} from './_auth.js';

/** The only failure sentence login will ever produce. */
const INVALID = 'Invalid email or password.';

/**
 * A short, human label for the session list — browser family only. Never the
 * full user-agent and never an IP: enough for someone to recognise their own
 * session, not enough to be a tracking record.
 */
function clientLabel(req: VercelRequest): string | null {
  const ua = req.headers['user-agent'];
  if (typeof ua !== 'string') return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const platform = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : '';
  return platform ? `${browser} on ${platform}` : browser;
}

/**
 * GET session. Always 200: "nobody is signed in" is a normal answer to this
 * question, and modelling it as an error turns every first page load into a
 * console full of 401s.
 */
async function handleSession(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // A session answer must never be cached — by the browser, by Vercel's edge,
  // or by anything between. Serving one volunteer's identity to the next
  // person on a shared gate tablet is the failure this header prevents.
  res.setHeader('Cache-Control', 'no-store, private');

  const env = supabaseEnv('auth');
  if (!env) return send(res, 200, { volunteer: null });

  const session = await sessionFromRequest(req, env);
  return send(res, 200, {
    volunteer: session ? publicProfile(session.volunteer) : null,
  });
}

/**
 * Sign in. The 401 body is always the same sentence: whether the address
 * exists, whether the password was wrong, whether the account is disabled and
 * whether it is locked are all indistinguishable from outside — and the
 * timing matches too, because a miss still pays for one Argon2 verification.
 */
async function handleLogin(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const body = jsonBody(req);
  if (!body) return send(res, 400, { error: 'Request body must be JSON.' });

  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  const env = supabaseEnv('auth');
  if (!env) {
    return send(res, 503, {
      error: 'The sign-in service is unavailable right now.',
    });
  }

  const ipHash = await clientIpHash(req);

  // A malformed address still costs a hash and still counts as an attempt,
  // so probing with junk is neither faster nor free.
  if (!email || !password) {
    await burnTiming(password);
    await recordLoginAttempt(env, {
      email: email ?? '(malformed)',
      ipHash,
      successful: false,
      reason: 'malformed',
    });
    return send(res, 401, { error: INVALID });
  }

  if (await loginRateLimited(env, email, ipHash)) {
    await recordLoginAttempt(env, {
      email,
      ipHash,
      successful: false,
      reason: 'rate_limited',
    });
    return send(res, 429, {
      error: 'Too many sign-in attempts. Wait a few minutes and try again.',
    });
  }

  const account = await findAccountByEmail(env, email);

  // No such address: spend the same time a real verification would, so the
  // response cannot be timed to enumerate who has an account.
  if (!account) {
    await burnTiming(password);
    await recordLoginAttempt(env, {
      email,
      ipHash,
      successful: false,
      reason: 'unknown_email',
    });
    return send(res, 401, { error: INVALID });
  }

  // Locked and disabled accounts still verify the password before answering,
  // for the same timing reason, and still answer with the same sentence.
  const passwordOk = await verifyPassword(account.password_hash, password);

  if (accountLocked(account)) {
    await recordLoginAttempt(env, {
      email,
      ipHash,
      successful: false,
      volunteerId: account.id,
      reason: 'locked',
    });
    return send(res, 401, { error: INVALID });
  }

  if (!account.active) {
    await recordLoginAttempt(env, {
      email,
      ipHash,
      successful: false,
      volunteerId: account.id,
      reason: 'disabled',
    });
    return send(res, 401, { error: INVALID });
  }

  if (!passwordOk) {
    await noteFailure(env, account);
    await recordLoginAttempt(env, {
      email,
      ipHash,
      successful: false,
      volunteerId: account.id,
      reason: 'bad_password',
    });
    return send(res, 401, { error: INVALID });
  }

  const token = await createSession(env, account.id, clientLabel(req));
  if (!token) {
    console.error('[auth] stage=login session mint failed');
    return send(res, 503, {
      error: 'The sign-in service is unavailable right now.',
    });
  }

  await noteSuccess(env, account.id);
  await recordLoginAttempt(env, {
    email,
    ipHash,
    successful: true,
    volunteerId: account.id,
  });

  setSessionCookie(res, token);
  return send(res, 200, { ok: true, volunteer: publicProfile(account) });
}

/**
 * Sign out. The server-side row is revoked FIRST and the cookie cleared
 * second, so a cookie that somehow survives is already worthless:
 * `sessionFromRequest` re-checks `revoked_at` on every request.
 *
 * Always 200. Logging out of a session that was already gone is the outcome
 * the caller wanted, and reporting it as an error only ever produces a
 * confusing screen at the end of a shift.
 */
async function handleLogout(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const env = supabaseEnv('auth');
  if (env) {
    const session = await sessionFromRequest(req, env);
    if (session) await revokeSession(env, session.token);
  }
  clearSessionCookie(res);
  return send(res, 200, { ok: true });
}

/**
 * Change your OWN password. Requires the current one even though the caller
 * is already signed in: an unattended gate tablet is the realistic threat,
 * and re-proving knowledge is what stops a passer-by taking the account.
 */
async function handlePassword(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const auth = await requireVolunteer(req, res);
  if (!auth) return;

  const body = jsonBody(req);
  if (!body) return send(res, 400, { error: 'Request body must be JSON.' });

  const current =
    typeof body.current_password === 'string' ? body.current_password : '';
  const next = typeof body.new_password === 'string' ? body.new_password : '';

  const problem = passwordProblem(next);
  if (problem) return send(res, 422, { error: problem });
  if (next === current) {
    return send(res, 422, {
      error: 'Choose a password you have not used here.',
    });
  }

  const account = await findAccountByEmail(auth.env, auth.volunteer.email);
  if (!account || !(await verifyPassword(account.password_hash, current))) {
    return send(res, 401, { error: 'Current password is incorrect.' });
  }

  const password_hash = await hashPassword(next);
  const update = await fetch(
    `${auth.env.url}/rest/v1/volunteers?id=eq.${auth.volunteer.id}`,
    {
      method: 'PATCH',
      headers: auth.env.headers,
      body: JSON.stringify({
        password_hash,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!update.ok) {
    console.error(`[auth] stage=password supabase_status=${update.status}`);
    return send(res, 503, { error: 'The password could not be changed.' });
  }

  // Everything signed in under the old password stops working, including this
  // request's own session; a replacement is issued so the volunteer is not
  // thrown back to the login screen for doing the right thing.
  await revokeAllSessions(auth.env, auth.volunteer.id);
  const token = await createSession(auth.env, auth.volunteer.id, null);
  if (token) setSessionCookie(res, token);

  return send(res, 200, { ok: true });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const raw = req.query.action;
  const action = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  if (req.method === 'GET') {
    // `session` is the only readable action; everything else changes state.
    if (action && action !== 'session') {
      return send(res, 405, { error: 'Method not allowed.' });
    }
    return handleSession(req, res);
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }
  // SameSite=Strict already keeps the cookie off cross-site requests; this is
  // the second line, applied to every state-changing action at once.
  if (!originAllowed(req)) {
    return send(res, 403, { error: 'Request blocked.' });
  }

  switch (action) {
    case 'login':
      return handleLogin(req, res);
    case 'logout':
      return handleLogout(req, res);
    case 'password':
      return handlePassword(req, res);
    default:
      return send(res, 400, { error: 'Unknown action.' });
  }
}
