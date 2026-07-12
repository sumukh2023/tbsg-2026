/**
 * POST /api/verify — event-day verification and check-in, used by the
 * /verify-pass/<token> volunteer interface.
 *
 * Body: { token, action: 'verify' | 'checkin', access_code, operator? }
 *
 * Requires VERIFIER_ACCESS_CODE (a shared event-day code handed to gate
 * volunteers; server-side env, never bundled into the client). Validity is
 * decided exclusively here against the database: the client only renders
 * what this endpoint returns. Duplicate check-ins are prevented with a
 * conditional update (status must still be 'valid' at write time).
 */
import { findPassByToken, json, supabaseEnv, cleanText } from './_shared';

export const config = { runtime: 'edge' };

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length === bb.length ? 0 : 1;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
  }
  return diff === 0;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Request body must be JSON.' });
  }

  const accessCode = process.env.VERIFIER_ACCESS_CODE;
  if (!accessCode) {
    return json(503, { error: 'Verification is not configured yet.' });
  }
  const provided = typeof body.access_code === 'string' ? body.access_code : '';
  if (!provided || !timingSafeEqual(provided, accessCode)) {
    return json(401, { error: 'Wrong access code.' });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return json(200, { result: 'invalid' });
  }
  const action = body.action === 'checkin' ? 'checkin' : 'verify';

  const env = supabaseEnv();
  if (!env) {
    return json(503, { error: 'Verification is not configured yet.' });
  }

  try {
    const pass = await findPassByToken(env, token);
    if (!pass) {
      return json(200, { result: 'invalid' });
    }

    const presentation = {
      reference: pass.pass_reference,
      guest: {
        name: pass.registrations?.full_name ?? '',
        visitor_type: pass.registrations?.visitor_type ?? '',
        number_of_passes: pass.registrations?.number_of_passes ?? 1,
      },
      checked_in_at: pass.checked_in_at,
      checked_in_by: pass.checked_in_by,
    };

    if (action === 'verify') {
      const result =
        pass.status === 'valid'
          ? 'valid'
          : pass.status === 'checked_in'
            ? 'already_checked_in'
            : 'cancelled';
      return json(200, { result, pass: presentation });
    }

    // Check-in: conditional update so a pass can only move valid -> checked_in
    // exactly once, no matter how many volunteers scan it simultaneously.
    const operator = cleanText(body.operator, 60) ?? 'gate volunteer';
    const updateUrl =
      `${env.url}/rest/v1/passes?id=eq.${pass.id}&status=eq.valid`;
    const update = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: operator,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!update.ok) throw new Error('check-in failed');
    const updated = (await update.json()) as Array<{ checked_in_at: string }>;

    if (updated.length === 0) {
      // Someone got there first, or the pass was cancelled meanwhile.
      const fresh = await findPassByToken(env, token);
      const result =
        fresh?.status === 'checked_in' ? 'already_checked_in' : 'cancelled';
      return json(200, {
        result,
        pass: {
          ...presentation,
          checked_in_at: fresh?.checked_in_at ?? null,
          checked_in_by: fresh?.checked_in_by ?? null,
        },
      });
    }

    return json(200, {
      result: 'checked_in',
      pass: { ...presentation, checked_in_at: updated[0].checked_in_at },
    });
  } catch {
    // Network/database failure must never read as "invalid pass".
    return json(502, { error: 'Unable to verify: network unavailable.' });
  }
}
