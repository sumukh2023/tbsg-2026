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
  bookingReference,
  priceBooking,
  randomToken,
  SECTIONS,
  send,
  sha256Hex,
  supabaseEnv,
  VISITOR_DETAILS,
  VISITOR_TYPES,
  type VisitorType,
} from './_shared.js';

/**
 * One attendee, and therefore one pass.
 *
 * The ROLL DETAILS ARE PER ATTENDEE, not per booking. A parent booking two
 * passes is booking for two different children, and the old shape — one USN
 * on the registration — could only ever describe one of them. Storing them
 * here is what lets the gate read the right child off the right pass.
 */
export type Attendee = {
  attendee_name: string;
  attendee_category: VisitorType;
  student_name: string | null;
  usn: string | null;
  class: string | null;
  section: string | null;
  sequence: number;
};

type Payload = {
  full_name: string;
  email: string;
  phone: string;
  visitor_type: VisitorType;
  number_of_passes: number;
  booking_reference: string;
  subtotal: number;
  convenience_fee: number;
  total_amount: number;
  /** Stripped before the row is written: these become `passes`, not columns. */
  attendees: Attendee[];
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

  /* THE ROLL SITS IN DIFFERENT PLACES FOR THE TWO SCHOOL CATEGORIES, and
     that is not an inconsistency. A student booking is a list of students, so
     each attendee carries their own USN and is validated per attendee below.
     A PARENT booking is one child's parents: the brief's parent form asks
     only for names, and the repository ties the booking to a pupil, so the
     child is named once here and copied onto each parent's pass. */
  if (visitor_type === 'parent') {
    student_name = cleanText(body.student_name, 120);
    if (!student_name || student_name.length < 2) {
      return "The student's name is required.";
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
  } else if (visitor_type === 'other') {
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

  // The attendees, one per ticket. Validated here so a booking is either
  // fully described or refused; a half-named booking is passes nobody owns.
  const attendees = validateAttendees(body, visitor_type, passes);
  if (typeof attendees === 'string') return attendees;

  /* A parent's pass carries the child the booking is for; a student's pass
     already carries their own, set per attendee above. The `?? ` is what
     covers the compatibility path: an old client sends no attendee list, so
     the synthesised attendees have no roll and inherit the booking's. */
  for (const attendee of attendees) {
    attendee.student_name = attendee.student_name ?? student_name;
    attendee.usn = attendee.usn ?? usn;
    attendee.class = attendee.class ?? className;
    attendee.section = attendee.section ?? section;
  }

  return {
    full_name,
    email,
    phone,
    visitor_type,
    number_of_passes: passes,
    booking_reference: bookingReference(),
    // PRICED HERE, never read from the body. A client that posts its own
    // total is describing what it would like to pay.
    ...priceBooking(visitor_type, passes),
    attendees,
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

/**
 * The people this booking is for, one per ticket.
 *
 * Every attendee is named. The purchaser gives an address and a number once;
 * the names are what turn a count into a list of passes, and a pass with
 * nobody's name on it cannot be checked in against anybody.
 */
function validateAttendees(
  body: Record<string, unknown>,
  type: VisitorType,
  tickets: number
): Attendee[] | string {
  const raw = body.attendees;

  /* NO ATTENDEE LIST: a client from before the booking form asked for names.
   *
   * This is the compatibility path, and it exists because the two halves of
   * this change deploy at different moments. A browser holding the previous
   * bundle posts a purchaser and a count and nothing else; refusing it would
   * turn a cached tab into a broken booking form for as long as the cache
   * lives. So the booking is described the way the migration describes the
   * bookings that predate this column: every pass takes the purchaser's name.
   *
   * It produces the right NUMBER of passes with the right owner and the
   * wrong names, which is strictly better than the single shared QR code it
   * replaces, and it self-corrects the moment the new form ships. Delete
   * this branch once the form is out and no cached bundle can reach it.
   */
  if (raw === undefined || raw === null) {
    const purchaser = cleanText(body.full_name, 120) ?? 'Guest';
    return Array.from({ length: tickets }, (_, i) => ({
      attendee_name: purchaser,
      attendee_category: type,
      student_name: null,
      usn: null,
      class: null,
      section: null,
      sequence: i + 1,
    }));
  }

  if (!Array.isArray(raw) || raw.length !== tickets) {
    return `Please give a name for each of the ${tickets} ${tickets === 1 ? 'ticket' : 'tickets'}.`;
  }

  const out: Attendee[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = (raw[i] ?? {}) as Record<string, unknown>;
    const position = i + 1;

    const attendee_name = cleanText(entry.attendee_name, 120);
    if (!attendee_name || attendee_name.length < 2) {
      return `Please enter a name for attendee ${position}.`;
    }

    let student_name: string | null = null;
    let usn: string | null = null;
    let className: string | null = null;
    let section: string | null = null;

    /* PER ATTENDEE, FOR STUDENTS. Three student tickets are three different
       pupils, and a single USN on the booking could only ever have described
       one of them. A parent's pass takes the child's roll from the booking
       instead: see the note in `validate`. */
    if (type === 'student') {
      student_name = attendee_name;
      usn =
        cleanText(entry.usn, 20)?.toUpperCase().replace(/[^A-Z0-9]/g, '') ??
        null;
      if (!usn) return `A USN is required for student ${position}.`;
      className = cleanText(entry.class, 20);
      if (!className || !CLASSES.includes(className as (typeof CLASSES)[number])) {
        return `Choose the class for student ${position}.`;
      }
      section = cleanText(entry.section, 2);
      if (!section || !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
        return `Choose the section for student ${position}.`;
      }
    }

    out.push({
      attendee_name,
      attendee_category: type,
      student_name,
      usn,
      class: className,
      section,
      sequence: position,
    });
  }

  // Two passes for the same USN in one booking is a duplicated row, not two
  // children. The gate would have two ways to admit one student.
  const rolls = out.map((a) => a.usn).filter(Boolean);
  if (new Set(rolls).size !== rolls.length) {
    return 'Each attendee needs their own USN. One is repeated.';
  }
  return out;
}

/**
 * Mint one pass PER ATTENDEE, in a single insert.
 *
 * One request, not one per attendee: ten attendees used to mean ten round
 * trips to PostgREST from a serverless function, and a failure half way
 * through left a booking holding four passes out of ten. Inserting the array
 * makes it one statement, so it either all lands or none of it does.
 *
 * The raw tokens are returned here and never again. Only their SHA-256 is
 * stored, so this is the single moment they exist in a form anyone can use.
 */
async function mintPasses(
  env: NonNullable<ReturnType<typeof supabaseEnv>>,
  registrationId: string,
  attendees: Attendee[]
): Promise<MintedPass[] | null> {
  // Two attempts, in the astronomically unlikely event of a reference
  // collision. A retry re-rolls every reference in the batch.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const minted = await Promise.all(
      attendees.map(async (attendee) => {
        const token = randomToken();
        const reference = passReference();
        return {
          token,
          reference,
          attendee,
          row: {
            registration_id: registrationId,
            pass_reference: reference,
            verification_token_hash: await sha256Hex(token),
            ...attendee,
          },
        };
      })
    );

    const response = await fetch(`${env.url}/rest/v1/passes`, {
      method: 'POST',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify(minted.map((m) => m.row)),
    });

    if (response.ok) {
      const rows = (await response.json()) as Array<{
        pass_reference: string;
        issued_at: string;
      }>;
      const issuedAt = new Map(rows.map((r) => [r.pass_reference, r.issued_at]));
      return minted.map((m) => ({
        token: m.token,
        reference: m.reference,
        issued_at: issuedAt.get(m.reference) ?? '',
        attendee_name: m.attendee.attendee_name,
        attendee_category: m.attendee.attendee_category,
        sequence: m.attendee.sequence,
      }));
    }
    console.error(`[register] stage=mint supabase_status=${response.status}`);
    if (response.status !== 409) break;
  }
  return null;
}

export type MintedPass = {
  token: string;
  reference: string;
  issued_at: string;
  attendee_name: string;
  attendee_category: VisitorType;
  sequence: number;
};

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

    // `attendees` is not a column: it is the list that becomes the passes.
    // PostgREST rejects the whole insert on an unknown key, so it is peeled
    // off here rather than left to fail the booking at the database.
    const { attendees: _attendees, ...bookingRow } = payload;
    const insertResponse = await fetch(`${env.url}/rest/v1/registrations`, {
      method: 'POST',
      headers: { ...env.headers, Prefer: 'return=representation' },
      body: JSON.stringify({ ...bookingRow, status: 'received' }),
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

    // Mint one pass PER ATTENDEE. A booking without its passes is a dead
    // record for the visitor, so if minting fails the booking is rolled back
    // and the visitor is asked to retry cleanly. All or nothing: a booking
    // holding four passes out of ten is worse than one holding none.
    const passes = await mintPasses(env, registrationId, payload.attendees);
    if (!passes) {
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

    return send(res, 201, {
      ok: true,
      id: registrationId,
      booking_reference: payload.booking_reference,
      pricing: {
        subtotal: payload.subtotal,
        convenience_fee: payload.convenience_fee,
        total_amount: payload.total_amount,
      },
      passes,
      // The first pass, under the name the old client reads. Kept so a
      // browser holding a cached bundle mid-deploy still shows a pass rather
      // than an error; remove once nothing requests the old shape.
      pass: passes[0],
    });
  } catch (error) {
    console.error(
      `[register] stage=network error=${error instanceof Error ? error.name : 'unknown'}`
    );
    return send(res, 500, {
      error: 'The registration desk is unreachable right now. Please retry.',
    });
  }
}
