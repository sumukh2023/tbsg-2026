/**
 * POST /api/auth/password — change your OWN password.
 *
 * Body: { current_password, new_password }
 *
 * Requires the current password even though the caller is already signed in:
 * an unattended gate tablet is the realistic threat, and re-proving knowledge
 * is what stops a passer-by from taking the account.
 *
 * Every OTHER session for this volunteer is revoked on success, and a fresh
 * one is minted for the caller. A password change that leaves old sessions
 * alive has not really changed anything.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonBody, send } from '../_shared.js';
import {
  createSession,
  findAccountByEmail,
  hashPassword,
  originAllowed,
  passwordProblem,
  requireVolunteer,
  revokeAllSessions,
  setSessionCookie,
  verifyPassword,
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
    return send(res, 422, { error: 'Choose a password you have not used here.' });
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

  // Everything that was signed in under the old password stops working,
  // including this request's own session; a replacement is issued so the
  // volunteer is not thrown back to the login screen for doing the right
  // thing.
  await revokeAllSessions(auth.env, auth.volunteer.id);
  const token = await createSession(auth.env, auth.volunteer.id, null);
  if (token) setSessionCookie(res, token);

  return send(res, 200, { ok: true });
}
