/**
 * GET /api/wallet-google?token=… — Google Wallet "Save to Wallet" link.
 *
 * NOT YET CONFIGURED. Google Wallet event tickets require an Issuer
 * account and a service-account key used server-side to sign a JWT for
 * the save link. Until the credentials below exist in the Vercel project
 * this endpoint answers 501 and the client shows no Google Wallet button
 * (see docs/PASS_SYSTEM.md).
 *
 * Required environment variables:
 *   GOOGLE_WALLET_ISSUER_ID          – numeric issuer id
 *   GOOGLE_WALLET_CLASS_SUFFIX       – e.g. flash-brigade-2026
 *   GOOGLE_WALLET_SA_EMAIL           – service-account email
 *   GOOGLE_WALLET_SA_PRIVATE_KEY_PEM – service-account private key (PEM)
 *
 * Implementation sketch once configured: look up the pass by token hash,
 * build an EventTicketObject (event name, dates, venue, guest, barcode
 * with the verification URL), sign a "savetowallet" JWT (RS256) with the
 * service-account key and 302-redirect to
 * https://pay.google.com/gp/v/save/<jwt>. Store the object id in
 * passes.google_wallet_object_id.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { send } from './_shared';

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const configured =
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SA_EMAIL &&
    process.env.GOOGLE_WALLET_SA_PRIVATE_KEY_PEM;

  if (!configured) {
    return send(res, 501, {
      error: 'Google Wallet is not configured for this deployment.',
      docs: 'docs/PASS_SYSTEM.md',
    });
  }

  return send(res, 501, {
    error: 'Google Wallet signing is not implemented yet.',
    docs: 'docs/PASS_SYSTEM.md',
  });
}
