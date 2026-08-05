/**
 * Money formatting, in one place.
 *
 * Everything this site deals in is WHOLE RUPEES. Paise are a payment
 * gateway's concern and the conversion belongs at its boundary, not in stored
 * or displayed values.
 */

/** ₹1,00,000 rather than ₹100,000: this is an Indian site. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
