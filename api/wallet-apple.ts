/**
 * GET /api/wallet-apple?token=… — Apple Wallet (.pkpass) generation.
 *
 * NOT YET CONFIGURED. Apple Wallet event tickets require server-side
 * signing with a Pass Type ID certificate. This endpoint is the correct
 * place for that work; until the credentials below exist in the Vercel
 * project it answers 501 and the client shows no Apple Wallet button
 * (see docs/PASS_SYSTEM.md).
 *
 * Required environment variables:
 *   APPLE_TEAM_ID                 – Apple Developer Team ID
 *   APPLE_PASS_TYPE_ID            – e.g. pass.in.edu.brigadeschools.flash
 *   APPLE_PASS_CERT_P12_BASE64    – Pass Type ID certificate + key (.p12, base64)
 *   APPLE_PASS_CERT_PASSWORD      – password for the .p12
 *
 * Implementation sketch once configured (Node runtime, not Edge, because
 * PKCS#7 signing needs the crypto stack): look up the pass by token hash,
 * build pass.json (eventTicket) + icon/logo assets, manifest.json with
 * SHA-1 digests, sign the manifest with the certificate, zip as .pkpass
 * and return with Content-Type application/vnd.apple.pkpass. Store the
 * serial in passes.apple_wallet_serial.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { send } from './_shared';

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const configured =
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_PASS_CERT_P12_BASE64 &&
    process.env.APPLE_PASS_CERT_PASSWORD;

  if (!configured) {
    return send(res, 501, {
      error: 'Apple Wallet is not configured for this deployment.',
      docs: 'docs/PASS_SYSTEM.md',
    });
  }

  // Signing is intentionally not implemented until real credentials exist;
  // shipping an unsigned or mis-signed .pkpass would fail in Wallet.
  return send(res, 501, {
    error: 'Apple Wallet signing is not implemented yet.',
    docs: 'docs/PASS_SYSTEM.md',
  });
}
