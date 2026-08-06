/**
 * Shared helpers for the Flash @ Brigade Edge functions. Files prefixed
 * with an underscore are not exposed as routes by Vercel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Send a JSON response on the classic Vercel Node.js (req, res) signature. */
export function send(
  res: VercelResponse,
  status: number,
  body: Record<string, unknown>
): void {
  res.status(status).json(body);
}

/** The parsed JSON body, or null when absent/malformed/not an object. */
export function jsonBody(req: VercelRequest): Record<string, unknown> | null {
  const body = req.body as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return null;
}

/** Trim, collapse whitespace, strip control characters, cap length. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

export function supabaseEnv(
  scope = 'api'
): { url: string; headers: Record<string, string> } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    // Names only, never values: these lines exist to make Vercel Logs
    // reveal the exact missing configuration.
    if (!url) {
      console.error(
        `[${scope}] Missing required environment variable: SUPABASE_URL`
      );
    }
    if (!key) {
      console.error(
        `[${scope}] Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY`
      );
    }
    return null;
  }
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  };
}

/** URL-safe random token (default 24 bytes ≈ 192 bits of entropy). */
export function randomToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let base64 = '';
  raw.forEach((b) => {
    base64 += String.fromCharCode(b);
  });
  return btoa(base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * HMAC-SHA256, hex. Used to make a value the server generated provable when
 * it comes back from a client that could have edited it in between.
 */
export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Length-independent compare, so a token cannot be recovered by timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The only visitor types the festival issues passes for. */
export const VISITOR_TYPES = ['student', 'parent', 'other'] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];

/**
 * Passes a visitor type may reserve. "Other" covers stallholders, vendors and
 * visiting troupes, so it is not held to the party size a family is, but it
 * is capped: an unbounded integer on a public form is an invitation. Ten,
 * because a group larger than that is a booking the desk wants to know about
 * rather than one that should go through a public form unseen. Mirrored in
 * the Get Passes UI (src/festival/getpasses/GetPassesPage.tsx); the server
 * re-validates and never trusts the client's copy.
 */
export const PASS_LIMITS: Record<VisitorType, number> = {
  student: 1,
  parent: 2,
  other: 10,
};

/** Classes a student can be in, oldest form of the school roll first. */
export const CLASSES = [
  'Nursery',
  'LKG',
  'UKG',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
] as const;

export const SECTIONS = ['A', 'B', 'C', 'D'] as const;

/** Who an "other" visitor is, in the order the form offers them. */
export const VISITOR_DETAILS = [
  'Guest',
  'Faculty',
  'Alumni',
  'Sponsor',
  'Vendor',
  'Media',
] as const;

/**
 * Visitor types that must supply school-roll details. Students give their
 * own; parents give their child's, which is why the roll columns are not
 * named after either party.
 */
export const ROLL_REQUIRED: readonly VisitorType[] = ['student', 'parent'];

/**
 * WHAT A TICKET COSTS, on the server.
 *
 * Mirrors `src/festival/getpasses/pricing.ts`, which is what the visitor is
 * shown. The two must agree, and where they disagree THIS one is right: the
 * amounts stored on a booking are computed here from the category and the
 * count, never taken from the request body. A client that posts its own
 * total is describing what it would like to pay.
 */
export const TICKET_PRICES: Record<VisitorType, number> = {
  student: 200,
  parent: 250,
  other: 250,
};

/** Per ticket, not per booking. Ten passes carry ₹250. */
export const CONVENIENCE_FEE_PER_TICKET = 25;

/** Whole rupees. Paise are a payment gateway's problem, at its own boundary. */
export function priceBooking(
  type: VisitorType,
  tickets: number
): { subtotal: number; convenience_fee: number; total_amount: number } {
  const subtotal = TICKET_PRICES[type] * tickets;
  const convenience_fee = CONVENIENCE_FEE_PER_TICKET * tickets;
  return { subtotal, convenience_fee, total_amount: subtotal + convenience_fee };
}

/** Human-friendly booking reference, e.g. FB2026-K7M3Q. Quoted at the desk. */
export function bookingReference(): string {
  return `FB2026-${referenceSuffix()}`;
}

/** Five characters from an alphabet with no confusable glyphs. */
function referenceSuffix(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const raw = crypto.getRandomValues(new Uint8Array(5));
  let out = '';
  raw.forEach((b) => {
    out += alphabet[b % alphabet.length];
  });
  return out;
}

/** Human-friendly pass reference, e.g. FB26-K7M3Q (no confusable glyphs). */
export function passReference(): string {
  return `FB26-${referenceSuffix()}`;
}

export type PassRow = {
  id: string;
  registration_id: string;
  pass_reference: string;
  /* WHO THIS PASS ADMITS. Not the purchaser: one booking has many of these,
     and the gate needs the person in front of it, not whoever paid. */
  attendee_name: string;
  attendee_category: string;
  sequence: number;
  student_name: string | null;
  usn: string | null;
  class: string | null;
  section: string | null;
  status: 'valid' | 'checked_in' | 'cancelled';
  issued_at: string;
  checked_in_at: string | null;
  /** Volunteer ID — the source of truth for WHO checked this pass in. */
  checked_in_by: string | null;
  /** Free text left by the retired access-code system. Read-only now. */
  checked_in_by_name: string | null;
  /* The BOOKING this pass belongs to. It carries the purchaser and the
     totals; the attendee lives on the pass above. */
  registrations?: {
    full_name: string;
    visitor_type: string;
    number_of_passes: number;
    booking_reference: string | null;
  };
};

/**
 * The volunteer who checked a pass in is looked up SEPARATELY, not embedded.
 * `passes` has two foreign keys into `volunteers` (`checked_in_by` and
 * `undone_by`), so an embed has to name the constraint — and if that name is
 * wrong the whole query 400s, taking pass verification down with it rather
 * than just losing a display name. The registration embed stays: it is a
 * single unambiguous relationship that has been in production for weeks.
 */
const PASS_SELECT =
  `select=id,registration_id,pass_reference,status,issued_at,checked_in_at,` +
  `checked_in_by,checked_in_by_name,` +
  `attendee_name,attendee_category,sequence,student_name,usn,class,section,` +
  `registrations(full_name,visitor_type,number_of_passes,booking_reference)`;

async function findPass(
  env: { url: string; headers: Record<string, string> },
  filter: string
): Promise<PassRow | null> {
  const response = await fetch(
    `${env.url}/rest/v1/passes?${PASS_SELECT}&${filter}&limit=1`,
    { headers: env.headers }
  );
  if (!response.ok) throw new Error('pass lookup failed');
  const rows = (await response.json()) as PassRow[];
  return rows[0] ?? null;
}

/** Fetch a pass (joined with its registration) by hashed token. */
export async function findPassByToken(
  env: { url: string; headers: Record<string, string> },
  token: string
): Promise<PassRow | null> {
  return findPass(env, `verification_token_hash=eq.${await sha256Hex(token)}`);
}

/** Human-readable pass reference, as printed on the pass: FB26-XXXXX. */
export const REFERENCE_PATTERN = /^FB26-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

/**
 * Fetch a pass by the reference a volunteer can read off the pass and type
 * in. Unlike the token this is short enough to guess at, so it is only ever
 * reachable behind the verifier access code — see api/verify.ts, which checks
 * the code before any lookup happens.
 */
export async function findPassByReference(
  env: { url: string; headers: Record<string, string> },
  reference: string
): Promise<PassRow | null> {
  return findPass(env, `pass_reference=eq.${encodeURIComponent(reference)}`);
}
