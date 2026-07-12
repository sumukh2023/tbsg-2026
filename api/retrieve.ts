/**
 * POST /api/retrieve — pass retrieval for visitors who lost the success
 * page. Requires the exact email AND mobile number used to register; the
 * response is deliberately identical for "no match" and "bad details" so
 * registrations cannot be enumerated.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cleanText,
  jsonBody,
  randomToken,
  send,
  sha256Hex,
  supabaseEnv,
} from './_shared';

const GENERIC =
  'If those details match a registration, the pass is shown here. Please check them and try again.';

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

  const email = cleanText(body.email, 160)?.toLowerCase() ?? null;
  const phone = cleanText(body.phone, 16)?.replace(/[\s-]/g, '') ?? null;
  if (!email || !phone) {
    return send(res, 404, { error: GENERIC });
  }

  const env = supabaseEnv('retrieve');
  if (!env) {
    return send(res, 503, { error: 'The pass service is not configured yet.' });
  }

  try {
    const regUrl =
      `${env.url}/rest/v1/registrations?select=id` +
      `&email=eq.${encodeURIComponent(email)}` +
      `&phone=eq.${encodeURIComponent(phone)}` +
      `&order=created_at.desc&limit=1`;
    const regResponse = await fetch(regUrl, { headers: env.headers });
    if (!regResponse.ok) throw new Error('lookup failed');
    const regs = (await regResponse.json()) as Array<{ id: string }>;
    if (!regs.length) return send(res, 404, { error: GENERIC });

    const passUrl =
      `${env.url}/rest/v1/passes?select=id,status` +
      `&registration_id=eq.${regs[0].id}&order=created_at.desc&limit=1`;
    const passResponse = await fetch(passUrl, { headers: env.headers });
    if (!passResponse.ok) throw new Error('lookup failed');
    const passes = (await passResponse.json()) as Array<{
      id: string;
      status: string;
    }>;
    if (!passes.length) return send(res, 404, { error: GENERIC });

    // Rotate the token on retrieval: the old link stops working and the
    // visitor gets a fresh, unguessable one.
    const token = randomToken();
    const rotate = await fetch(
      `${env.url}/rest/v1/passes?id=eq.${passes[0].id}`,
      {
        method: 'PATCH',
        headers: env.headers,
        body: JSON.stringify({
          verification_token_hash: await sha256Hex(token),
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!rotate.ok) throw new Error('rotation failed');

    return send(res, 200, { token });
  } catch (error) {
    console.error(
      `[retrieve] stage=lookup error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 500, {
      error: 'The pass service is unreachable right now.',
    });
  }
}
