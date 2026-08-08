/**
 * The promo code a visitor has applied, on the client.
 *
 * WHAT THIS IS FOR: showing the arithmetic. It is NOT what the booking is
 * priced from. The browser sends a CODE with the booking and the server
 * reserves it and re-prices from scratch, so nothing here can change what
 * anybody is charged. See api/_promo.ts and the note in api/register.ts.
 *
 * A code stops being valid between applying it and booking with it more
 * often than you would think: a hundred-use promotion can run out in the
 * minute somebody spends on the consent checkboxes. That is why applying is
 * a preview and booking is the decision, and why this type carries what the
 * SERVER said rather than anything computed here.
 */
export type AppliedPromo = {
  code: string;
  /** Whole rupees off the ticket subtotal, as the server calculated it. */
  discountAmount: number;
  /** For the label: "10% off" reads better than "₹125 off". */
  discountType: 'percent' | 'amount';
  discountValue: number;
  /** The subtotal this discount was quoted against. */
  subtotal: number;
};

export type PromoState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'applied'; promo: AppliedPromo }
  | { phase: 'error'; message: string };

/** "FLASH26 · 10% off" or "FLASH26 · ₹50 off". */
export function describePromo(promo: AppliedPromo): string {
  return promo.discountType === 'percent'
    ? `${promo.code} · ${promo.discountValue}% off`
    : `${promo.code} · ₹${promo.discountValue} off`;
}

/**
 * Ask the server what a code is worth. Consumes nothing.
 *
 * The route is `register?action=promo` rather than a file of its own because
 * the Vercel plan allows twelve serverless functions and the project uses
 * twelve.
 */
export async function previewPromo(input: {
  code: string;
  visitorType: string;
  tickets: number;
}): Promise<
  | { ok: true; promo: AppliedPromo }
  | { ok: false; message: string }
> {
  try {
    const response = await fetch('/api/register?action=promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promo_code: input.code,
        visitor_type: input.visitorType,
        number_of_passes: input.tickets,
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok) {
      return {
        ok: true,
        promo: {
          code: data.code,
          discountAmount: Number(data.discount_amount) || 0,
          discountType: data.discount_type,
          discountValue: Number(data.discount_value) || 0,
          subtotal: Number(data.subtotal) || 0,
        },
      };
    }
    return {
      ok: false,
      message: data?.error ?? 'This promo code is invalid or no longer available.',
    };
  } catch {
    return {
      ok: false,
      message: 'We could not check that code just now. Please try again.',
    };
  }
}
