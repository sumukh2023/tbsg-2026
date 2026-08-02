/**
 * /api/admin — volunteer account management and the gate audit trail.
 * Administrators only, enforced server-side on every call.
 *
 *   GET  /api/admin/volunteers                 list accounts (never hashes)
 *   POST /api/admin/volunteers                 { action: create | disable |
 *                                                enable | reset | promote |
 *                                                demote, … }
 *   GET  /api/admin/activity?view=timeline     recent actions, newest first
 *                          ?view=totals        per-volunteer counts
 *                          ?view=logins        recent sign-in attempts
 *                          &volunteer=<uuid>&limit=<1..200>
 *
 * One function serving both resources, dispatched on `?resource=` — the paths
 * above are rewritten to it in vercel.json. They were two files until the
 * Hobby plan's twelve-function ceiling made that a deployment failure; the
 * routes and their semantics are unchanged.
 *
 * There is deliberately no delete. An account that checked people in must
 * keep existing for the audit trail to resolve to a name; `active = false` is
 * the retirement path.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cleanText, jsonBody, send } from './_shared.js';
import {
  hashPassword,
  normaliseEmail,
  originAllowed,
  passwordProblem,
  requireAdmin,
  revokeAllSessions,
  type AuthContext,
} from './_auth.js';

// `failed_attempts` and `locked_until` are included deliberately: a locked
// account answers "Invalid email or password." like any other failure, which
// is right for the login form and useless for the person trying to help. The
// dashboard is where that state should be visible.
const LIST_SELECT =
  'select=id,full_name,email,role,active,last_login,created_at,' +
  'must_change_password,failed_attempts,locked_until' +
  '&order=created_at.desc';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

async function patch(
  auth: AuthContext,
  id: string,
  fields: Record<string, unknown>
): Promise<boolean> {
  const response = await fetch(
    `${auth.env.url}/rest/v1/volunteers?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: auth.env.headers,
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    }
  );
  if (!response.ok) {
    console.error(`[admin] stage=patch supabase_status=${response.status}`);
  }
  return response.ok;
}

/** GET the account list. Password hashes are not in the projection at all. */
async function listVolunteers(
  auth: AuthContext,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store, private');
  const response = await fetch(
    `${auth.env.url}/rest/v1/volunteers?${LIST_SELECT}`,
    { headers: auth.env.headers }
  );
  if (!response.ok) {
    console.error(`[admin] stage=list supabase_status=${response.status}`);
    return send(res, 503, { error: 'Could not load accounts.' });
  }
  return send(res, 200, { volunteers: await response.json() });
}

async function manageVolunteers(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthContext
): Promise<void> {
  const body = jsonBody(req);
  if (!body) return send(res, 400, { error: 'Request body must be JSON.' });
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'create') {
    const full_name = cleanText(body.full_name, 120);
    if (!full_name || full_name.length < 2) {
      return send(res, 422, { error: 'A full name is required.' });
    }
    const email = normaliseEmail(body.email);
    if (!email) return send(res, 422, { error: 'A valid email is required.' });
    const problem = passwordProblem(body.password);
    if (problem) return send(res, 422, { error: problem });

    const response = await fetch(`${auth.env.url}/rest/v1/volunteers`, {
      method: 'POST',
      headers: { ...auth.env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        full_name,
        email,
        password_hash: await hashPassword(body.password as string),
        role: body.role === 'admin' ? 'admin' : 'volunteer',
        // The creator picks the first password; the account must replace it.
        must_change_password: true,
        created_by: auth.volunteer.id,
      }),
    });
    if (response.status === 409) {
      return send(res, 409, { error: 'An account with that email exists.' });
    }
    if (!response.ok) {
      console.error(`[admin] stage=create supabase_status=${response.status}`);
      return send(res, 503, { error: 'The account could not be created.' });
    }
    const rows = (await response.json()) as Array<{ id: string }>;
    return send(res, 201, { ok: true, id: rows[0]?.id ?? null });
  }

  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null;
  if (!id) return send(res, 422, { error: 'A valid account id is required.' });

  // An administrator locking themselves out mid-event is a real risk and a
  // needless one: nothing here may act on the caller's own account.
  if (id === auth.volunteer.id) {
    return send(res, 409, {
      error: 'Use another administrator account to change your own access.',
    });
  }

  switch (action) {
    case 'disable': {
      if (!(await patch(auth, id, { active: false }))) {
        return send(res, 503, { error: 'The account could not be updated.' });
      }
      await revokeAllSessions(auth.env, id);
      return send(res, 200, { ok: true });
    }
    case 'enable': {
      const ok = await patch(auth, id, {
        active: true,
        failed_attempts: 0,
        locked_until: null,
      });
      return ok
        ? send(res, 200, { ok: true })
        : send(res, 503, { error: 'The account could not be updated.' });
    }
    case 'reset': {
      const problem = passwordProblem(body.password);
      if (problem) return send(res, 422, { error: problem });
      const ok = await patch(auth, id, {
        password_hash: await hashPassword(body.password as string),
        must_change_password: true,
        failed_attempts: 0,
        locked_until: null,
      });
      if (!ok) return send(res, 503, { error: 'The password was not reset.' });
      // The old password is gone, so anything signed in with it goes too.
      await revokeAllSessions(auth.env, id);
      return send(res, 200, { ok: true });
    }
    case 'promote':
    case 'demote': {
      const role = action === 'promote' ? 'admin' : 'volunteer';
      if (!(await patch(auth, id, { role }))) {
        return send(res, 503, { error: 'The role could not be changed.' });
      }
      // A role is carried in the session's joined volunteer row, so it would
      // in fact update live — but re-authenticating on a privilege change is
      // the safer habit, and it makes the change auditable as a new login.
      await revokeAllSessions(auth.env, id);
      return send(res, 200, { ok: true, role });
    }
    default:
      return send(res, 400, { error: 'Unknown action.' });
  }
}

/**
 * Reads the `verification_activity` and `volunteer_checkin_totals` views,
 * both of which JOIN the volunteer's name rather than storing a copy — so a
 * corrected spelling corrects the whole history at once.
 *
 * The login view reports attempts WITHOUT any IP address: it answers "is
 * someone hammering us", which is its purpose, and not "who was where".
 */
async function readActivity(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthContext
): Promise<void> {
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
    const filter = UUID.test(volunteer)
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }
  if (req.method === 'POST' && !originAllowed(req)) {
    return send(res, 403, { error: 'Request blocked.' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const resource = one(req.query.resource) || 'volunteers';

  if (resource === 'activity') {
    if (req.method !== 'GET') {
      return send(res, 405, { error: 'Method not allowed.' });
    }
    return readActivity(req, res, auth);
  }

  if (resource !== 'volunteers') {
    return send(res, 404, { error: 'Unknown resource.' });
  }

  return req.method === 'GET'
    ? listVolunteers(auth, res)
    : manageVolunteers(req, res, auth);
}
