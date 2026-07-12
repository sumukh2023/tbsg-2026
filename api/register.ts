/**
 * POST /api/register — persists a Flash @ Brigade pass registration to
 * Supabase and mints its digital pass (opaque token in the QR; only the
 * SHA-256 hash is stored). Setup: supabase/schema.sql + SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the Vercel project (see .env.example).
 */
import {
  cleanText,
  json,
  passReference,
  randomToken,
  sha256Hex,
  supabaseEnv,
} from './_shared';

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

/** Mint the digital pass for a registration. Returns the raw token once. */
async function mintPass(
  env: NonNullable<ReturnType<typeof supabaseEnv>>,
  registrationId: string
): Promise<{ token: string; reference: string; issued_at: string } | null> {
  // Two attempts in the astronomically unlikely event of a collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = randomToken();
    const reference = passReference();
    const response = await fetch(`${env.url}/rest/v1/passes`, {
      method: 'POST',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        registration_id: registrationId,
        pass_reference: reference,
        verification_token_hash: await sha256Hex(token),
      }),
    });
    if (response.ok) {
      const rows = (await response.json()) as Array<{ issued_at: string }>;
      return { token, reference, issued_at: rows[0]?.issued_at ?? '' };
    }
    if (response.status !== 409) break;
  }
  return null;
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

  const env = supabaseEnv();
  if (!env) {
    return json(503, {
      error:
        'The registration desk is not open yet. Please try again later or write to bfcommunication@brigadeschools.edu.in.',
    });
  }

  try {
    // Guard against accidental double submissions from the same email.
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const dupeUrl =
      `${env.url}/rest/v1/registrations?select=id` +
      `&email=eq.${encodeURIComponent(payload.email)}` +
      `&created_at=gte.${encodeURIComponent(since)}&limit=1`;
    const dupeResponse = await fetch(dupeUrl, { headers: env.headers });
    if (dupeResponse.ok) {
      const existing = (await dupeResponse.json()) as unknown[];
      if (existing.length > 0) {
        return json(409, {
          error:
            'We already have a very recent registration for this email address. Your passes are safe; there is no need to submit twice.',
        });
      }
    }

    const insertResponse = await fetch(`${env.url}/rest/v1/registrations`, {
      method: 'POST',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({ ...payload, status: 'received' }),
    });

    if (!insertResponse.ok) {
      return json(502, {
        error: 'The registration could not be saved. Please try again.',
      });
    }

    const rows = (await insertResponse.json()) as Array<{ id: string }>;
    const registrationId = rows[0]?.id ?? null;

    // Mint the digital pass. If this fails the registration still stands;
    // the visitor can retrieve a pass later via /pass.
    const pass = registrationId ? await mintPass(env, registrationId) : null;

    return json(201, { ok: true, id: registrationId, pass });
  } catch {
    return json(500, {
      error: 'The registration desk is unreachable right now. Please retry.',
    });
  }
}
