/**
 * Promo codes, server side.
 *
 * THE DATABASE DECIDES, NOT THIS FILE. Every question about a code (does it
 * exist, is it active, is it in date, is there capacity left, what is it
 * worth) is answered by a function in Postgres, because the last of those
 * questions cannot be answered safely anywhere else: checking capacity here
 * and updating it afterwards leaves a window in which two bookings both see
 * the last remaining use. See supabase/migrations/20260809_promo_codes.sql.
 *
 * Nothing here names a code. FLASH26 is a row.
 */

/** What the database says about a code, whichever function was asked. */
export type PromoOutcome = {
  ok: boolean;
  reason:
    | 'ok'
    | 'missing'
    | 'unknown'
    | 'inactive'
    | 'not_started'
    | 'expired'
    | 'exhausted'
    | 'not_applicable'
    | 'unavailable';
  code: string | null;
  discount_type: 'percent' | 'amount' | null;
  discount_value: number | null;
  /** Whole rupees off the TICKET SUBTOTAL. Never off the fee. */
  discount_amount: number;
  /** Uses left, or null when the code is unlimited. */
  remaining: number | null;
};

const NONE: PromoOutcome = {
  ok: false,
  reason: 'unavailable',
  code: null,
  discount_type: null,
  discount_value: null,
  discount_amount: 0,
  remaining: null,
};

/**
 * WHAT A VISITOR IS TOLD, and deliberately less than the server knows.
 *
 * An inactive code, an expired one and one that never existed all read the
 * same, because the difference is only useful to somebody guessing at codes:
 * three distinguishable answers turn the Apply button into an oracle for
 * enumerating unreleased promotions. An exhausted code is the exception. It
 * IS distinguishable, because a visitor who typed a real code correctly and
 * arrived a minute late deserves to know that rather than be told they got
 * it wrong.
 */
export const PROMO_MESSAGES: Record<PromoOutcome['reason'], string> = {
  ok: '',
  missing: 'Enter a promo code to apply it.',
  unknown: 'This promo code is invalid or no longer available.',
  inactive: 'This promo code is invalid or no longer available.',
  not_started: 'This promo code is invalid or no longer available.',
  expired: 'This promo code is invalid or no longer available.',
  not_applicable: 'This promo code does not apply to this booking.',
  exhausted:
    'This promotion has been fully claimed. Every allocated code has been used.',
  unavailable: 'Promo codes are unavailable right now. Please try again.',
};

/** Trim, upper-case, cap. The database also normalises; this saves a round trip. */
export function normalisePromo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return cleaned ? cleaned.slice(0, 32) : null;
}

async function callPromoFunction(
  env: { url: string; headers: Record<string, string> },
  fn: 'preview_promo_code' | 'reserve_promo_use',
  code: string,
  visitorType: string,
  subtotal: number
): Promise<PromoOutcome> {
  const response = await fetch(`${env.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: env.headers,
    body: JSON.stringify({
      p_code: code,
      p_visitor_type: visitorType,
      p_subtotal: subtotal,
    }),
  });
  if (!response.ok) {
    console.error(`[promo] stage=${fn} supabase_status=${response.status}`);
    return NONE;
  }
  // A `returns table` function comes back as an array of one row.
  const rows = (await response.json()) as PromoOutcome[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return NONE;
  return {
    ...row,
    discount_amount: Number(row.discount_amount) || 0,
    remaining: row.remaining === null ? null : Number(row.remaining),
  };
}

/**
 * Would this code work, and what would it be worth? Consumes nothing.
 *
 * Used by the Apply button. If pressing Apply reserved a use, a hundred-use
 * promotion would be exhausted by a hundred people who typed it and then
 * closed the tab.
 */
export function previewPromo(
  env: { url: string; headers: Record<string, string> },
  code: string,
  visitorType: string,
  subtotal: number
): Promise<PromoOutcome> {
  return callPromoFunction(env, 'preview_promo_code', code, visitorType, subtotal);
}

/**
 * Take one of this code's uses, atomically, and say what it is worth.
 *
 * Called once per booking, from `register`, BEFORE the booking row is
 * written: a booking created against a code that turns out to be exhausted
 * would have to be unpicked. If the insert then fails, `releasePromo` gives
 * the use back.
 */
export function reservePromo(
  env: { url: string; headers: Record<string, string> },
  code: string,
  visitorType: string,
  subtotal: number
): Promise<PromoOutcome> {
  return callPromoFunction(env, 'reserve_promo_use', code, visitorType, subtotal);
}

/** Hand a reserved use back after a booking failed to save. Best effort. */
export async function releasePromo(
  env: { url: string; headers: Record<string, string> },
  code: string
): Promise<void> {
  try {
    await fetch(`${env.url}/rest/v1/rpc/release_promo_use`, {
      method: 'POST',
      headers: env.headers,
      body: JSON.stringify({ p_code: code }),
    });
  } catch {
    // A use that is not returned costs the promotion one redemption. Worth a
    // log, never worth failing the response the visitor is waiting for.
    console.error('[promo] stage=release failed');
  }
}
