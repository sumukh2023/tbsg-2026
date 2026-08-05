/**
 * POST /api/partner-interest — records a sponsor Expression of Interest and
 * notifies the desk.
 *
 * Same contract, same order and largely the same shape as /api/enquiry:
 * VALIDATE, then STORE, then email. The row is the record; the two emails are
 * a courtesy on top of it. A Resend outage, a missing key or a bounced
 * address costs a notification and never the approach itself — and the
 * response says honestly whether the acknowledgement went, so the page never
 * promises an email that was not sent.
 *
 * The desk address is NOT a constant here. It comes from `deskInbox()` in
 * `_email.ts`, which is the single place the whole site reads it from.
 *
 * Setup: supabase/migrations/20260805_partner_interest.sql, SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY, and (for the emails) RESEND_API_KEY and
 * RESEND_FROM. See docs/PARTNERS.md.
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
  escapeHtml,
  escapeParagraph,
  sendMail,
} from './_email.js';
import {
  DOCUMENT_TYPES,
  describeDocument,
  documentInfo,
  documentPath,
  documentToken,
  documentTokenValid,
  humanSize,
  MAX_DOCUMENT_BYTES,
  removeDocument,
  signDownload,
  signUpload,
} from './_storage.js';

/** Stored value -> the words a human reads. Kept together so they cannot drift. */
const ORGANISATION_TYPES = {
  corporate: 'Corporate',
  'small-business': 'Small Business',
  educational: 'Educational Institution',
  ngo: 'NGO',
  startup: 'Startup',
  individual: 'Individual',
  other: 'Other',
} as const;
type OrganisationType = keyof typeof ORGANISATION_TYPES;

/** The real sponsorship structure, not Gold/Silver/Bronze. */
const SPONSORSHIP_INTERESTS = {
  'powered-by': 'Powered By',
  'co-powered-by': 'Co-powered By',
  'event-organised-by': 'Event Organised By',
  undecided: 'Not sure yet',
} as const;
type SponsorshipInterest = keyof typeof SPONSORSHIP_INTERESTS;

/* -------------------------------------------------------------------- */
/*  Rate limiting                                                        */
/*                                                                       */
/*  Two windows against the table itself, so there is no second table to  */
/*  keep and no in-memory counter that a serverless function would lose   */
/*  between invocations.                                                 */
/* -------------------------------------------------------------------- */
const WINDOW_MINUTES = 30;
/** Per address. An organisation does not need to approach twice in half an hour. */
const MAX_PER_EMAIL = 2;
/** Per source, higher: a shared office address is one IP for everyone in it. */
const MAX_PER_IP = 5;
/** The same organisation and the same proposal, moments ago: a double submit. */
const DUPLICATE_MINUTES = 10;

/** ₹100 crore. Not a real ceiling — a guard against a pasted phone number. */
const MAX_ESTIMATED_VALUE = 1_000_000_000;

type Payload = {
  organisation_name: string;
  contact_person: string;
  designation: string | null;
  organisation_type: OrganisationType;
  website: string | null;
  email: string;
  mobile: string;
  office_phone: string | null;
  sponsorship_interest: SponsorshipInterest;
  estimated_value: number | null;
  proposal: string | null;
  marketing_opt_in: boolean;
  privacy_accepted: true;
  privacy_accepted_at: string;
  status: 'new';
  ip_hash: string | null;
  /* The attachment, if there is one. Filled in by the handler AFTER reading
     the object back out of Storage — `validate` cannot set these, because
     nothing the client says about its own file is trusted. */
  document_name: string | null;
  document_path: string | null;
  document_size: number | null;
  document_type: string | null;
};

/**
 * A website typed by a human is "acme.com" as often as it is a URL. Given
 * something that plausibly names a host, this makes it a real https URL so
 * the desk can click it; given anything else it returns null rather than
 * storing junk. It never accepts a scheme other than http(s) — `javascript:`
 * in a field that later becomes an href is exactly the shape of a stored XSS.
 */
function normaliseWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // A host with no dot is not a public website; it is usually a typo.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
  return url.toString().slice(0, 300);
}

/**
 * Free text that must survive as PARAGRAPHS. `cleanText` collapses all
 * whitespace, which would flatten a proposal into one line, so this strips
 * control characters, normalises line endings and caps runs of blank lines
 * while leaving the shape of what was written intact.
 */
