/**
 * GET /api/pass?token=… — the holder's own pass presentation. The token is
 * the unguessable secret from the registration response; possession of it
 * is what authorises this read. Returns only what the pass itself shows.
 */
import { findPassByToken, json, supabaseEnv } from './_shared';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return json(422, { error: 'That pass link is not valid.' });
  }

  const env = supabaseEnv();
  if (!env) {
    return json(503, { error: 'The pass service is not configured yet.' });
  }

  try {
    const pass = await findPassByToken(env, token);
    if (!pass) {
      return json(404, { error: 'No pass matches this link.' });
    }
    return json(200, {
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
  } catch {
    return json(500, { error: 'The pass service is unreachable right now.' });
  }
}
