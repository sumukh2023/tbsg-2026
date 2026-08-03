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
  CLASSES,
  cleanText,
  jsonBody,
  PASS_LIMITS,
  passReference,
  randomToken,
  ROLL_REQUIRED,
  SECTIONS,
  send,
  sha256Hex,
  supabaseEnv,
  VISITOR_DETAILS,
  VISITOR_TYPES,
  type VisitorType,
} from './_shared.js';

type Payload = {
  full_name: string;
  email: string;
  phone: string;
  visitor_type: VisitorType;
  number_of_passes: number;
  student_name: string | null;
  usn: string | null;
  class: string | null;
  section: string | null;
  visitor_detail: string | null;
  organisation: string | null;
  terms_accepted: true;
  terms_accepted_at: string;
  booking_email_opt_in: boolean;
  marketing_email_opt_in: boolean;
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

  const visitor_type = (
    typeof body.visitor_type === 'string' ? body.visitor_type : ''
  ) as VisitorType;
  if (!VISITOR_TYPES.includes(visitor_type)) {
    return 'Visitor type is not recognised.';
  }

  // Tiered ceilings; the client mirrors these but is never trusted.
  const limit = PASS_LIMITS[visitor_type];
  const passes = Number(body.number_of_passes);
  if (!Number.isInteger(passes) || passes < 1) {
    return 'A registration must include at least one pass.';
  }
  if (passes > limit) {
    return visitor_type === 'other'
      ? `A maximum of ${limit} tickets may be reserved in a single booking.`
      : `A ${visitor_type} registration can include ${limit} ${limit === 1 ? 'pass' : 'passes'}.`;
  }

  // School roll. Students give their own details; parents give their child's.
  // Refused for anyone else, so a stray client cannot attach a roll to a
  // record that has no business carrying one.
  let student_name: string | null = null;
  let usn: string | null = null;
  let className: string | null = null;
  let section: string | null = null;
  let visitor_detail: string | null = null;
  let organisation: string | null = null;

  if (ROLL_REQUIRED.includes(visitor_type)) {
    if (visitor_type === 'parent') {
      student_name = cleanText(body.student_name, 120);
      if (!student_name || student_name.length < 2) {
        return "The student's name is required.";
      }
    }
    // A-Z and 0-9 only. The form corrects as you type, but the form is not
    // the authority: normalise here too so a crafted request cannot store a
    // USN in a shape nothing else on the site expects to read.
    usn = cleanText(body.usn, 20)?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? null;
    if (!usn) return 'A USN is required.';
    className = cleanText(body.class, 20);
    if (
      !className ||
      !CLASSES.includes(className as (typeof CLASSES)[number])
    ) {
      return 'Choose the class the student is in.';
    }
    section = cleanText(body.section, 2);
    if (!section || !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
      return "Choose the student's section.";
    }
  } else {
    visitor_detail = cleanText(body.visitor_detail, 20);
    if (
      !visitor_detail ||
      !VISITOR_DETAILS.includes(
        visitor_detail as (typeof VISITOR_DETAILS)[number]
      )
    ) {
      return 'Choose the option that describes you best.';
    }
    // Optional throughout: plenty of visitors represent nobody but themselves.
    organisation = cleanText(body.organisation, 160);
  }

  // Consent is a precondition, not a field: without it there is no booking
  // to make. The timestamp is taken HERE, server-side, so what is stored is
  // when the registration was accepted rather than whatever a client claimed.
  if (body.terms_accepted !== true) {
    return 'The Terms of Service and Privacy Policy must be accepted.';
  }

  return {
    full_name,
    email,
    phone,
    visitor_type,
    number_of_passes: passes,
    student_name,
    usn,
    class: className,
    section,
    visitor_detail,
    organisation,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    // Absent means not asked for. Only an explicit true opts in, and only an
    // explicit false opts out of the operational mail that defaults on.
    booking_email_opt_in: body.booking_email_opt_in !== false,
    marketing_email_opt_in: body.marketing_email_opt_in === true,
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