function cleanProse(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- stripping control chars is the point
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
  return cleaned || null;
}

function validate(
  body: Record<string, unknown>,
  ipHash: string | null
): Payload | string {
  const organisation_name = cleanText(body.organisation_name, 160);
  if (!organisation_name || organisation_name.length < 2) {
    return 'An organisation name is required.';
  }

  const contact_person = cleanText(body.contact_person, 120);
  if (!contact_person || contact_person.length < 2) {
    return 'A contact person is required.';
  }

  const organisation_type = (
    typeof body.organisation_type === 'string' ? body.organisation_type : ''
  ) as OrganisationType;
  if (!(organisation_type in ORGANISATION_TYPES)) {
    return 'Choose the kind of organisation this is.';
  }

  const email = cleanText(body.email, 160)?.toLowerCase() ?? null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'A valid email address is required.';
  }

  const mobile = cleanText(body.mobile, 16)?.replace(/[\s-]/g, '') ?? null;
  if (!mobile || !/^(\+?91)?[6-9]\d{9}$/.test(mobile)) {
    return 'A 10-digit Indian mobile number is required.';
  }

  // A landline, a switchboard or an extension. Deliberately looser than the
  // mobile rule: office numbers are not one shape in India.
  let office_phone: string | null = null;
  const rawOffice = cleanText(body.office_phone, 24)?.replace(/\s/g, '') ?? null;
  if (rawOffice) {
    if (!/^[+\d][\d\-()]{5,23}$/.test(rawOffice)) {
      return 'That office number does not look right.';
    }
    office_phone = rawOffice;
  }

  const sponsorship_interest = (
    typeof body.sponsorship_interest === 'string'
      ? body.sponsorship_interest
      : ''
  ) as SponsorshipInterest;
  if (!(sponsorship_interest in SPONSORSHIP_INTERESTS)) {
    return 'Choose which kind of partnership interests you.';
  }

  // Optional, and it arrives as whatever was typed: "5,00,000", "5 lakh",
  // "₹500000". Only the digits are kept; anything that leaves no digits is
  // treated as "not answered" rather than as an error, because this field is
  // explicitly allowed to be left blank.
  let estimated_value: number | null = null;
  const rawValue =
    typeof body.estimated_value === 'number'
      ? String(body.estimated_value)
      : typeof body.estimated_value === 'string'
        ? body.estimated_value
        : '';
  const digits = rawValue.replace(/[^\d]/g, '');
  if (digits) {
    const parsed = Number(digits);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_ESTIMATED_VALUE) {
      return 'That estimated value does not look right.';
    }
    estimated_value = parsed;
  }

  if (body.privacy_accepted !== true) {
    return 'The Privacy Policy must be accepted.';
  }

  return {
    organisation_name,
    contact_person,
    designation: cleanText(body.designation, 120),
    organisation_type,
    website: normaliseWebsite(cleanText(body.website, 300)),
    email,
    mobile,
    office_phone,
    sponsorship_interest,
    estimated_value,
    proposal: cleanProse(body.proposal, 4000),
    marketing_opt_in: body.marketing_opt_in === true,
    privacy_accepted: true,
    // Taken HERE, server-side, so what is stored is when the server accepted
    // it rather than whatever a client claimed.
    privacy_accepted_at: new Date().toISOString(),
    status: 'new',
    ip_hash: ipHash,
    document_name: null,
    document_path: null,
    document_size: null,
    document_type: null,
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
    `${env.url}/rest/v1/partner_interest?select=id&created_at=gte.${since}&${filter}`,
    { headers: { ...env.headers, Prefer: 'count=exact' } }
  );
  if (!response.ok) {
    console.error(
      `[partner] stage=ratelimit supabase_status=${response.status}`
    );
    // A failed COUNT must not become a closed door. Fail open: the worst case
    // is one extra approach, and the alternative is turning away a sponsor
    // because a read went wrong.
    return null;
  }
  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : null;
}

