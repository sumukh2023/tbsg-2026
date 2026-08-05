/**
 * POST /api/enquiry — records a contact enquiry and notifies the desk.
 *
 * Order matters and is deliberate: VALIDATE, then STORE, then email. The row
 * is the record; the two emails are a courtesy on top of it. A Resend outage,
 * a missing API key or a bounced address costs a notification and never the
 * message itself, and the response says honestly which of those happened so
 * the page can avoid promising a confirmation email that was never sent.
 *
 * Setup: supabase/migrations/20260803_contact_enquiries.sql, SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY, and (for the emails) RESEND_API_KEY and
 * RESEND_FROM. See docs/ENQUIRIES.md.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  cleanText,
  jsonBody,
  send,
  sha256Hex,
  supabaseEnv,
} from './_shared.js';
import {
  deskInbox,
  detailRow,
  emailConfigured,
  emailShell,
  escapeParagraph,
  sendMail,
} from './_email.js';

/** Stored value -> the words a human reads. Kept together so they cannot drift. */
const SUBJECTS = {
  general: 'General Enquiry',
  passes: 'Passes',
  'stall-booking': 'Stall Booking',
  sponsorship: 'Sponsorship',
  donations: 'Donations',
  'technical-support': 'Technical Support',
  other: 'Other',
} as const;
type Subject = keyof typeof SUBJECTS;

/* -------------------------------------------------------------------- */
/*  Rate limiting                                                        */
/*                                                                       */
/*  Two windows against the enquiries table itself, so there is no second */
/*  table to keep and no in-memory counter that a serverless function     */
/*  would lose between invocations.                                      */
/* -------------------------------------------------------------------- */
const WINDOW_MINUTES = 10;
/** Per address. Generous: a real person may genuinely have two questions. */
const MAX_PER_EMAIL = 3;
/** Per source. Higher, because a school shares one address on the day. */
const MAX_PER_IP = 8;
/** An identical message inside this window is a double submit, not a resend. */
const DUPLICATE_MINUTES = 5;

type Payload = {
  full_name: string;
  email: string;
  mobile: string | null;
  subject: Subject;
  message: string;
  marketing_opt_in: boolean;
  privacy_accepted: true;
  privacy_accepted_at: string;
  status: 'new';
  ip_hash: string | null;
};

function validate(
  body: Record<string, unknown>,
  ipHash: string | null
): Payload | string {
  const full_name = cleanText(body.full_name, 120);
  if (!full_name || full_name.length < 2) return 'A full name is required.';

  const email = cleanText(body.email, 160)?.toLowerCase() ?? null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'A valid email address is required.';
  }

  // Optional here, unlike every other form on this site. Somebody asking a
  // question should not have to hand over a phone number to do it. Given one,
  // it still has to be a real Indian mobile.
  let mobile: string | null = null;
  const rawMobile = cleanText(body.mobile, 16)?.replace(/[\s-]/g, '') ?? null;
  if (rawMobile) {
    if (!/^(\+?91)?[6-9]\d{9}$/.test(rawMobile)) {
      return 'That mobile number does not look like a 10-digit Indian number.';
    }
    mobile = rawMobile;
  }

  const subject = (
    typeof body.subject === 'string' ? body.subject : ''
  ) as Subject;
  if (!(subject in SUBJECTS)) return 'Choose what the enquiry is about.';

  // `cleanText` collapses whitespace, which would flatten a multi-paragraph
  // enquiry into one line. Cleaned by hand instead: control characters go,
  // newlines stay, runs of blank lines are capped.
  const rawMessage = typeof body.message === 'string' ? body.message : '';
  const message = rawMessage
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, 4000);
  if (message.length < 10) {
    return 'Please write a little more so we can help properly.';
  }

  if (body.privacy_accepted !== true) {
    return 'The Privacy Policy must be accepted.';
  }

  return {
    full_name,
    email,
    mobile,
    subject,
    message,
    marketing_opt_in: body.marketing_opt_in === true,
    privacy_accepted: true,
    // Taken HERE, server-side, so what is stored is when the server accepted
    // it rather than whatever a client claimed.
    privacy_accepted_at: new Date().toISOString(),
    status: 'new',
    ip_hash: ipHash,
  };
}

