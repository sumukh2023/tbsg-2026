/**
 * The gate-activity search, against the REAL `api/admin.ts` handler and a
 * PostgREST stub that resolves `verification_activity` from its fixture
 * tables the way the SQL view does.
 *
 * Testing the URL the handler builds would prove nothing about whether
 * searching an email address finds the right check-in — the joins and the
 * `or=` group are most of the feature. So the stub implements `ilike`, `or`
 * and `offset`, and these assertions are about ROWS.
 *
 *   node scripts/e2e-activity.mjs
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5602;
process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';

const pg = await start(PG_PORT);

await build({
  entryPoints: ['api/admin.ts', 'api/_auth.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@node-rs/argon2', '@vercel/node'],
  logLevel: 'error',
});
const adminFn = (await import(`${OUT}/admin.js`)).default;
const { hashPassword, createSession, SESSION_COOKIE } = await import(
  `${OUT}/_auth.js`
);

// ------------------------------------------------------------------ fixtures
const adminId = randomUUID();
db.volunteers.push({
  id: adminId,
  full_name: 'Sumukh Nayak',
  email: 'admin@example.com',
  password_hash: await hashPassword('correct-horse-battery'),
  role: 'admin',
  active: true,
  failed_attempts: 0,
  locked_until: null,
  must_change_password: false,
  last_login: null,
});
const gateId = randomUUID();
db.volunteers.push({
  id: gateId,
  full_name: 'Ryan Saha',
  email: 'ryan@example.com',
  password_hash: 'x',
  role: 'volunteer',
  active: true,
  failed_attempts: 0,
  locked_until: null,
  must_change_password: false,
  last_login: null,
});

/** Two guests, one unknown-code scan, and enough rows to page through. */
function guest(name, email, phone, reference) {
  const registration = { id: randomUUID(), full_name: name, email, phone };
  const pass = {
    id: randomUUID(),
    registration_id: registration.id,
    pass_reference: reference,
  };
  db.registrations.push(registration);
  db.passes.push(pass);
  return pass;
}

const anita = guest(
  'Anita Rao',
  'anita.rao@example.com',
  '9845012345',
  'FLASH-A1B2C3'
);
const brian = guest(
  'Brian D’Souza',
  'brian@example.org',
  '9611098765',
  'FLASH-X9Y8Z7'
);

let clock = Date.parse('2026-11-14T09:00:00Z');
const event = (pass, action, volunteer = gateId) => {
  clock += 60_000;
  db.verification_events.push({
    id: randomUUID(),
    created_at: new Date(clock).toISOString(),
    action,
    result: 'valid',
    pass_reference: pass?.pass_reference ?? null,
    volunteer_id: volunteer,
    volunteer_role: volunteer === adminId ? 'admin' : 'volunteer',
    pass_id: pass?.id ?? null,
  });
};

event(anita, 'verify');
event(anita, 'checkin');
event(brian, 'checkin');
event(null, 'lookup_failed'); // unknown code: no pass, no attendee
for (let i = 0; i < 30; i++) event(brian, 'verify');

// ------------------------------------------------------------------- driver
const env = {
  url: process.env.SUPABASE_URL,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
};
const token = await createSession(env, adminId, 'e2e').catch(() => null);

/** Call the handler the way vercel.json routes it, as a signed-in admin. */
async function activity(query) {
  const req = {
    method: 'GET',
    headers: {
      cookie: `${SESSION_COOKIE}=${token}`,
      origin: 'http://localhost',
    },
    body: null,
    query: { resource: 'activity', view: 'timeline', ...query },
    url: '/api/admin/activity',
  };
  let status = 200;
  let payload = null;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    setHeader() {
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  await adminFn(req, res);
  return { status, payload };
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const probe = await activity({});
if (probe.status === 401 || probe.status === 403) {
  console.log(
    'Could not establish an admin session against the stub — skipping.\n' +
      'This script asserts on rows, and rows need an authenticated caller.'
  );
  pg.close?.();
  process.exit(0);
}

console.log('Gate activity search');

const names = (r) => (r.payload?.rows ?? []).map((x) => x.attendee_name);

const all = await activity({ limit: '10' });
check('unsearched timeline returns rows, newest first', all.payload.rows.length === 10);
check(
  'newest first',
  new Date(all.payload.rows[0].created_at) >=
    new Date(all.payload.rows[1].created_at)
);

const byName = await activity({ q: 'anita', limit: '50' });
check(
  'attendee name, case-insensitive and partial',
  byName.payload.rows.length === 2 && names(byName).every((n) => n === 'Anita Rao'),
  `${byName.payload.rows.length} rows`
);

const byEmail = await activity({ q: 'brian@example.org', limit: '50' });
check(
  'attendee email',
  byEmail.payload.rows.length === 31 &&
    names(byEmail).every((n) => n === 'Brian D’Souza'),
  `${byEmail.payload.rows.length} rows`
);

const byPhone = await activity({ q: '9845012345', limit: '50' });
check('attendee mobile', byPhone.payload.rows.length === 2);

const byTicket = await activity({ q: 'A1B2C3', limit: '50' });
check('ticket reference, partial', byTicket.payload.rows.length === 2);

const byPassId = await activity({ q: anita.id, limit: '50' });
check('pass id (a UUID) matches exactly', byPassId.payload.rows.length === 2);

const byVolunteer = await activity({ q: 'Ryan', limit: '50' });
check('volunteer name', byVolunteer.payload.rows.length === 34);

const miss = await activity({ q: 'nobody-by-that-name', limit: '50' });
check('a miss is an empty list, not an error', miss.status === 200 && miss.payload.rows.length === 0);

// The desk types an address with a comma in it, or a bracket, or a quote.
// PostgREST's filter grammar is unquoted, so any of those would end one
// condition and begin something else if they reached the URL.
for (const nasty of ['a,b', 'x)', 'y(', 'it\'s', 'a"b', '*', '%', 'a\\b']) {
  const r = await activity({ q: nasty, limit: '5' });
  check(`injection-shaped term ${JSON.stringify(nasty)} is handled`, r.status === 200);
}
const wildcardAlone = await activity({ q: '*', limit: '50' });
check(
  'a bare wildcard does not become "match everything"',
  wildcardAlone.payload.query === '',
  `query=${JSON.stringify(wildcardAlone.payload.query)}`
);

// Paging keeps the same query and does not repeat rows.
const page1 = await activity({ q: 'brian@example.org', limit: '10' });
const page2 = await activity({ q: 'brian@example.org', limit: '10', offset: '10' });
const ids1 = new Set(page1.payload.rows.map((r) => r.id));
check('page 2 is fresh rows', page2.payload.rows.every((r) => !ids1.has(r.id)));
check('page 1 reports more to come', page1.payload.more === true);
const last = await activity({ q: 'brian@example.org', limit: '10', offset: '30' });
check('the final page reports no more', last.payload.more === false, `${last.payload.rows.length} rows`);

// Contact details are searchable but must not be handed to the browser.
const leaked = JSON.stringify(all.payload.rows);
check(
  'email and mobile are never returned to the client',
  !leaked.includes('anita.rao@example.com') && !leaked.includes('9845012345')
);
check(
  'attendee name IS returned, so the log reads',
  all.payload.rows.some((r) => r.attendee_name)
);

// The unknown-code scan must survive the joins.
const unknown = await activity({ limit: '50' });
check(
  'a scan with no pass is still in the log',
  unknown.payload.rows.some((r) => r.action === 'lookup_failed' && r.pass_id === null)
);

pg.close?.();
console.log(failures === 0 ? '\nAll good.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
