/**
 * POST /api/auth/login — sign a volunteer or administrator in.
 *
 * Body: { email, password }
 * Sets an HttpOnly, Secure, SameSite=Strict `__Host-` session cookie and
 * returns the profile the portal renders. The session token itself is never
 * in the response body, so no script on the page can read it.
 *
 * Status semantics:
 *   200 signed in       · 401 invalid credentials (whatever the real reason)
 *   429 rate limited    · 400 malformed request
 *   503 configuration/database unavailable
 *
 * The 401 body is always the same sentence. Whether the address exists,
 * whether the password was wrong, whether the account is disabled and
 * whether it is locked are all indistinguishable from outside — and the
 * timing matches too, because a miss still pays for one Argon2 verification.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonBody, send, supabaseEnv } from '../_shared.js';
import {
  accountLocked,
  burnTiming,
  clientIpHash,
  createSession,
  findAccountByEmail,
  loginRateLimited,
  noteFailure,
  noteSuccess,
  normaliseEmail,
  originAllowed,
  publicProfile,
  recordLoginAttempt,
  setSessionCookie,
  verifyPassword,
} from '../_auth.js';

/** The only failure sentence this route will ever produce. */
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }
  if (!originAllowed(req)) {
    return send(res, 403, { error: 'Request blocked.' });
  }

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