type Env = NonNullable<ReturnType<typeof supabaseEnv>>;

async function countSince(
  env: Env,
  filter: string,
  minutes: number
): Promise<number | null> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const response = await fetch(
    `${env.url}/rest/v1/contact_enquiries?select=id&created_at=gte.${since}&${filter}`,
    { headers: { ...env.headers, Prefer: 'count=exact' } }
  );
  if (!response.ok) {
    console.error(`[enquiry] stage=ratelimit supabase_status=${response.status}`);
    // A failed COUNT must not become a closed door. Fail open: the worst case
    // is one extra enquiry, and the alternative is a form nobody can use
    // because a read went wrong.
    return null;
  }
  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : null;
}

/** The exact same message from the same person, moments ago: a double click. */
async function findRecentDuplicate(
  env: Env,
  payload: Payload
): Promise<string | null> {
  const since = new Date(Date.now() - DUPLICATE_MINUTES * 60_000).toISOString();
  const url =
    `${env.url}/rest/v1/contact_enquiries?select=id&created_at=gte.${since}` +
    `&email=eq.${encodeURIComponent(payload.email)}` +
    `&subject=eq.${encodeURIComponent(payload.subject)}` +
    `&message=eq.${encodeURIComponent(payload.message)}&limit=1`;
  const response = await fetch(url, { headers: env.headers });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

/* -------------------------------------------------------------------- */
/*  The two messages                                                     */
/* -------------------------------------------------------------------- */

function deskEmail(payload: Payload, receivedAt: Date) {
  const label = SUBJECTS[payload.subject];
  const stamp = receivedAt.toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Name', payload.full_name)}
      ${detailRow('Email', payload.email)}
      ${detailRow('Mobile', payload.mobile ?? 'Not given')}
      ${detailRow('Subject', label)}
      ${detailRow('Updates opt-in', payload.marketing_opt_in ? 'Yes' : 'No')}
      ${detailRow('Received', `${stamp} IST`)}
    </table>
    <div style="height:1px;background:#e4dbcb;margin:24px 0;"></div>
    <p style="margin:0 0 8px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b7f6f;">
      Message
    </p>
    <div style="font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#241d16;white-space:normal;">
      ${escapeParagraph(payload.message)}
    </div>`;

  return {
    // Exactly the format the brief asked for, with an en dash.
    subject: `[Flash Enquiry] ${label} – ${payload.full_name}`,
    html: emailShell({
      heading: 'New enquiry',
      intro: `${payload.full_name} has written in through the enquiry form. Replying to this email goes straight back to them.`,
      body,
      footnote: 'Sent automatically by the Flash @ Brigade enquiry form.',
    }),
    text: [
      `New enquiry — ${label}`,
      '',
      `Name:           ${payload.full_name}`,
      `Email:          ${payload.email}`,
      `Mobile:         ${payload.mobile ?? 'Not given'}`,
      `Subject:        ${label}`,
      `Updates opt-in: ${payload.marketing_opt_in ? 'Yes' : 'No'}`,
      `Received:       ${stamp} IST`,
      '',
      'Message',
      '-------',
      payload.message,
      '',
      'Replying to this email goes straight back to the sender.',
    ].join('\n'),
  };
}

function acknowledgementEmail(payload: Payload) {
  const label = SUBJECTS[payload.subject];
  const body = `
    <p style="margin:0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#241d16;">
      A member of the organising team will get back to you as soon as they
      can. There is no need to write again in the meantime.
    </p>
    <div style="height:1px;background:#e4dbcb;margin:24px 0;"></div>
    <p style="margin:0 0 8px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b7f6f;">
      What you sent us
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Subject', label)}
    </table>
    <div style="margin-top:12px;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#54493c;">
      ${escapeParagraph(payload.message)}
    </div>`;

  return {
    subject: "We've received your enquiry",
    html: emailShell({
      heading: 'Thank you for writing to us',
      intro: `Hello ${payload.full_name}, we have your enquiry and it is with the team.`,
      body,
      footnote:
        'This is an automatic acknowledgement from Flash @ Brigade 2026. You can reply to it.',
    }),
    text: [
      `Hello ${payload.full_name},`,
      '',
      'We have your enquiry and it is with the team. A member of the',
      'organising team will get back to you as soon as they can.',
      '',
      `Subject: ${label}`,
      '',
      'What you sent us',
      '----------------',
      payload.message,
      '',
      'Flash @ Brigade 2026 · The Brigade School @ Malleswaram',
    ].join('\n'),
  };
}

/* -------------------------------------------------------------------- */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const body = jsonBody(req);
  if (!body) return send(res, 400, { error: 'A JSON body is required.' });

  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  // Hashed immediately. The address itself is never stored or logged.
  const ipHash = rawIp ? await sha256Hex(rawIp) : null;

  const payload = validate(body, ipHash);
  if (typeof payload === 'string') return send(res, 422, { error: payload });

  const env = supabaseEnv('enquiry');
  if (!env) {
    return send(res, 503, {
      error: 'The enquiry service is not configured yet. Please try later.',
    });
  }

  // A double click, or a page restored from the back/forward cache and
  // submitted again. Answer as though it worked, because from the sender's
  // point of view it did: their message is already with us.
  const duplicate = await findRecentDuplicate(env, payload);
  if (duplicate) {
    return send(res, 200, {
      id: duplicate,
      duplicate: true,
      acknowledgement_sent: emailConfigured(),
    });
  }

  const [byEmail, bySource] = await Promise.all([
    countSince(
      env,
      `email=eq.${encodeURIComponent(payload.email)}`,
      WINDOW_MINUTES
    ),
    ipHash
      ? countSince(env, `ip_hash=eq.${ipHash}`, WINDOW_MINUTES)
      : Promise.resolve(null),
  ]);
  if (
    (byEmail !== null && byEmail >= MAX_PER_EMAIL) ||
    (bySource !== null && bySource >= MAX_PER_IP)
  ) {
    res.setHeader('Retry-After', String(WINDOW_MINUTES * 60));
    return send(res, 429, {
      error:
        'That is a few enquiries in a short time. Please give us a little while to reply before sending another.',
    });
  }

  const insert = await fetch(`${env.url}/rest/v1/contact_enquiries`, {
    method: 'POST',
    headers: { ...env.headers, Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  if (!insert.ok) {
    // Status only, never the body: it echoes the row back, and the row is
    // somebody's name, address and message.
    console.error(`[enquiry] stage=insert supabase_status=${insert.status}`);
    return send(res, 502, {
      error: 'We could not record that just now. Please try again.',
    });
  }

  const rows = (await insert.json()) as Array<{
    id: string;
    created_at: string;
  }>;
  const row = rows[0];
  const receivedAt = row?.created_at ? new Date(row.created_at) : new Date();

  // STORED. Everything from here is best effort and cannot fail the request.
  const desk = deskEmail(payload, receivedAt);
  const ack = acknowledgementEmail(payload);
  const [deskResult, ackResult] = await Promise.all([
    sendMail({
      to: deskInbox(),
      subject: desk.subject,
      html: desk.html,
      text: desk.text,
      // The whole point: hitting Reply in the desk inbox writes to the
      // visitor, not to the noreply sender.
      replyTo: payload.email,
    }),
    sendMail({
      to: payload.email,
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
    }),
  ]);

  if (!deskResult.sent) {
    // Loud, because an enquiry nobody is told about is the failure that
    // matters. The row is safe; someone has to go and read it.
    console.error(
      `[enquiry] stage=notify id=${row?.id ?? 'unknown'} reason=${deskResult.reason}`
    );
  }

  return send(res, 201, {
    id: row?.id ?? null,
    // The page reads this and only promises a confirmation email when one
    // actually went out.
    acknowledgement_sent: ackResult.sent,
  });
}
