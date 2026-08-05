/**
 * End-to-end test for POST /api/partner-interest, running the REAL handler.
 *
 * Only two things are stubbed, and both faithfully rather than conveniently:
 * PostgREST (the shared in-memory stub) and Resend (a local HTTP server that
 * records exactly what was posted to it). Everything else — validation,
 * sanitisation, website normalisation, rate limiting, duplicate detection,
 * the email bodies, the Reply-To header — is the shipping code.
 *
 * The point is what a mock would paper over: that the row is written BEFORE
 * any email is attempted, that a Resend outage still returns success and
 * still says honestly that no acknowledgement went, that the desk copy
 * replies to the ORGANISATION and not to us, that a proposal containing HTML
 * cannot escape into either email, and that `javascript:` in the website
 * field never survives to become an href.
 *
 *   node scripts/e2e-partner.mjs
 */
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e-partner/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5621;
const RESEND_PORT = 5622;

process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';
process.env.RESEND_API_KEY = 'stub-resend-key';
process.env.RESEND_FROM = 'Flash @ Brigade <noreply@example.test>';
process.env.ENQUIRY_RECIPIENT = 'desk@example.test';

const pg = await start(PG_PORT);
db.partner_interest = [];

/* ------------------------------------------------------------------ */
/*  A Resend stand-in that records, and can be told to fail.           */
/* ------------------------------------------------------------------ */
const sentMail = [];
let resendStatus = 200;
const resend = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (resendStatus !== 200) {
      res.writeHead(resendStatus, { 'Content-Type': 'application/json' });
      res.end('{"message":"stub failure"}');
      return;
    }
    sentMail.push({
      auth: req.headers.authorization,
      ...JSON.parse(body || '{}'),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: `mail_${sentMail.length}` }));
  });
});
await new Promise((r) => resend.listen(RESEND_PORT, r));

await build({
  entryPoints: ['api/partner-interest.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@vercel/node'],
  logLevel: 'error',
});

// Point the built bundle at the Resend stand-in without touching the source.
const builtPath = `${OUT}partner-interest.js`;
writeFileSync(
  builtPath,
  readFileSync(builtPath, 'utf8').replace(
    'https://api.resend.com/emails',
    `http://localhost:${RESEND_PORT}/emails`
  )
);
const { default: handler } = await import(builtPath);

/* ------------------------------------------------------------------ */

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  );
  if (!ok) failures++;
};

async function post(body, headers = {}) {
  let status = 0;
  let payload = null;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
    setHeader() {},
  };
  await handler({ method: 'POST', headers, body }, res);
  return { status, payload };
}

/** A fresh organisation each time, so the rate limiter is not the subject. */
let n = 0;
const org = (overrides = {}) => {
  n += 1;
  return {
    organisation_name: `Acme Number ${n}`,
    contact_person: 'Rohan Desai',
    designation: 'Head of Partnerships',
    organisation_type: 'corporate',
    website: 'acme.com',
    email: `Rohan.Desai+${n}@Example.COM`,
    mobile: '98860 12345',
    office_phone: '080-41234567',
    sponsorship_interest: 'co-powered-by',
    estimated_value: '2,50,000',
    proposal: 'We would like to sponsor the mercato.\n\nHappy to talk.',
    marketing_opt_in: true,
    privacy_accepted: true,
    ...overrides,
  };
};

console.log('\nA complete Expression of Interest');
{
  const before = db.partner_interest.length;
  const { status, payload } = await post(org());
  check('answers 201', status === 201, `got ${status}`);
  check('stored a row', db.partner_interest.length === before + 1);
  const row = db.partner_interest.at(-1);
  check('email is lower-cased', row.email === `rohan.desai+${n}@example.com`);
  check('mobile is stripped of spaces', row.mobile === '9886012345');
  check(
    'website became an absolute https URL',
    row.website === 'https://acme.com/',
    row.website
  );
  check(
    '"2,50,000" was read as 250000',
    row.estimated_value === 250000,
    String(row.estimated_value)
  );
  check('status starts at new', row.status === 'new');
  check('consent timestamped server-side', Boolean(row.privacy_accepted_at));
  check('paragraph breaks in the proposal survive', row.proposal.includes('\n\n'));
  check('acknowledgement reported as sent', payload.acknowledgement_sent === true);
}

console.log('\nThe two emails');
{
  const desk = sentMail.find((m) => m.to[0] === 'desk@example.test');
  const ack = sentMail.find((m) => m.to[0].startsWith('rohan.desai'));
  check('a desk copy went to the centralised inbox', Boolean(desk));
  check('an acknowledgement went to the organisation', Boolean(ack));
  check(
    'the desk subject is [Partner Interest] Organisation Name',
    desk?.subject === `[Partner Interest] Acme Number ${n}`,
    desk?.subject
  );
  check(
    'replying to the desk copy writes to the organisation',
    desk?.reply_to?.startsWith('rohan.desai'),
    desk?.reply_to
  );
  check(
    'the acknowledgement has no Reply-To of its own',
    ack && !('reply_to' in ack)
  );
  check(
    'the desk copy carries the details the team needs',
    ['Acme Number', 'Rohan Desai', '9886012345', 'Co-powered By', '₹2,50,000'].every(
      (s) => desk?.html?.includes(s)
    )
  );
  check(
    'a text alternative is sent alongside the HTML',
    Boolean(desk?.text) && Boolean(ack?.text)
  );
}

