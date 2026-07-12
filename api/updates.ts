/**
 * GET /api/updates — published live updates, newest first. Fallback path
 * for clients without VITE_SUPABASE_* configured (those read Supabase
 * directly with the anon key + RLS and subscribe to Realtime instead).
 */
import { json, supabaseEnv } from './_shared';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  const env = supabaseEnv();
  if (!env) {
    return json(503, { error: 'Updates are not configured yet.' });
  }

  try {
    const url =
      `${env.url}/rest/v1/updates` +
      `?select=id,title,message,category,priority,cta_label,cta_url,published_at` +
      `&published=eq.true&order=published_at.desc&limit=50`;
    const response = await fetch(url, { headers: env.headers });
    if (!response.ok) throw new Error('updates lookup failed');
    const updates = await response.json();
    return json(200, { updates });
  } catch {
    return json(500, { error: 'Updates are unreachable right now.' });
  }
}
