/**
 * POST /api/register — Vercel Edge function persisting Flash @ Brigade pass
 * registrations to Supabase (PostgREST, service-role key, server-side only).
 *
 * Setup: create the table with supabase/schema.sql, then set SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the Vercel project (see .env.example). The
 * service key never reaches the browser; RLS stays closed to anon clients.
 */
export const config = { runtime: 'edge' };

const VISITOR_TYPES = [
  'student',
  'parent',
  'guest',
  'alumni',
  'faculty',
  'other',
];

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

type Payload = {
  full_name: string;
  email: string;
  phone: string;
  visitor_type: string;
  number_of_passes: number;
  accessibility_requirements: string | null;
  comments: string | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Trim, collapse whitespace, strip control characters, cap length. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function validate(body: Record<string, unknown>): Payload | string {
  const full_name = cleanText(body.full_name, 120);
  if (!full_name || full_name.length < 2) return 'A full name is required.';

  const email = cleanText(body.email, 160)?.toLowerCase() ?? null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'A valid email address is required.';
  }

  const phone = cleanText(body.phone, 16)?.replace(/[\s-]/g, '') ?? null;
  if (!phone || !/^(\+?91)?[6-9]\d{9}$/.test(phone)) {
    return 'A valid 10-digit Indian mobile number is required.';
  }

  const visitor_type =
    typeof body.visitor_type === 'string' ? body.visitor_type : '';
  if (!VISITOR_TYPES.includes(visitor_type)) {
    return 'Visitor type is not recognised.';
  }

  const passes = Number(body.number_of_passes);
  if (!Number.isInteger(passes) || passes < 1 || passes > 10) {
    return 'Number of passes must be between 1 and 10.';
  }

  return {
    full_name,
    email,
    phone,
    visitor_type,
    number_of_passes: passes,
    accessibility_requirements: cleanText(body.accessibility_requirements, 500),
    comments: cleanText(body.comments, 500),
  };
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

  // Honeypot: bots fill every field; humans never see this one. Pretend
  // success so automated scripts learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json(201, { ok: true });
  }

  const payload = validate(body);
  if (typeof payload === 'string') {
    return json(422, { error: payload });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(503, {
      error:
        'The registration desk is not open yet. Please try again later or write to bfcommunication@brigadeschools.edu.in.',
    });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Guard against accidental double submissions from the same email.
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const dupeUrl =
      `${supabaseUrl}/rest/v1/registrations?select=id` +
      `&email=eq.${encodeURIComponent(payload.email)}` +
      `&created_at=gte.${encodeURIComponent(since)}&limit=1`;
    const dupeResponse = await fetch(dupeUrl, { headers });
    if (dupeResponse.ok) {
      const existing = (await dupeResponse.json()) as unknown[];
      if (existing.length > 0) {
        return json(409, {
          error:
            'We already have a very recent registration for this email address. Your passes are safe; there is no need to submit twice.',
        });
      }
    }

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/registrations`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ ...payload, status: 'received' }),
    });

    if (!insertResponse.ok) {
      return json(502, {
        error: 'The registration could not be saved. Please try again.',
      });
    }

    const rows = (await insertResponse.json()) as Array<{ id: string }>;
    return json(201, { ok: true, id: rows[0]?.id ?? null });
  } catch {
    return json(500, {
      error: 'The registration desk is unreachable right now. Please retry.',
    });
  }
}
