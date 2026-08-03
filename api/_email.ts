/**
 * Transactional email, via Resend.
 *
 * The FIRST email integration in this project, so this file is the whole of
 * it: the credential, the sender, the branded shell and the escaping. Nothing
 * else may talk to Resend directly.
 *
 * Underscore-prefixed, so Vercel does not expose it as a route and it costs
 * nothing against the 12-function Hobby limit.
 *
 * Three rules it exists to enforce:
 *
 *   1. The API key never leaves the server. It is read from the environment
 *      here and nowhere else, and no value from it is ever returned to a
 *      caller.
 *   2. Email is BEST EFFORT. A send that fails must never fail the request
 *      that triggered it: the database row is the record, the email is a
 *      courtesy. Every function here reports failure by return value and
 *      throws nothing.
 *   3. Every interpolated value is escaped. These messages embed text a
 *      stranger typed into a form; unescaped, that is an injection into
 *      whatever mail client eventually renders it.
 */

/** No dependency. Resend's REST API is one POST, and the SDK is 100kB. */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a human reply goes. For the desk copy, the visitor. */
  replyTo?: string;
};

export type MailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: 'unconfigured' | 'rejected' | 'unreachable' };

function mailEnv(): { key: string; from: string } | null {
  const key = process.env.RESEND_API_KEY?.trim();
  // A verified Resend sender, e.g. "Flash @ Brigade <hello@flashbrigade.in>".
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    // Names only, never values: these lines exist so Vercel Logs name the
    // exact missing configuration.
    if (!key) console.error('[email] Missing environment variable: RESEND_API_KEY');
    if (!from) console.error('[email] Missing environment variable: RESEND_FROM');
    return null;
  }
  return { key, from };
}

/** True when email can be sent at all. Callers use this to tell the truth. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const env = mailEnv();
  if (!env) return { sent: false, reason: 'unconfigured' };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // Status only. Resend echoes the payload on some errors, and the
      // payload is somebody's name, address and message.
      console.error(`[email] stage=send resend_status=${response.status}`);
      return { sent: false, reason: 'rejected' };
    }
    const data = (await response.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: data?.id ?? null };
  } catch {
    console.error('[email] stage=send resend_unreachable');
    return { sent: false, reason: 'unreachable' };
  }
}

/* -------------------------------------------------------------------- */
/*  Rendering                                                            */
/* -------------------------------------------------------------------- */

/**
 * HTML-escape. Applied to EVERY interpolated value without exception.
 *
 * The content of these emails is text a stranger typed into a public form.
 * Unescaped it is an injection into whichever mail client opens it, and the
 * desk copy is opened by us, which makes it the more dangerous of the two.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Newlines survive as line breaks once the text is safely escaped. */
export function escapeParagraph(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

/**
 * The house style, as one shell both messages sit in.
 *
 * Deliberately old-fashioned HTML: a centred table, inline styles, no custom
 * fonts and no external assets. Mail clients strip stylesheets, ignore most
 * modern CSS and frequently block remote images, so the site's real
 * typography cannot survive the trip. What carries the brand instead is the
 * marble ground, the terracotta rule and the wordmark set in a serif stack
 * that every client already has.
 */
export function emailShell({
  heading,
  intro,
  body,
  footnote,
}: {
  heading: string;
  intro: string;
  /** Pre-escaped HTML. Callers are responsible for what they pass. */
  body: string;
  footnote?: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f2ece1;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ece1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf7ef;border:1px solid #ded3c0;border-radius:6px;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <p style="margin:0;font:600 12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9a4a28;">
                  Flash @ Brigade 2026
                </p>
                <div style="height:1px;background:#c9a227;width:56px;margin:16px 0 0 0;"></div>
                <h1 style="margin:24px 0 0 0;font:500 26px/1.25 Georgia,'Times New Roman',serif;color:#241d16;">
                  ${escapeHtml(heading)}
                </h1>
                <p style="margin:16px 0 0 0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#54493c;">
                  ${escapeHtml(intro)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;">${body}</td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <div style="height:1px;background:#e4dbcb;"></div>
                <p style="margin:16px 0 0 0;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8b7f6f;">
                  ${escapeHtml(footnote ?? 'The Brigade School @ Malleswaram · 14 November 2026')}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A label/value row for the desk copy. `value` is escaped here. */
export function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b7f6f;width:34%;vertical-align:top;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:8px 0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#241d16;">
      ${escapeHtml(value)}
    </td>
  </tr>`;
}
