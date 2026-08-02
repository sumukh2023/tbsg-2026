/**
 * THE PAYMENT SEAM.
 *
 * Everything the donate page knows about taking money lives in this one file.
 * The page owns the form, the validation, the review screen and the thank-you
 * screen; it calls `settleDonation` once, between review and success, and
 * renders whatever comes back. It does not know whether a gateway exists.
 *
 * Today `settleDonation` records intent and stops: `/api/donate` writes one
 * row with `payment_status = 'pending'` and no money moves. The outcome it
 * returns says so, and the thank-you screen reads that flag rather than
 * assuming anything, so the day a gateway arrives the screen changes its own
 * wording without being edited.
 *
 * TO INTEGRATE RAZORPAY (or any other provider):
 *
 *   1. `/api/donate` already creates the intent row. Have it also create the
 *      gateway order and return the order id (there is a marked seam in that
 *      file too).
 *   2. In `settleDonation` below, after `recordIntent` resolves, open the
 *      gateway's checkout with that order id and await its result.
 *   3. On success, POST the gateway's payload to a new verification endpoint
 *      which checks the signature server-side and PATCHes the row to `paid`.
 *      Never trust the browser's word that a payment succeeded.
 *   4. Return `{ ok: true, settled: true, ... }`.
 *
 * Nothing outside this file has to change for any of that. The form, the
 * validation, the review screen, the success screen and the database are all
 * already shaped for it.
 */

/** Exactly what the API needs. The page's form state is mapped onto this. */
export type DonationIntent = {
  full_name: string;
  email: string;
  phone: string;
  donor_type: 'individual' | 'parent' | 'alumni' | 'corporate';
  organisation: string | null;
  /** Whole rupees. Paise conversion belongs to the gateway, at its boundary. */
  amount: number;
  recognition_preference: 'public' | 'anonymous';
  marketing_opt_in: boolean;
  terms_accepted: true;
};

export type DonationOutcome =
  | {
      ok: true;
      /** The donation's id in our own records, for the donor to quote. */
      reference: string | null;
      /**
       * Whether money actually moved.
       *
       * False for as long as there is no gateway: the intent is recorded and
       * the team follows up. The success screen branches on this, so it will
       * tell the truth before and after an integration without being touched.
       */
      settled: boolean;
    }
  | { ok: false; error: string };

/** Create the donation row. This step survives a gateway integration as-is. */
async function recordIntent(
  intent: DonationIntent
): Promise<{ id: string | null } | { error: string }> {
  let response: Response;
  try {
    response = await fetch('/api/donate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intent),
    });
  } catch {
    return {
      error:
        'We could not reach the donation service. Please check your connection and try again.',
    };
  }

  const data = (await response.json().catch(() => null)) as {
    id?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    return {
      // A validated message from the API is worth showing; a 500 is not, so
      // it gets a sentence that says which side failed.
      error:
        data?.error ??
        `The donation service failed (error ${response.status}). Nothing has been charged.`,
    };
  }
  return { id: data?.id ?? null };
}

/**
 * Take a donation as far as it can currently go.
 *
 * The page awaits exactly this. Its shape is the contract that makes a
 * gateway a drop-in: today one step, later two, same call site either way.
 */
export async function settleDonation(
  intent: DonationIntent
): Promise<DonationOutcome> {
  const recorded = await recordIntent(intent);
  if ('error' in recorded) return { ok: false, error: recorded.error };

  // >>> GATEWAY GOES HERE <<<
  // const paid = await openCheckout(recorded.orderId);
  // if (!paid.ok) return { ok: false, error: paid.error };
  // await verifyServerSide(paid);
  // return { ok: true, reference: recorded.id, settled: true };

  return { ok: true, reference: recorded.id, settled: false };
}

/** Whether donations can actually be taken. Drives the page's own wording. */
export const PAYMENTS_LIVE = false;
