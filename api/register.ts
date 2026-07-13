/**
 * POST /api/register — persists a Flash @ Brigade pass registration to
 * Supabase and mints its digital pass (opaque token in the QR; only the
 * SHA-256 hash is stored). Setup: supabase/schema.sql + SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the Vercel project (see .env.example).
 *
 * Classic Vercel Node.js (req, res) signature: unambiguous on every
 * @vercel/node version, unlike web handlers.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cleanText,
  jsonBody,
  PASS_LIMITS,
  passReference,
  randomToken,
  send,
  sha256Hex,
  supabaseEnv,
} from './_shared.js';

const VISITOR_TYPES = [
  'student',
  'parent',
  'guest',
  'alumni',
  'faculty',
  'other',
];

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

  // Per-visitor-type ceilings; the client mirrors these but is never trusted.
  const limit = PASS_LIMITS[visitor_type] ?? 1;
  const passes = Number(body.number_of_passes);
  if (!Number.isInteger(passes) || passes < 1 || passes > limit) {
    return `A ${visitor_type} registration can include between 1 and ${limit} ${limit === 1 ? 'pass' : 'passes'}.`;
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
    console.error(`[register] stage=mint supabase_status=${response.status}`);
    if (response.status !== 409) break;
  }
  return null;
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

  // Honeypot: bots fill every field; humans never see this one. Pretend
  // success so automated scripts learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return send(res, 201, { ok: true });
  }

  const payload = validate(body);
  if (typeof payload === 'string') {
    return send(res, 422, { error: payload });
  }

  const env = supabaseEnv('register');
  if (!env) {
    return send(res, 503, {
      error:
        'The registration desk is not open yet. Please try again later or write to bfcommunication@brigadeschools.edu.in.',
    });
  }

  try {
    // Duplicate detection: the email or the mobile number identifying an
    // attendee may hold only one registration, ever. Checked server-side;
    // nothing about the existing record is revealed.
    const dupeUrl =
      `${env.url}/rest/v1/registrations?select=id` +
      `&or=(email.eq.${encodeURIComponent(payload.email)},phone.eq.${encodeURIComponent(payload.phone)})` +
      `&limit=1`;
    const dupeResponse = await fetch(dupeUrl, { headers: env.headers });
    if (!dupeResponse.ok) {
      console.error(
        `[register] stage=duplicate-check supabase_status=${dupeResponse.status}`
      );
      return send(res, 503, {
        error: 'The registration service is unavailable right now.',
      });
    }
    const existing = (await dupeResponse.json()) as unknown[];
    if (existing.length > 0) {
      return send(res, 409, {
        error:
          "A pass has already been issued for this attendee. Please use Retrieve your Pass if you cannot find it. If you'd like to reserve more passes, contact the Front Desk.",
      });
    }

    const insertResponse = await fetch(`${env.url}/rest/v1/registrations`, {
      method: 'POST',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({ ...payload, status: 'received' }),
    });

    if (!insertResponse.ok) {
      console.error(
        `[register] stage=insert supabase_status=${insertResponse.status}`
      );
      return send(res, 502, {
        error: 'The registration could not be saved. Please try again.',
      });
    }

    const rows = (await insertResponse.json()) as Array<{ id: string }>;
    const registrationId = rows[0]?.id ?? null;
    if (!registrationId) {
      console.error('[register] stage=insert no id returned');
      return send(res, 502, {
        error: 'The registration could not be saved. Please try again.',
      });
    }

    // Mint the digital pass. A booking without a pass is a dead record for
    // the visitor, so if minting fails the registration is rolled back and
    // the visitor is asked to retry cleanly.
    const pass = await mintPass(env, registrationId);
    if (!pass) {
      await fetch(`${env.url}/rest/v1/registrations?id=eq.${registrationId}`, {
        method: 'DELETE',
        headers: env.headers,
      }).catch(() => {
        console.error('[register] stage=cleanup rollback delete failed');
      });
      return send(res, 502, {
        error:
          'The registration could not be completed. Nothing was booked; please try again.',
      });
    }

    return send(res, 201, { ok: true, id: registrationId, pass });
  } catch (error) {
    console.error(
      `[register] stage=network error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 500, {
      error: 'The registration desk is unreachable right now. Please retry.',
    });
  }
}