console.log('\nValidation');
{
  const cases = [
    ['no organisation name', { organisation_name: '  ' }],
    ['no contact person', { contact_person: '' }],
    ['unknown organisation type', { organisation_type: 'conglomerate' }],
    ['malformed email', { email: 'rohan@acme' }],
    ['missing mobile', { mobile: '' }],
    ['a landline in the mobile field', { mobile: '08041234567' }],
    ['unknown sponsorship interest', { sponsorship_interest: 'platinum' }],
    ['privacy not accepted', { privacy_accepted: false }],
    ['an absurd estimated value', { estimated_value: '99999999999999' }],
  ];
  for (const [name, patch] of cases) {
    const { status, payload } = await post(org(patch));
    check(`422 for ${name}`, status === 422, `${status} ${payload?.error ?? ''}`);
  }
  const { status } = await post(org({ office_phone: 'ring me' }));
  check('422 for a junk office number', status === 422);
}

console.log('\nOptional fields really are optional');
{
  const { status } = await post(
    org({
      designation: null,
      website: null,
      office_phone: null,
      estimated_value: '',
      proposal: null,
      sponsorship_interest: 'undecided',
      marketing_opt_in: false,
    })
  );
  const row = db.partner_interest.at(-1);
  check('201 with only the required fields', status === 201, `got ${status}`);
  check('estimated value stored as null', row.estimated_value === null);
  check('proposal stored as null', row.proposal === null);
  check('website stored as null', row.website === null);
}

console.log('\nHostile input');
{
  await post(
    org({
      organisation_name: '<script>alert(1)</script> Ltd',
      proposal: 'Look: <img src=x onerror=alert(1)> and <b>bold</b>.',
      website: 'javascript:alert(1)',
    })
  );
  const row = db.partner_interest.at(-1);
  const desk = sentMail.at(-2);
  check(
    'a javascript: website is refused rather than stored',
    row.website === null,
    String(row.website)
  );
  check(
    'no raw <script> reaches the desk email',
    !desk.html.includes('<script>'),
    'escaped'
  );
  check(
    'no raw <img onerror> reaches the desk email',
    !desk.html.includes('<img src=x'),
    'escaped'
  );
  check(
    'the text is still legible after escaping',
    desk.html.includes('&lt;script&gt;') || desk.html.includes('&lt;'),
    'entities present'
  );
}

console.log('\nA double click must not become two approaches');
{
  const body = org();
  const first = await post(body);
  const before = db.partner_interest.length;
  const second = await post(body);
  check('the first is a 201', first.status === 201);
  check('the second is answered 200, not 201', second.status === 200);
  check('the second wrote no row', db.partner_interest.length === before);
  check('and it is flagged as a duplicate', second.payload.duplicate === true);
  check(
    'both answers name the same record',
    first.payload.id === second.payload.id
  );
}

console.log('\nRate limiting');
{
  const email = 'flood@example.test';
  // MAX_PER_EMAIL is 2 in a 30 minute window; each of these is a different
  // organisation, so the duplicate guard is not what stops them.
  let last;
  for (let i = 0; i < 4; i++) {
    last = await post(org({ email, organisation_name: `Flood ${i}` }));
  }
  check('a burst from one address is refused', last.status === 429, `got ${last.status}`);
  check('with a sentence a human can act on', /while/i.test(last.payload.error));
}

console.log('\nA Resend outage costs the email, never the row');
{
  resendStatus = 500;
  const before = db.partner_interest.length;
  const { status, payload } = await post(org({ email: 'outage@example.test' }));
  check('still answers 201', status === 201, `got ${status}`);
  check('the row is stored', db.partner_interest.length === before + 1);
  check(
    'and it does NOT claim an email was sent',
    payload.acknowledgement_sent === false
  );
  resendStatus = 200;
}

console.log('\nUnconfigured Resend must not lose the approach either');
{
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const before = db.partner_interest.length;
  const { status, payload } = await post(org({ email: 'nokey@example.test' }));
  check('still returns 201', status === 201, `got ${status}`);
  check('the row is stored', db.partner_interest.length === before + 1);
  check(
    'and it does NOT claim an email was sent',
    payload.acknowledgement_sent === false
  );
  process.env.RESEND_API_KEY = key;
}

console.log('\nThe API key never leaves the server');
{
  const bodies = sentMail.map((m) => JSON.stringify({ ...m, auth: undefined }));
  check(
    'no message body carries the Resend key',
    bodies.every((b) => !b.includes('stub-resend-key'))
  );
}

resend.close();
pg.close?.();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
