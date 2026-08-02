/**
 * Money, in one place, so the form and the API cannot drift apart.
 *
 * Everything here is WHOLE RUPEES. Paise are a gateway's concern and the
 * conversion belongs at its boundary, not in stored or displayed values.
 * `MIN_DONATION` mirrors `MIN_AMOUNT` in `api/donate.ts`: the server is the
 * authority, this copy exists so the reader is told before a round trip.
 */

/** The plates offered on the form. */
export const PRESETS = [500, 1000, 2500, 5000, 10000] as const;

/**
 * The floor for a CUSTOM amount, which is deliberately below the smallest
 * preset. Someone giving ₹200 should not be turned away because the cheapest
 * button happens to say ₹500.
 */
export const MIN_DONATION = 100;

/** ₹1,00,000 rather than ₹100,000: this is an Indian site. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
