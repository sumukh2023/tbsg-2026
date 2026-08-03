/**
 * End-to-end test for POST /api/enquiry, running the REAL handler.
 *
 * Only two things are stubbed, and both are stubbed faithfully rather than
 * conveniently: PostgREST (the shared in-memory stub) and Resend (a local
 * HTTP server that records exactly what was posted to it). Everything else —
 * validation, sanitisation, rate limiting, duplicate detection, the email
 * bodies, the Reply-To header — is the shipping code.
 *
 * The point is the things a mock would otherwise paper over: that the row is
 * written BEFORE any email is attempted, that a Resend outage still returns
 * success, that the desk copy replies to the visitor and not to us, and that
 * a message containing HTML cannot escape into either email.
 *
 *   node scripts/e2e-enquiry.mjs
 */
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e-enquiry/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5611;
const RESEND_PORT = 5612;

process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';
process.env.RESEND_API_KEY = 'stub-resend-key';
process.env.RESEND_FROM = 'Flash @ Brigade <noreply@example.test>';
process.env.ENQUIRY_RECIPIENT = 'desk@example.test';

await start(PG_PORT);

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

// Point the email module at the stub without touching its source.
await build({
  entryPoints: ['api/enquiry.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@vercel/node'],
  define: {
    'https://api.resend.com/emails': JSON.stringify(
      `http://localhost:${RESEND_PORT}/emails`
    ),
  },
}).catch(async () => {
  // `define` cannot rewrite a string literal; patch it after bundling instead.
  await build({
    entryPoints: ['api/enquiry.ts'],
    outdir: OUT,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['@vercel/node'],
  });
});

// Rewrite the endpoint constant in the built output.
const { readFileSync, writeFileSync } = await import('node:fs');
const builtPath = `${OUT}enquiry.js`;
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
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
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

const valid = {
  full_name: 'Asha Menon',
  email: 'Asha.Menon@Example.com',
  mobile: '98860 12345',
  subject: 'stall-booking',
  message: 'I would like to run a chaat stall at the mercato. Is space left?',
  marketing_opt_in: true,
  privacy_accepted: true,
};

console.log('\nValidation');
check('rejects a missing name', (await post({ ...valid, full_name: '' })).status === 422);
check('rejects a bad email', (await post({ ...valid, email: 'nope' })).status === 422);
check(
  'rejects a bad mobile',
  (await post({ ...valid, mobile: '12345' })).status === 422
);
check(
  'accepts no mobile at all',
  (await post({ ...valid, mobile: null, email: 'a@b.co' })).status === 201
);
check(
  'rejects an unknown subject',
  (await post({ ...valid, subject: 'wat', email: 'b@b.co' })).status === 422
);
check(
  'rejects a too-short message',
  (await post({ ...valid, message: 'hi', email: 'c@b.co' })).status === 422
);
check(
  'rejects without privacy consent',
  (await post({ ...valid, privacy_accepted: false, email: 'd@b.co' })).status === 422
);
check('rejects a non-POST', (await (async () => {
  let status = 0;
  await handler(
    { method: 'GET', headers: {}, body: {} },
    { status(c) { status = c; return this; }, json() { return this; }, setHeader() {} }
  );
  return { status };
})()).status === 405);

console.log('\nHappy path');
sentMail.length = 0;
db.contact_enquiries.length = 0;
const ok = await post(valid, { 'x-forwarded-for': '203.0.113.9' });
check('returns 201', ok.status === 201, `got ${ok.status}`);
check('reports the acknowledgement was sent', ok.payload?.acknowledgement_sent === true);

const row = db.contact_enquiries[0];
check('stored exactly one row', db.contact_enquiries.length === 1);
check('lower-cased the email', row?.email === 'asha.menon@example.com');
check('stripped the space from the mobile', row?.mobile === '9886012345');
check('stored status new', row?.status === 'new');
check('recorded the opt-in', row?.marketing_opt_in === true);
check('recorded privacy consent server-side', Boolean(row?.privacy_accepted_at));
check('hashed the IP rather than storing it', Boolean(row?.ip_hash) && !String(row?.ip_hash).includes('203.0.113'));

