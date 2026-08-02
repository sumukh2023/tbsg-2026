/**
 * POST /api/auth/logout — end the current session.
 *
 * The server-side row is revoked FIRST and the cookie cleared second, so a
 * cookie that somehow survives (a browser that ignores the clear, a copy
 * taken earlier) is already worthless: `sessionFromRequest` re-checks
 * `revoked_at` on every request.
 *
 * Always answers 200. Logging out of a session that was already gone is the
 * outcome the caller wanted, and reporting it as an error only ever produces
 * a confusing screen at the end of a shift.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { send, supabaseEnv } from '../_shared.js';
import {
  clearSessionCookie,
  originAllowed,
  revokeSession,
  sessionFromRequest,
} from '../_auth.js';

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

  const env = supabaseEnv('auth');
  if (env) {
    const session = await sessionFromRequest(req, env);
    if (session) await revokeSession(env, session.token);
  }

  clearSessionCookie(res);
  return send(res, 200, { ok: true });
}
