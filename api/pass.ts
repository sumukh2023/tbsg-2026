/**
 * GET /api/pass?token=… — the holder's own pass presentation. The token is
 * the unguessable secret from the registration response; possession of it
 * is what authorises this read. Returns only what the pass itself shows.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findPassByToken, send, supabaseEnv } from './_shared';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const raw = req.query.token;
  const token = typeof raw === 'string' ? raw : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return send(res, 422, { error: 'That pass link is not valid.' });
  }

  const env = supabaseEnv('pass');
  if (!env) {
    return send(res, 503, { error: 'The pass service is not configured yet.' });
  }

  try {
    const pass = await findPassByToken(env, token);
    if (!pass) {
      return send(res, 404, { error: 'No pass matches this link.' });
    }
    return send(res, 200, {
      pass: {
        reference: pass.pass_reference,
        status: pass.status,
        issued_at: pass.issued_at,
        checked_in_at: pass.checked_in_at,
        guest: {
          name: pass.registrations?.full_name ?? '',
          visitor_type: pass.registrations?.visitor_type ?? '',
          number_of_passes: pass.registrations?.number_of_passes ?? 1,
        },
      },
    });
  } catch (error) {
    console.error(
      `[pass] stage=lookup error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 500, {
      error: 'The pass service is unreachable right now.',
    });
  }
}