console.log('\nEmails');
check('sent two emails', sentMail.length === 2, `got ${sentMail.length}`);
const desk = sentMail.find((m) => m.to?.[0] === 'desk@example.test');
const ack = sentMail.find((m) => m.to?.[0] === 'asha.menon@example.com');
check('desk copy went to the configured inbox', Boolean(desk));
check('acknowledgement went to the visitor', Boolean(ack));
check(
  'desk subject is the required format',
  desk?.subject === '[Flash Enquiry] Stall Booking – Asha Menon',
  desk?.subject
);
check('acknowledgement subject', ack?.subject === "We've received your enquiry");
check(
  'REPLY-TO on the desk copy is the visitor',
  desk?.reply_to === 'asha.menon@example.com',
  String(desk?.reply_to)
);
check('acknowledgement has no reply-to override', ack?.reply_to === undefined);
// The key belongs in the Authorization header and NOWHERE else. `auth` here
// is the header the stub recorded, so it is excluded from the body check.
check('authorised with a bearer token', desk?.auth === 'Bearer stub-resend-key');
check(
  'the key never appears in a message body',
  !sentMail.some((m) =>
    [m.html, m.text, m.subject, m.from].join(' ').includes('stub-resend-key')
  )
);
for (const field of ['Asha Menon', 'asha.menon@example.com', '9886012345', 'Stall Booking', 'Yes']) {
  check(`desk copy contains ${field}`, desk?.html?.includes(field));
}
check('desk copy has a timestamp', /\d{4}/.test(desk?.html ?? ''));

console.log('\nXSS');
sentMail.length = 0;
db.contact_enquiries.length = 0;
const nasty = await post({
  ...valid,
  email: 'x@b.co',
  full_name: '<img src=x onerror=alert(1)>',
  message: 'Hello <script>alert("pwned")</script> & goodbye\nsecond line',
});
check('still accepted', nasty.status === 201);
const evil = sentMail.find((m) => m.to?.[0] === 'desk@example.test');
check('no raw <script> in the html', !evil?.html?.includes('<script>'));
check('no raw <img onerror in the html', !evil?.html?.includes('<img src=x'));
check('the script tag is escaped', evil?.html?.includes('&lt;script&gt;'));
check('the ampersand is escaped', evil?.html?.includes('&amp;'));
check('newlines became <br />', evil?.html?.includes('<br />'));

console.log('\nDuplicates and rate limiting');
db.contact_enquiries.length = 0;
sentMail.length = 0;
const first = await post({ ...valid, email: 'dupe@b.co' });
const second = await post({ ...valid, email: 'dupe@b.co' });
check('the second identical submit is not stored again', db.contact_enquiries.length === 1);
check('and still answers 200', second.status === 200, `got ${second.status}`);
check('reporting it as a duplicate', second.payload?.duplicate === true);
check('returning the same id', second.payload?.id === first.payload?.id);
check('and does not re-send email', sentMail.length === 2, `${sentMail.length} mails`);

db.contact_enquiries.length = 0;
let limited = null;
for (let i = 0; i < 5; i++) {
  limited = await post({
    ...valid,
    email: 'flood@b.co',
    message: `Message number ${i} which is long enough to pass validation.`,
  });
}
check('rate limits the same address', limited?.status === 429, `got ${limited?.status}`);

console.log('\nResend failure must not lose the enquiry');
db.contact_enquiries.length = 0;
sentMail.length = 0;
resendStatus = 500;
const outage = await post({ ...valid, email: 'outage@b.co' });
check('still returns 201', outage.status === 201, `got ${outage.status}`);
check('the row is stored anyway', db.contact_enquiries.length === 1);
check('and it does NOT claim an email was sent', outage.payload?.acknowledgement_sent === false);
resendStatus = 200;

console.log('\nUnconfigured Resend must not lose the enquiry either');
db.contact_enquiries.length = 0;
delete process.env.RESEND_API_KEY;
const unconfigured = await post({ ...valid, email: 'nokey@b.co' });
check('still returns 201', unconfigured.status === 201, `got ${unconfigured.status}`);
check('the row is stored', db.contact_enquiries.length === 1);
check('and it does NOT claim an email was sent', unconfigured.payload?.acknowledgement_sent === false);
process.env.RESEND_API_KEY = 'stub-resend-key';

console.log(failures ? `\n${failures} FAILED\n` : '\nAll checks passed.\n');
resend.close();
process.exit(failures ? 1 : 0);
