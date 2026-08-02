/**
 * GET /api/admin/activity — the gate audit trail. Administrators only.
 *
 *   ?view=timeline          recent actions, newest first (default)
 *   ?view=totals            per-volunteer check-in and undo counts
 *   ?view=logins            recent sign-in attempts
 *   &volunteer=<uuid>       restrict the timeline to one person
 *   &limit=<1..200>
 *
 * Reads the `verification_activity` and `volunteer_checkin_totals` views from
 * the migration, both of which JOIN the volunteer's name rather than storing
 * a copy — so a corrected spelling corrects the whole history at once.
 *
 * The login view reports attempts WITHOUT the email of accounts that do not
 * exist and without any IP address: it answers "is someone hammering us",
 * which is its purpose, and not "which addresses did they guess".
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { send } from '../_shared.js';
import { requireAdmin } from '../_auth.js';

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;
  res.setHeader('Cache-Control', 'no-store, private');

  const view = one(req.query.view) || 'timeline';
  const limitRaw = Number(one(req.query.limit));
  const limit = Number.isInteger(limitRaw)
    ? Math.min(200, Math.max(1, limitRaw))
    : 50;

  let path: string;
  if (view === 'totals') {
    path = 'volunteer_checkin_totals?select=*&order=checkins.desc';
  } else if (view === 'logins') {
    path =
      'volunteer_login_attempts?select=created_at,successful,reason,volunteer_id' +
      `&order=created_at.desc&limit=${limit}`;
  } else {
    const volunteer = one(req.query.volunteer);
    const filter =
      volunteer &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        volunteer
      )
        ? `&volunteer_id=eq.${volunteer}`
        : '';
    path = `verification_activity?select=*&order=created_at.desc&limit=${limit}${filter}`;
  }

  const response = await fetch(`${auth.env.url}/rest/v1/${path}`, {
    headers: auth.env.headers,
  });
  if (!response.ok) {
    console.error(`[admin] stage=activity supabase_status=${response.status}`);
    return send(res, 503, { error: 'Could not load activity.' });
  }
  return send(res, 200, { view, rows: await response.json() });
}