/** Same organisation, same address, same intent, moments ago: a double click. */
async function findRecentDuplicate(
  env: Env,
  payload: Payload
): Promise<string | null> {
  const since = new Date(Date.now() - DUPLICATE_MINUTES * 60_000).toISOString();
  const url =
    `${env.url}/rest/v1/partner_interest?select=id&created_at=gte.${since}` +
    `&email=eq.${encodeURIComponent(payload.email)}` +
    `&organisation_name=eq.${encodeURIComponent(payload.organisation_name)}` +
    `&sponsorship_interest=eq.${encodeURIComponent(payload.sponsorship_interest)}` +
    `&limit=1`;
  const response = await fetch(url, { headers: env.headers });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

/** ₹5,00,000 rather than ₹500,000: this is an Indian site. */
function rupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/* -------------------------------------------------------------------- */
/*  The two messages                                                     */
/* -------------------------------------------------------------------- */

/**
 * The attachment, as a block in an email.
 *
 * `link` is a SIGNED, EXPIRING url or nothing. Never a public one: the bucket
 * is private and stays private, so if signing failed the email says the
 * document is on file rather than linking somewhere that will 400. Losing a
 * link costs a click in the Supabase dashboard; making the bucket public to
 * avoid that would cost a stranger's company deck being world-readable.
 */
function documentBlock(payload: Payload, link: string | null): string {
  if (!payload.document_name) return '';
  const size = payload.document_size ? ` · ${humanSize(payload.document_size)}` : '';
  const line = link
    ? `<a href="${escapeHtml(link)}" style="color:#9a4a28;">${escapeHtml(payload.document_name)}</a>${escapeHtml(size)}
       <br /><span style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8b7f6f;">
         This link expires in 30 days.
       </span>`
    : `${escapeHtml(payload.document_name)}${escapeHtml(size)}
       <br /><span style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8b7f6f;">
         Held in the partner documents bucket.
       </span>`;
  return `<div style="height:1px;background:#e4dbcb;margin:24px 0;"></div>
    <p style="margin:0 0 8px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b7f6f;">
      Attachment
    </p>
    <p style="margin:0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#241d16;">${line}</p>`;
}

function documentLines(payload: Payload, link: string | null): string[] {
  if (!payload.document_name) return [];
  const size = payload.document_size ? ` (${humanSize(payload.document_size)})` : '';
  return [
    '',
    'Attachment',
    '----------',
    `${payload.document_name}${size}`,
    ...(link ? [link, 'This link expires in 30 days.'] : []),
  ];
}

function deskEmail(payload: Payload, receivedAt: Date, link: string | null) {
  const stamp = receivedAt.toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const proposal = payload.proposal
    ? `<div style="height:1px;background:#e4dbcb;margin:24px 0;"></div>
       <p style="margin:0 0 8px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b7f6f;">
         Proposal
       </p>
       <div style="font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#241d16;">
         ${escapeParagraph(payload.proposal)}
       </div>`
    : '';

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Organisation', payload.organisation_name)}
      ${detailRow('Type', ORGANISATION_TYPES[payload.organisation_type])}
      ${detailRow('Website', payload.website ?? 'Not given')}
      ${detailRow('Contact', payload.contact_person)}
      ${detailRow('Designation', payload.designation ?? 'Not given')}
      ${detailRow('Email', payload.email)}
      ${detailRow('Mobile', payload.mobile)}
      ${detailRow('Office', payload.office_phone ?? 'Not given')}
      ${detailRow('Interest', SPONSORSHIP_INTERESTS[payload.sponsorship_interest])}
      ${detailRow(
        'Estimated value',
        payload.estimated_value === null
          ? 'Not stated'
          : rupees(payload.estimated_value)
      )}
      ${detailRow('Updates opt-in', payload.marketing_opt_in ? 'Yes' : 'No')}
      ${detailRow('Received', `${stamp} IST`)}
    </table>
    ${proposal}
    ${documentBlock(payload, link)}`;

  return {
    subject: `[Partner Interest] ${payload.organisation_name}`,
    html: emailShell({
      heading: 'New Expression of Interest',
      intro: `${payload.contact_person} at ${payload.organisation_name} would like to partner with Flash @ Brigade. Replying to this email goes straight back to them.`,
      body,
      footnote:
        'Sent automatically by the Flash @ Brigade partner interest form.',
    }),
    text: [
      `New Expression of Interest — ${payload.organisation_name}`,
      '',
      `Organisation:    ${payload.organisation_name}`,
      `Type:            ${ORGANISATION_TYPES[payload.organisation_type]}`,
      `Website:         ${payload.website ?? 'Not given'}`,
      `Contact:         ${payload.contact_person}`,
      `Designation:     ${payload.designation ?? 'Not given'}`,
      `Email:           ${payload.email}`,
      `Mobile:          ${payload.mobile}`,
      `Office:          ${payload.office_phone ?? 'Not given'}`,
      `Interest:        ${SPONSORSHIP_INTERESTS[payload.sponsorship_interest]}`,
      `Estimated value: ${
        payload.estimated_value === null
          ? 'Not stated'
          : rupees(payload.estimated_value)
      }`,
      `Updates opt-in:  ${payload.marketing_opt_in ? 'Yes' : 'No'}`,
      `Received:        ${stamp} IST`,
      ...(payload.proposal
        ? ['', 'Proposal', '--------', payload.proposal]
        : []),
      ...documentLines(payload, link),
      '',
      'Replying to this email goes straight back to the sender.',
    ].join('\n'),
  };
}

function acknowledgementEmail(payload: Payload, link: string | null) {
  const body = `
    <p style="margin:0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#241d16;">
      A member of the organising team will be in touch to talk it through.
      There is no need to write again in the meantime.
    </p>
    <div style="height:1px;background:#e4dbcb;margin:24px 0;"></div>
    <p style="margin:0 0 8px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b7f6f;">
      What you sent us
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Organisation', payload.organisation_name)}
      ${detailRow('Interest', SPONSORSHIP_INTERESTS[payload.sponsorship_interest])}
    </table>
    ${documentBlock(payload, link)}`;

  return {
    subject: 'We have your Expression of Interest',
    html: emailShell({
      heading: 'Thank you for your interest',
      intro: `Hello ${payload.contact_person}, we have the Expression of Interest from ${payload.organisation_name} and it is with the team.`,
      body,
      footnote:
        'This is an automatic acknowledgement from Flash @ Brigade 2026. You can reply to it.',
    }),
    text: [
      `Hello ${payload.contact_person},`,
      '',
      `We have the Expression of Interest from ${payload.organisation_name}`,
      'and it is with the team. A member of the organising team will be in',
      'touch to talk it through.',
      '',
      `Organisation: ${payload.organisation_name}`,
      `Interest:     ${SPONSORSHIP_INTERESTS[payload.sponsorship_interest]}`,
      ...documentLines(payload, link),
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

  /* ------------------------------------------------------------------ *
   * ?action=upload — hand back a one-off URL for the attachment.
   *
   * A SECOND ROUTE WOULD HAVE BEEN CLEANER AND THERE IS NO ROOM FOR ONE.
   * `api/` holds twelve functions and the Vercel Hobby plan allows twelve;
   * a thirteenth file does not deploy, it fails the build. So the upload
   * hangs off the route it belongs to, behind a parameter, rather than
   * costing the project a function it does not have.
   * ------------------------------------------------------------------ */
  if (req.query?.action === 'upload') {
    const env = supabaseEnv('partner-interest');
    if (!env) {
      return send(res, 503, {
        error: 'Attachments are not configured yet. Please try later.',
      });
    }
    const claim = describeDocument(body.filename, body.size);
    if (typeof claim === 'string') return send(res, 422, { error: claim });

    const path = documentPath(claim.safeName);
    const uploadUrl = await signUpload(env, path);
    if (!uploadUrl) {
      return send(res, 502, {
        error: 'We could not prepare the upload just now. Please try again.',
      });
    }
    return send(res, 200, {
      upload_url: uploadUrl,
      path,
      // Proves, at submit time, that this path is one WE issued.
      token: await documentToken(path),
      // The browser must PUT with this exact type. It is derived from the
      // extension here rather than taken from the file, because browsers
      // report .doc and .ppt as application/octet-stream often enough that
      // the claim is not worth having.
      content_type: claim.contentType,
      max_bytes: MAX_DOCUMENT_BYTES,
    });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  // Hashed immediately. The address itself is never stored or logged.
  const ipHash = rawIp ? await sha256Hex(rawIp) : null;

  const payload = validate(body, ipHash);
  if (typeof payload === 'string') return send(res, 422, { error: payload });

  const env = supabaseEnv('partner-interest');
  if (!env) {
    return send(res, 503, {
      error: 'The partner form is not configured yet. Please try later.',
    });
  }

  /* The attachment the browser says it uploaded. Nothing here is believed
     yet — this is only the CLAIM. It is picked up before the refusals below
     so that a request which gets turned away can take its orphaned object
     with it instead of leaving a stranger's file in the bucket forever. */
  const claimed =
    body.document && typeof body.document === 'object'
      ? (body.document as Record<string, unknown>)
      : null;
  const claimedPath =
    typeof claimed?.path === 'string' && claimed.path.length <= 300
      ? claimed.path
      : null;
  const claimIsOurs =
    claimedPath !== null && (await documentTokenValid(claimedPath, claimed?.token));
  /** Drop the uploaded object on any path that does not end in a stored row. */
  const discard = async () => {
    if (claimIsOurs && claimedPath) await removeDocument(env, claimedPath);
  };

  // A double click, or a page restored from the back/forward cache and
  // submitted again. Answer as though it worked, because from the sender's
  // point of view it did: their approach is already with us.
  const duplicate = await findRecentDuplicate(env, payload);
  if (duplicate) {
    await discard();
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
    await discard();
    res.setHeader('Retry-After', String(WINDOW_MINUTES * 60));
    return send(res, 429, {
      error:
        'We already have an Expression of Interest from you. Give us a little while to come back to you before sending another.',
    });
  }

  /* ------------------------------------------------------------------ *
   * The attachment, verified.
   *
   * The size and the content type stored on the row are read back OUT OF
   * STORAGE, not taken from what the browser announced. That is the whole
   * reason this step exists: everything before it is a claim, and a claim
   * about a file is exactly the thing that must not become a database
   * record. An object that is not there, is too big, or is not one of the
   * five accepted types is refused and deleted, and the approach itself is
   * refused with it — silently dropping the attachment would tell the
   * sender their deck was received when it was not.
   * ------------------------------------------------------------------ */
  if (claimedPath) {
    if (!claimIsOurs) {
      console.error('[partner] stage=document reason=bad_token');
      return send(res, 422, {
        error: 'That attachment could not be verified. Please attach it again.',
      });
    }
    const info = await documentInfo(env, claimedPath);
    if (!info) {
      return send(res, 422, {
        error: 'The attachment did not finish uploading. Please attach it again.',
      });
    }
    const accepted: string[] = Object.values(DOCUMENT_TYPES);
    if (info.size > MAX_DOCUMENT_BYTES || !accepted.includes(info.contentType)) {
      console.error(
        `[partner] stage=document reason=rejected size=${info.size} type=${info.contentType}`
      );
      await removeDocument(env, claimedPath);
      return send(res, 422, {
        error:
          'That attachment is not a PDF, Word or PowerPoint document under 10 MB.',
      });
    }
    payload.document_path = claimedPath;
    payload.document_size = info.size;
    payload.document_type = info.contentType;
    // The name a human sees is the one they gave it, cleaned but not
    // mangled into the ASCII the storage path had to be.
    payload.document_name =
      cleanText(claimed?.name, 200) ?? claimedPath.split('/').pop() ?? 'Attachment';
  }

  const insert = await fetch(`${env.url}/rest/v1/partner_interest`, {
    method: 'POST',
    headers: { ...env.headers, Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  if (!insert.ok) {
    // Status only, never the body: it echoes the row back, and the row names
    // a company, a person and what they are willing to spend.
    console.error(`[partner] stage=insert supabase_status=${insert.status}`);
    await discard();
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
  // Signed once and shared by both messages: it is the same document, and
  // two signatures would mean two links to expire and two to revoke.
  const link = payload.document_path
    ? await signDownload(env, payload.document_path)
    : null;
  const desk = deskEmail(payload, receivedAt, link);
  const ack = acknowledgementEmail(payload, link);
  const [deskResult, ackResult] = await Promise.all([
    sendMail({
      to: deskInbox(),
      subject: desk.subject,
      html: desk.html,
      text: desk.text,
      // The whole point: hitting Reply in the desk inbox writes to the
      // organisation, not to the noreply sender.
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
    // Loud, because a sponsor nobody is told about is the failure that
    // matters. The row is safe; someone has to go and read it.
    console.error(
      `[partner] stage=notify id=${row?.id ?? 'unknown'} reason=${deskResult.reason}`
    );
  }

  return send(res, 201, {
    id: row?.id ?? null,
    // The page reads this and only promises a confirmation email when one
    // actually went out.
    acknowledgement_sent: ackResult.sent,
  });
}
