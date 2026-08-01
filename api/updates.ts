/**
 * GET /api/updates — published live updates, newest first. Fallback path
 * for clients without VITE_SUPABASE_* configured (those read Supabase
 * directly with the anon key + RLS and subscribe to Realtime instead).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { send, supabaseEnv } from './_shared.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const env = supabaseEnv('updates');
  if (!env) {
    return send(res, 503, { error: 'Updates are not configured yet.' });
  }

  try {
    const url =
      `${env.url}/rest/v1/updates` +
      `?select=id,title,message,category,priority,cta_label,cta_url,published_at,created_at` +
      `&published=eq.true&order=published_at.desc.nullslast&limit=50`;
    const response = await fetch(url, { headers: env.headers });
    if (!response.ok) {
      console.error(
        `[updates] stage=select supabase_status=${response.status}`
      );
      throw new Error('updates lookup failed');
    }
    const updates = await response.json();
    return send(res, 200, { updates });
  } catch {
    return send(res, 500, { error: 'Updates are unreachable right now.' });
  }
}
