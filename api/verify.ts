/**
 * POST /api/verify — event-day verification and check-in, used by the
 * /verify-pass/<token> volunteer interface.
 *
 * Body: { token, action: 'verify' | 'checkin', access_code, operator? }
 *
 * Classic Vercel Node.js (req, res) signature; env vars are read
 * dynamically at request time. Everything used here (fetch, WebCrypto,
 * TextEncoder) is global in Node 18+.
 *
 * Status semantics:
 *   200 valid / checked_in     · 401 wrong access code
 *   404 unknown token          · 409 already checked in
 *   410 cancelled              · 400 malformed request
 *   503 configuration/database unavailable · 500 unexpected failure
 *
 * Validity is decided exclusively here against the database. Duplicate
 * check-ins are prevented with a conditional update (status must still
 * be 'valid' at write time). Requires VERIFIER_ACCESS_CODE (shared
 * event-day code handed to gate volunteers; server-side env only).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cleanText,
  findPassByToken,
  jsonBody,
  send,
  supabaseEnv,
  type PassRow,
} from './_shared.js';

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

function presentationOf(pass: PassRow) {
  return {
    reference: pass.pass_reference,
    guest: {
      name: pass.registrations?.full_name ?? '',
      visitor_type: pass.registrations?.visitor_type ?? '',
      number_of_passes: pass.registrations?.number_of_passes ?? 1,
    },
    checked_in_at: pass.checked_in_at,
    checked_in_by: pass.checked_in_by,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const body = jsonBody(req);
  if (!body) {
    return send(res, 400, { error: 'Request body must be JSON.' });
  }

  const accessCode = process.env.VERIFIER_ACCESS_CODE?.trim();
  if (!accessCode) {
    console.error(
      '[verify] Missing required environment variable: VERIFIER_ACCESS_CODE'
    );
    return send(res, 503, { error: 'Verification service unavailable.' });
  }
  const provided =
    typeof body.access_code === 'string' ? body.access_code.trim() : '';
  if (!provided || !timingSafeEqual(provided, accessCode)) {
    return send(res, 401, { error: 'Access code incorrect.' });
  }

  const env = supabaseEnv('verify');
  if (!env) {
    return send(res, 503, { error: 'Verification service unavailable.' });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return send(res, 404, { result: 'invalid', error: 'Pass not found.' });
  }
  const action = body.action === 'checkin' ? 'checkin' : 'verify';

  try {
    const pass = await findPassByToken(env, token);
    if (!pass) {
      return send(res, 404, { result: 'invalid', error: 'Pass not found.' });
    }

    const presentation = presentationOf(pass);

    if (action === 'verify') {
      if (pass.status === 'valid') {
        return send(res, 200, { result: 'valid', pass: presentation });
      }
      if (pass.status === 'checked_in') {
        return send(res, 409, {
          result: 'already_checked_in',
          pass: presentation,
        });
      }
      return send(res, 410, { result: 'cancelled', pass: presentation });
    }

    // Check-in: conditional update so a pass moves valid -> checked_in
    // exactly once, no matter how many volunteers scan simultaneously.
    const operator = cleanText(body.operator, 60) ?? 'gate volunteer';
    const updateUrl = `${env.url}/rest/v1/passes?id=eq.${pass.id}&status=eq.valid`;
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
    if (!update.ok) {
      console.error(`[verify] stage=checkin supabase_status=${update.status}`);
      return send(res, 503, { error: 'Verification service unavailable.' });
    }
    const updated = (await update.json()) as Array<{ checked_in_at: string }>;

    if (updated.length === 0) {
      // Someone got there first, or the pass was cancelled meanwhile.
      const fresh = await findPassByToken(env, token);
      const freshPresentation = {
        ...presentation,
        checked_in_at: fresh?.checked_in_at ?? null,
        checked_in_by: fresh?.checked_in_by ?? null,
      };
      if (fresh?.status === 'checked_in') {
        return send(res, 409, {
          result: 'already_checked_in',
          pass: freshPresentation,
        });
      }
      return send(res, 410, { result: 'cancelled', pass: freshPresentation });
    }

    return send(res, 200, {
      result: 'checked_in',
      pass: { ...presentation, checked_in_at: updated[0].checked_in_at },
    });
  } catch (error) {
    // Dependency failure (Supabase unreachable, lookup threw). Never let
    // this read as an invalid pass.
    console.error(
      `[verify] stage=lookup error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 503, { error: 'Verification service unavailable.' });
  }
}
