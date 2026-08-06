/**
 * POST /api/donate — records an expression of donation INTENT.
 *
 * There is no payment gateway wired up yet, so this endpoint deliberately
 * stops short of taking money: it validates, writes one row with
 * `payment_status = 'pending'`, and returns the row's id as a reference the
 * donor can quote. Nothing here ever writes `paid`.
 *
 * WHERE A GATEWAY GOES (see docs/DONATIONS.md for the full note):
 *   1. This handler stays as it is. It becomes "create the intent", which is
 *      exactly what a gateway wants to happen first anyway.
 *   2. Its response gains the gateway's order id, minted just below the
 *      insert, next to the marker comment.
 *   3. A NEW endpoint verifies the gateway's signature and PATCHes the row to
 *      `paid` with its `payment_reference` and `paid_at`.
 * The table, the validation and the client's form/review/success flow are
 * untouched by all three.
 *
 * Setup: supabase/migrations/20260802_donations.sql + SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the Vercel project.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cleanText, jsonBody, send, supabaseEnv } from './_shared.js';

const DONOR_TYPES = ['individual', 'parent', 'alumni', 'corporate'] as const;
type DonorType = (typeof DONOR_TYPES)[number];

const RECOGNITION = ['public', 'anonymous'] as const;

/**
 * Bounds on a single gift, in whole rupees. The floor keeps the table free of
 * ₹1 test rows; the ceiling is the same one the column checks, so a value the
 * database would reject is refused here with a sentence instead of a 500.
 */
const MIN_AMOUNT = 100; // mirrored in src/festival/donate/amounts.ts
const MAX_AMOUNT = 10_000_000;

type Payload = {
  full_name: string;
  email: string;
  phone: string;
  donor_type: DonorType;
  organisation: string | null;
  amount: number;
  recognition_preference: (typeof RECOGNITION)[number];
  marketing_opt_in: boolean;
  terms_accepted: true;
  terms_accepted_at: string;
  payment_status: 'pending';
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

  const donor_type = (
    typeof body.donor_type === 'string' ? body.donor_type : ''
  ) as DonorType;
  if (!DONOR_TYPES.includes(donor_type)) {
    return 'Donor type is not recognised.';
  }

  // Only a corporate donor may carry one, and even then it is optional. The
  // column checks the same rule, so this is the friendly half of a constraint
  // that is enforced either way.
  const organisation =
    donor_type === 'corporate' ? cleanText(body.organisation, 160) : null;

  // Whole rupees only. `Number()` on "1,000" or "1e5" gives NaN or a surprise,
  // so the string form is rejected before it can become one.
  const raw = body.amount;
  const amount =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT) {
    return `The smallest donation we can record is ₹${MIN_AMOUNT}.`;
  }
  if (amount > MAX_AMOUNT) {
    return 'Please contact the school directly to arrange a gift this size.';
  }

  const recognition_preference = (
    typeof body.recognition_preference === 'string'
      ? body.recognition_preference
      : ''
  ) as (typeof RECOGNITION)[number];
  if (!RECOGNITION.includes(recognition_preference)) {
    return 'Choose whether the donation is acknowledged publicly.';
  }

  // Consent is a precondition, not a field. The timestamp is taken HERE so
  // what is stored is when the server accepted it, not what a client claimed.
  if (body.terms_accepted !== true) {
    return 'The Terms of Service and Privacy Policy must be accepted.';
  }

  return {
    full_name,
    email,
    phone,
    donor_type,
    organisation,
    amount,
    recognition_preference,
    marketing_opt_in: body.marketing_opt_in === true,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    // Not taken from the client under any circumstances.
    payment_status: 'pending',
  };
}

/**
 * GET /api/donate — the public donor roll, for the acknowledgement scroller.
 *
 * ON THIS ROUTE RATHER THAN ITS OWN. The Vercel plan allows twelve
 * serverless functions and the project uses twelve; a thirteenth file in
 * `api/` fails the deploy outright. Reading and writing donations are the
 * same subject, so the roll lives on the same function.
 *
 * WHAT IT WILL AND WILL NOT SAY. Only gifts whose donor asked to be named
 * (`recognition_preference = 'public'`) and whose money has actually arrived
 * (`payment_status = 'paid'`). An intent is not a gift, and thanking someone
 * publicly for one that has not been captured is a claim about them that is
 * not true yet. Corporate donors are named by their organisation where they
 * gave one, which is the name they gave it under.
 *
 * NOTHING ELSE LEAVES THE FUNCTION. Not the email address, the phone number,
 * the amount or the donor type. A wall of names is a wall of names; the
 * amounts are the office's business and would turn an acknowledgement into a
 * league table.
 */
async function roll(res: VercelResponse): Promise<void> {
  const env = supabaseEnv('donate');
  if (!env) {
    // An unconfigured service is not an error to the visitor: the scroller
    // simply shows its invitation instead of a wall of names.
    return send(res, 200, { donors: [] });
  }

  const response = await fetch(
    `${env.url}/rest/v1/donations` +
      `?select=full_name,organisation,donor_type,created_at` +
      `&recognition_preference=eq.public&payment_status=eq.paid` +
      `&order=created_at.asc&limit=500`,
    { headers: env.headers }
  );
  if (!response.ok) {
    console.error(`[donate] stage=roll supabase_status=${response.status}`);
    return send(res, 200, { donors: [] });
  }

  const rows = (await response.json()) as Array<{
    full_name: string;
    organisation: string | null;
    donor_type: string;
  }>;

  /* DEDUPED, because one person may give more than once and being thanked
     twice on the same wall reads as a mistake rather than as generosity.
     Folded for the comparison only: what is displayed is the first spelling
     the donor used. */
  const seen = new Set<string>();
  const donors: string[] = [];
  for (const row of rows) {
    const name =
      row.donor_type === 'corporate' && row.organisation
        ? row.organisation
        : row.full_name;
    const key = name.normalize('NFD').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    donors.push(name);
  }

  // A minute of browser cache and five at the edge: the wall changes when a
  // gift is marked paid, which is not something that happens between one
  // page view and the next.
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
  );
  return send(res, 200, { donors });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === 'GET') return roll(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const body = jsonBody(req);
  if (!body) return send(res, 400, { error: 'A JSON body is required.' });

  const payload = validate(body);
  if (typeof payload === 'string') return send(res, 422, { error: payload });

  const env = supabaseEnv('donate');
  if (!env) {
    return send(res, 503, {
      error: 'The donation service is not configured yet. Please try later.',
    });
  }

  const response = await fetch(`${env.url}/rest/v1/donations`, {
    method: 'POST',
    headers: { ...env.headers, Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Status only, never the body: it can echo the row back, and the row is
    // a donor's name, email and phone number.
    console.error(`[donate] stage=insert supabase_status=${response.status}`);
    return send(res, 502, {
      error: 'We could not record that just now. Please try again.',
    });
  }

  const rows = (await response.json()) as Array<{
    id: string;
    created_at: string;
  }>;
  const row = rows[0];

  // ------------------------------------------------------------------
  // >>> PAYMENT GATEWAY SEAM <<<
  // A gateway order is created HERE, against `row.id`, and returned to the
  // browser alongside it. Everything above stays exactly as it is.
  //
  //   const order = await razorpay.orders.create({
  //     amount: payload.amount * 100,        // paise
  //     currency: 'INR',
  //     receipt: row.id,
  //   });
  //
  // Then add `order_id: order.id` and the public key to the response below.
  // ------------------------------------------------------------------

  return send(res, 201, {
    id: row?.id ?? null,
    created_at: row?.created_at ?? null,
    payment_status: 'pending',
  });
}
