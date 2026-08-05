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
import { start, db, storage } from './pgrest-stub.mjs';

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

async function post(body, headers = {}, query = {}) {
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
  // `query` is always present on a real Vercel request. Omitting it here
  // made the harness unfaithful in a way that mattered the moment the route
  // started reading it.
  await handler({ method: 'POST', headers, body, query }, res);
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

/* ==================================================================== *
 *  Supporting documents
 *
 *  The subject here is a single question: does the row describe the file
 *  that is ACTUALLY IN THE BUCKET, or the file the request said it was?
 *  Every case below makes the two disagree and checks which one wins.
 * ==================================================================== */

const PDF = 'application/pdf';

/** Ask the real handler for an upload ticket, the way the browser does. */
const ticketFor = (filename, size) =>
  post({ filename, size }, {}, { action: 'upload' });

/** Put an object in the bucket, as the browser's direct PUT would. */
const putObject = (path, size, mimetype) => {
  storage.objects.push({
    bucket: 'partner-documents',
    name: path,
    size,
    mimetype,
  });
};

console.log('\nAn upload ticket');
{
  const { status, payload } = await ticketFor('Company Profile.pdf', 300_000);
  check('is issued for a real document', status === 200, `got ${status}`);
  check('names a path the SERVER chose', /^[0-9a-f-]{36}\//.test(payload.path));
  check(
    'sanitises the filename into the path',
    payload.path.endsWith('/Company-Profile.pdf'),
    payload.path
  );
  check(
    'declares the type from the EXTENSION, not the browser',
    payload.content_type === PDF
  );
  check('carries a signature over that path', /^[0-9a-f]{64}$/.test(payload.token));

  const zip = await ticketFor('payload.zip', 2048);
  check('an archive is refused', zip.status === 422, `got ${zip.status}`);
  check(
    'and the refusal names the reason',
    /Programs and archives/.test(zip.payload.error ?? '')
  );

  const exe = await ticketFor('setup.exe', 2048);
  check('an executable is refused', exe.status === 422, `got ${exe.status}`);

  const huge = await ticketFor('deck.pdf', 11 * 1024 * 1024);
  check('over 10 MB is refused up front', huge.status === 422, `got ${huge.status}`);

  const traversal = await ticketFor('../../etc/passwd.pdf', 1024);
  check(
    'path traversal cannot escape the generated directory',
    traversal.status === 200 &&
      traversal.payload.path.split('/').length === 2 &&
      !traversal.payload.path.includes('..'),
    traversal.payload.path
  );
}

console.log('\nAn approach with a document attached');
{
  const { payload: ticket } = await ticketFor('Sponsorship Deck.pdf', 240_000);
  putObject(ticket.path, 240_000, PDF);

  const { status, payload } = await post(
    org({ document: { path: ticket.path, token: ticket.token, name: 'Sponsorship Deck.pdf' } })
  );
  check('answers 201', status === 201, `got ${status}`);

  const row = db.partner_interest.at(-1);
  check('the row records the path', row.document_path === ticket.path);
  check('and the name the sender gave it', row.document_name === 'Sponsorship Deck.pdf');
  check('and the size read back FROM STORAGE', row.document_size === 240_000);
  check('and the type read back FROM STORAGE', row.document_type === PDF);
  check('the object is still in the bucket', storage.objects.some((o) => o.name === ticket.path));
  check('and the request succeeded', payload.id === row.id);

  const desk = sentMail.at(-2);
  const ack = sentMail.at(-1);
  const signed = `/object/sign/partner-documents/${ticket.path}`;
  check('the desk copy links the document', desk.html.includes(signed));
  check('the acknowledgement links it too', ack.html.includes(signed));
  check(
    'both links are SIGNED, never public',
    !desk.html.includes('/object/public/') &&
      !ack.html.includes('/object/public/')
  );
  check(
    'and the plain-text parts carry it as well',
    desk.text.includes(signed) && ack.text.includes(signed)
  );
}

console.log('\nA document the server did not issue a place for');
{
  const { payload: ticket } = await ticketFor('deck.pdf', 1024);
  putObject(ticket.path, 1024, PDF);
  const before = db.partner_interest.length;

  const { status, payload } = await post(
    org({ document: { path: ticket.path, token: 'f'.repeat(64), name: 'deck.pdf' } })
  );
  check('is refused', status === 422, `got ${status}`);
  check('with a sentence a human can act on', /attach it again/.test(payload.error ?? ''));
  check('and NOTHING is stored', db.partner_interest.length === before);
}

console.log('\nA path with no object behind it');
{
  const { payload: ticket } = await ticketFor('deck.pdf', 1024);
  // Deliberately not uploaded: the browser said it finished and did not.
  const before = db.partner_interest.length;
  const { status, payload } = await post(
    org({ document: { path: ticket.path, token: ticket.token, name: 'deck.pdf' } })
  );
  check('is refused', status === 422, `got ${status}`);
  check(
    'and says the upload did not finish',
    /did not finish uploading/.test(payload.error ?? '')
  );
  check('and NOTHING is stored', db.partner_interest.length === before);
}

console.log('\nAn object whose REAL type is not what was promised');
{
  // The ticket was issued for a PDF. What actually landed is a zip. Only the
  // read-back can catch this, which is exactly why the read-back exists.
  const { payload: ticket } = await ticketFor('deck.pdf', 4096);
  putObject(ticket.path, 4096, 'application/zip');
  const before = db.partner_interest.length;

  const { status } = await post(
    org({ document: { path: ticket.path, token: ticket.token, name: 'deck.pdf' } })
  );
  check('is refused', status === 422, `got ${status}`);
  check('nothing is stored', db.partner_interest.length === before);
  check(
    'and the object is DELETED, not left in the bucket',
    !storage.objects.some((o) => o.name === ticket.path)
  );
}

console.log('\nAn object whose REAL size is over the limit');
{
  const { payload: ticket } = await ticketFor('deck.pdf', 1024);
  putObject(ticket.path, 11 * 1024 * 1024, PDF);
  const before = db.partner_interest.length;

  const { status } = await post(
    org({ document: { path: ticket.path, token: ticket.token, name: 'deck.pdf' } })
  );
  check('the declared size does not save it', status === 422, `got ${status}`);
  check('nothing is stored', db.partner_interest.length === before);
  check(
    'and the object is deleted',
    !storage.objects.some((o) => o.name === ticket.path)
  );
}

console.log('\nA duplicate submit does not leave its upload behind');
{
  const shape = org();
  const first = await ticketFor('deck.pdf', 2048);
  putObject(first.payload.path, 2048, PDF);
  await post({
    ...shape,
    document: { path: first.payload.path, token: first.payload.token, name: 'deck.pdf' },
  });

  const second = await ticketFor('deck.pdf', 2048);
  putObject(second.payload.path, 2048, PDF);
  const { status, payload } = await post({
    ...shape,
    document: { path: second.payload.path, token: second.payload.token, name: 'deck.pdf' },
  });

  check('the second answers 200 as a duplicate', status === 200, `got ${status}`);
  check('and says so', payload.duplicate === true);
  check(
    'the first document is kept',
    storage.objects.some((o) => o.name === first.payload.path)
  );
  check(
    'and the orphan from the second is removed',
    !storage.objects.some((o) => o.name === second.payload.path)
  );
}

console.log('\nAn approach with no document is unchanged');
{
  const { status } = await post(org());
  const row = db.partner_interest.at(-1);
  check('still answers 201', status === 201, `got ${status}`);
  check(
    'and all four document columns are null',
    row.document_path === null &&
      row.document_name === null &&
      row.document_size === null &&
      row.document_type === null
  );
  const ack = sentMail.at(-1);
  check('no Attachment block appears in the email', !ack.html.includes('Attachment'));
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
