/**
 * GET /api/auth/session — who is signed in, if anyone.
 *
 * The portal calls this on load to decide between rendering the gate tools
 * and redirecting to the login page. It is the ONLY way the client learns
 * its own identity: nothing about the session is readable from the cookie,
 * and nothing is kept in localStorage.
 *
 * Always 200. "Nobody is signed in" is a normal answer to this question, not
 * an error, and modelling it as one turns every first page load into a
 * console full of 401s.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { send, supabaseEnv } from '../_shared.js';
import { publicProfile, sessionFromRequest } from '../_auth.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed.' });
  }
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
