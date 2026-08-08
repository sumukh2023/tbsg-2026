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
  normalisePromo,
  previewPromo,
  PROMO_MESSAGES,
  releasePromo,
  reservePromo,
} from './_promo.js';
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
/**
 * The one refusal that is a 400 rather than a 422.
 *
 * 422 says "what you sent is the right shape but wrong"; this says the shape
 * itself is out of date, which is a different conversation and worth being
 * able to spot in a log.
 */
export const MISSING_ATTENDEES =
  'At least one attendee is required. Send an `attendees` array with a name for each ticket.';

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
  /* Filled in by the handler AFTER the database has reserved a use, never by
     `validate`: the discount is not a property of the request. */
  promo_code: string | null;
  discount_amount: number;
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

  /* AND BACK UP AGAIN, FOR STUDENTS. This is what was broken.
     `registrations` carries a check constraint that a student booking has a
     USN, a class and a section on the BOOKING row. When the roll moved onto
     the attendees, this function stopped filling those columns for students
     and started posting nulls, so Postgres refused every student booking and
     the visitor got "The registration could not be saved" with nothing on
     the form to correct. The stub the end-to-end suite runs against has no
     constraints, so nothing caught it.

     The roll is genuinely the attendee's now, so the booking's copy is
     derived from them rather than asked for twice, and only when they agree
     on it. Today they always do: PASS_LIMITS.student is 1, so a student
     booking has exactly one attendee and the copy is exact rather than a
     summary. If that limit ever rises and a booking holds two different
     pupils, there is no single roll to put on the booking and the columns
     stay null, which the accompanying migration makes legal. */
  if (visitor_type === 'student') {
    const [first] = attendees;
    const agreed = attendees.every(
      (a) =>
        a.usn === first.usn &&
        a.class === first.class &&
        a.section === first.section
    );
    if (agreed) {
      student_name = first.student_name;
      usn = first.usn;
      className = first.class;
      section = first.section;
    }
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
    /* UNDISCOUNTED AT THIS POINT, on purpose. A promo code is not validated
       here because validating it means CONSUMING one of its uses, and this
       function runs before anything is certain to be written. The handler
       reserves the code and re-prices below. */
    promo_code: null,
    discount_amount: 0,
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

  /* THE ATTENDEE LIST IS REQUIRED. The compatibility branch that used to
     stand here synthesised one attendee per ticket under the purchaser's
     name, so that a browser holding the previous bundle mid-deploy still
     booked. The new form has shipped; a request without names is now a
     client that should be updated, not one to guess for. Guessing would
     issue passes in the wrong person's name and nobody would find out until
     a gate. */
  if (raw === undefined || raw === null) {
    return MISSING_ATTENDEES;
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

/**
 * Has this person booked before under different details?
 *
 * MULTIPLE BOOKINGS ARE FINE. What is not fine is one person arriving as two:
 * a parent who books in August on one mobile number and again in October on
 * another has two records that nothing joins up, and retrieval only ever
 * finds one of them, because it matches on the email AND the number together.
 * They would be told, truthfully and uselessly, that their other passes do
 * not exist.
 *
 * So an email address and a mobile number are ONE identity. Either may be
 * used to find the history, and if the other disagrees with what is on file
 * the booking is refused with an explanation rather than quietly filed under
 * a second identity.
 *
 * Returns the sentence to refuse with and the field to put it on, or null
 * when the details are consistent, which includes never having booked.
 */
async function conflictingIdentity(
  env: { url: string; headers: Record<string, string> },
  email: string,
  phone: string
): Promise<{ error: string; field: 'email' | 'phone' } | null> {
  /* ONE QUERY, matching EITHER identifier. Two would be two round trips on
     the hot path of a booking, and the answer needs both sides anyway: it is
     the disagreement between them that matters. */
  const url =
    `${env.url}/rest/v1/registrations?select=email,phone` +
    `&or=(email.eq.${encodeURIComponent(email)},phone.eq.${encodeURIComponent(phone)})` +
    `&limit=50`;
  let rows: Array<{ email: string; phone: string }> = [];
  try {
    const response = await fetch(url, { headers: env.headers });
    if (!response.ok) throw new Error(String(response.status));
    rows = (await response.json()) as typeof rows;
  } catch {
    /* A LOOKUP FAILURE MUST NOT BLOCK A BOOKING. This check keeps one
       person's records together, which is a tidiness guarantee; refusing a
       real booking because a read timed out would trade a tidy database for
       a lost visitor. Logged, then waved through. */
    console.error('[register] stage=identity lookup failed, allowing booking');
    return null;
  }

  const knownEmail = rows.find((r) => r.email === email);
  if (knownEmail && knownEmail.phone !== phone) {
    return {
      field: 'phone',
      error:
        'You have booked with us before using this email address, but with a different mobile number. Please enter the number from your earlier booking so every pass stays together. If your number has changed, write to bfcommunication@brigadeschools.edu.in and we will update it.',
    };
  }

  const knownPhone = rows.find((r) => r.phone === phone);
  if (knownPhone && knownPhone.email !== email) {
    return {
      field: 'email',
      error:
        'You have booked with us before using this mobile number, but with a different email address. Please enter the address from your earlier booking so every pass stays together. If your address has changed, write to bfcommunication@brigadeschools.edu.in and we will update it.',
    };
  }

  return null;
}

/**
 * POST /api/register?action=promo — what a code would be worth.
 *
 * Answers with the DISCOUNT ONLY, never with a total. The browser shows the
 * arithmetic it is given, but the arithmetic that ends up on the booking is
 * done again from scratch when the booking is submitted, against a code
 * reserved at that moment. This endpoint is a courtesy, not a contract: a
 * visitor who applies a code and takes ten minutes over the last step can
 * still find it claimed, and being told so at the moment they book is
 * correct.
 *
 * The subtotal is computed HERE from the category and the count, not read
 * from the body, so a request claiming a subtotal of a million cannot be
 * quoted a discount of a hundred thousand.
 */
async function promoPreview(
  res: VercelResponse,
  body: Record<string, unknown>
): Promise<void> {
  const code = normalisePromo(body.promo_code);
  if (!code) {
    return send(res, 422, { error: PROMO_MESSAGES.missing, reason: 'missing' });
  }

  const visitor_type = (
    typeof body.visitor_type === 'string' ? body.visitor_type : ''
  ) as VisitorType;
  if (!VISITOR_TYPES.includes(visitor_type)) {
    return send(res, 422, { error: 'Choose a visitor type first.' });
  }
  const tickets = Number(body.number_of_passes);
  if (!Number.isInteger(tickets) || tickets < 1 || tickets > PASS_LIMITS[visitor_type]) {
    return send(res, 422, { error: 'Choose how many tickets first.' });
  }

  const env = supabaseEnv('promo');
  if (!env) {
    return send(res, 503, { error: PROMO_MESSAGES.unavailable });
  }

  const priced = priceBooking(visitor_type, tickets);
  const outcome = await previewPromo(env, code, visitor_type, priced.subtotal);
  if (!outcome.ok) {
    return send(res, 422, {
      error: PROMO_MESSAGES[outcome.reason],
      reason: outcome.reason,
      code,
    });
  }

  return send(res, 200, {
    ok: true,
    code: outcome.code,
    discount_type: outcome.discount_type,
    discount_value: outcome.discount_value,
    // Everything the summary needs, and nothing about the promotion's
    // configuration beyond what this booking is worth.
    subtotal: priced.subtotal,
    discount_amount: outcome.discount_amount,
    discounted_subtotal: priced.subtotal - outcome.discount_amount,
    convenience_fee: priced.convenience_fee,
    total_amount:
      priced.subtotal - outcome.discount_amount + priced.convenience_fee,
  });
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

  /* THE APPLY BUTTON, on this route rather than its own.
     The Vercel plan allows twelve serverless functions and the project uses
     twelve, so a thirteenth file in api/ fails the deploy outright. A promo
     code only exists in the context of a booking, so quoting one belongs to
     the booking route. It CONSUMES NOTHING: see previewPromo. */
  if (req.query?.action === 'promo') {
    return promoPreview(res, body);
  }

  // Honeypot: bots fill every field; humans never see this one. Pretend
  // success so automated scripts learn nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return send(res, 201, { ok: true });
  }

  const payload = validate(body);
  if (typeof payload === 'string') {
    /* 400 for a request whose SHAPE is out of date, 422 for one that is the
       right shape and wrong. A client still posting purchaser-only bookings
       needs updating, and that is worth telling apart in a log from a
       visitor who left a field blank. */
    return send(
      res,
      payload === MISSING_ATTENDEES ? 400 : 422,
      { error: payload }
    );
  }

  const env = supabaseEnv('register');
  if (!env) {
    return send(res, 503, {
      error:
        'The registration desk is not open yet. Please try again later or write to bfcommunication@brigadeschools.edu.in.',
    });
  }

  /* CHECKED BEFORE THE PROMO IS RESERVED, and that order matters. Reserving
     first would spend one of a limited promotion's uses on a booking that is
     about to be refused, and `release_promo_use` would have to unpick it. A
     refusal that never touches the promotion cannot get that wrong. */
  const conflict = await conflictingIdentity(env, payload.email, payload.phone);
  if (conflict) {
    return send(res, 422, { error: conflict.error, field: conflict.field });
  }

  try {
    /* NO DUPLICATE CHECK. There used to be one here: an email or a mobile
       number could hold exactly one booking ever, and a second attempt was
       turned away with "a pass has already been issued for this attendee".
       That was written when a booking WAS a pass. It is not any more: a
       booking is a group of passes, and a parent who booked for one child in
       August has an ordinary reason to book again for another in October.
       Turning them away and pointing at Retrieve was telling someone they
       already had something they did not have.

       What genuinely guards against an accident is narrower and lives
       elsewhere: duplicate USNs WITHIN one booking are refused in
       `validateAttendees`, and `passes_booking_sequence_idx` stops a retry
       inserting the same attendee twice. Neither blocks a real second
       booking. */
    /* THE DISCOUNT IS DECIDED HERE, from the database, and never from the
       request. The browser sends a CODE and nothing else: no amount, no
       subtotal, no total. Whatever it believed the booking cost is not
       consulted, so DevTools, an edited fetch, a replayed request and ten
       tabs at once all arrive at the same place, which is this function
       asking Postgres to reserve a use and being told what it is worth.

       Reserved BEFORE the insert, because a booking written against a code
       that turns out to be exhausted would have to be unpicked afterwards.
       If the insert then fails, the use is handed back below. */
    const requested = normalisePromo(body.promo_code);
    if (requested) {
      const outcome = await reservePromo(
        env,
        requested,
        payload.visitor_type,
        payload.subtotal
      );
      if (!outcome.ok) {
        // The booking is refused rather than quietly priced at full price: a
        // visitor who typed a code and was charged as though they had not
        // would have no way of knowing why.
        return send(res, 422, {
          error: PROMO_MESSAGES[outcome.reason],
          promo: { code: requested, reason: outcome.reason },
        });
      }
      payload.promo_code = outcome.code;
      payload.discount_amount = outcome.discount_amount;
      /* THE FEE IS UNTOUCHED. The discount comes off the tickets and only the
         tickets, so the total falls by exactly the discount. */
      payload.total_amount =
        payload.subtotal - outcome.discount_amount + payload.convenience_fee;
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
      // The use was reserved a moment ago and nothing was booked with it.
      if (payload.promo_code) await releasePromo(env, payload.promo_code);
      return send(res, 502, {
        error: 'The registration could not be saved. Please try again.',
      });
    }

    const rows = (await insertResponse.json()) as Array<{ id: string }>;
    const registrationId = rows[0]?.id ?? null;
    if (!registrationId) {
      console.error('[register] stage=insert no id returned');
      if (payload.promo_code) await releasePromo(env, payload.promo_code);
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
      // The booking was rolled back, so its reservation goes back too.
      if (payload.promo_code) await releasePromo(env, payload.promo_code);
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
        // Zero when no code was used, so the confirmation page never has to
        // ask whether there was one.
        discount_amount: payload.discount_amount,
        promo_code: payload.promo_code,
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
