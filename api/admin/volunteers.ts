/**
 * /api/admin/volunteers — volunteer account management. Administrators only.
 *
 *   GET                      list accounts (never password hashes)
 *   POST { action: 'create',  full_name, email, password }
 *   POST { action: 'disable' | 'enable', id }
 *   POST { action: 'reset',   id, password }
 *   POST { action: 'promote' | 'demote', id }
 *
 * Every action that removes or changes authority also revokes that person's
 * live sessions, so "disabled" means disabled NOW rather than whenever their
 * cookie happens to expire.
 *
 * There is deliberately no delete. An account that checked people in has to
 * keep existing for the audit trail to resolve to a name; `active = false` is
 * the retirement path.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cleanText, jsonBody, send } from '../_shared.js';
import {
  hashPassword,
  normaliseEmail,
  originAllowed,
  passwordProblem,
  requireAdmin,
  revokeAllSessions,
  type AuthContext,
} from '../_auth.js';

const LIST_SELECT =
  'select=id,full_name,email,role,active,last_login,created_at,must_change_password' +
  '&order=created_at.desc';

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

function validId(value: unknown): string | null {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
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

  if (req.method === 'GET') {
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

  const id = validId(body.id);
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
