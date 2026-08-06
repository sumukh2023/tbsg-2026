/**
 * End-to-end test for /api/donate, running the REAL handler against the
 * shared PostgREST stub.
 *
 * The subject is the DONOR ROLL that GET now serves, and it has two jobs that
 * pull against each other:
 *
 *   - name everyone who asked to be named, so the acknowledgement wall on Our
 *     Mission is worth having;
 *   - name nobody else, and say nothing else about any of them. A donation
 *     row holds an email address, a mobile number and an amount. None of the
 *     three has any business on a public wall, and the endpoint is
 *     unauthenticated, so "we only render the names" is not a defence: what
 *     matters is what leaves the function.
 *
 *   node scripts/e2e-donate.mjs
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e-donate/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5632;
process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';

const pg = await start(PG_PORT);
db.donations = [];

await build({
  entryPoints: ['api/donate.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@vercel/node'],
  logLevel: 'error',
});
const { default: handler } = await import(`${OUT}donate.js`);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function call(method, body) {
  let status = 0;
  let payload = null;
  const headers = {};
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
  };
  await handler({ method, headers: {}, body, query: {} }, res);
  return { status, payload, headers };
}

let at = Date.now();
const donation = (patch) => {
  at += 1000;
  db.donations.push({
    id: randomUUID(),
    full_name: 'Someone',
    email: 'someone@example.com',
    phone: '9886012345',
    donor_type: 'individual',
    organisation: null,
    amount: 5000,
    recognition_preference: 'public',
    payment_status: 'paid',
    terms_accepted: true,
    created_at: new Date(at).toISOString(),
    ...patch,
  });
};

donation({ full_name: 'Meera Rajagopal' });
donation({ full_name: 'Ravi Shankar', recognition_preference: 'anonymous' });
donation({ full_name: 'Not Paid Yet', payment_status: 'pending' });
donation({ full_name: 'Payment Failed', payment_status: 'failed' });
donation({
  full_name: 'Lakshmi Iyer',
  donor_type: 'corporate',
  organisation: 'Sundaram Textiles',
});
// The same donor giving twice, spelled two ways the second time.
donation({ full_name: 'Meera Rajagopal' });
donation({ full_name: '  meera   RAJAGOPAL ' });
// A corporate donor who named no organisation falls back to the person.
donation({ full_name: 'Anil Kumar', donor_type: 'corporate', organisation: null });

console.log('\nThe roll names the donors who asked to be named');
{
  const { status, payload } = await call('GET');
  check('answers 200', status === 200, `got ${status}`);
  check('a public paid donor is on it', payload.donors.includes('Meera Rajagopal'));
  check(
    'a corporate donor is named by their organisation',
    payload.donors.includes('Sundaram Textiles')
  );
  check(
    'a corporate donor with no organisation falls back to the person',
    payload.donors.includes('Anil Kumar')
  );
  check('oldest gift first', payload.donors[0] === 'Meera Rajagopal', payload.donors[0]);
}

console.log('\nAnd nobody else');
{
  const { payload } = await call('GET');
  const joined = JSON.stringify(payload);
  check('an anonymous donor is NOT on it', !joined.includes('Ravi Shankar'));
  check('an unpaid intent is NOT on it', !joined.includes('Not Paid Yet'));
  check('a failed payment is NOT on it', !joined.includes('Payment Failed'));
  check(
    'the same donor appears once, however they spelled it',
    payload.donors.filter((n) => n.toLowerCase().replace(/\s+/g, ' ').trim() === 'meera rajagopal')
      .length === 1,
    JSON.stringify(payload.donors)
  );
  /* THREE, from eight rows. Meera gave three times and is named once;
     Lakshmi gave as Sundaram Textiles; Anil gave as himself. The other four
     rows are an anonymous donor, an unpaid intent and a failed payment, and
     none of them belongs on a public wall. */
  check('three names from eight rows', payload.donors.length === 3, JSON.stringify(payload.donors));
}

console.log('\nThe roll is a wall of names and NOTHING else');
{
  const { payload } = await call('GET');
  const body = JSON.stringify(payload);
  check('no email address leaves the function', !body.includes('@example.com'));
  check('no mobile number does', !body.includes('9886012345'));
  check('no amount does', !body.includes('5000'));
  check('no donor type does', !/individual|corporate/.test(body));
  check('no row id does', !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(body));
  check(
    'the reply is exactly one key',
    Object.keys(payload).length === 1 && Array.isArray(payload.donors),
    Object.keys(payload).join(',')
  );
  check(
    'every entry is a plain string',
    payload.donors.every((n) => typeof n === 'string')
  );
}

console.log('\nAn unconfigured service shows an empty wall, not an error');
{
  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  const { status, payload } = await call('GET');
  process.env.SUPABASE_URL = url;
  check('still answers 200', status === 200, `got ${status}`);
  check('with no donors', Array.isArray(payload.donors) && payload.donors.length === 0);
}

console.log('\nRecording a donation still works, and is still not public');
{
  const before = db.donations.length;
  const { status, payload } = await call('POST', {
    full_name: 'New Donor',
    email: 'new@example.com',
    phone: '9886012399',
    donor_type: 'individual',
    amount: 2500,
    recognition_preference: 'public',
    terms_accepted: true,
  });
  check('answers 201', status === 201, `${status} ${payload?.error ?? ''}`);
  check('the row is stored', db.donations.length === before + 1);
  const stored = db.donations.at(-1);
  check('as pending, never as paid', stored.payment_status === 'pending', stored.payment_status);

  const roll = await call('GET');
  check(
    'so a brand new gift is NOT on the wall yet',
    !roll.payload.donors.includes('New Donor'),
    JSON.stringify(roll.payload.donors)
  );
}

console.log('\nAnything other than GET or POST is refused');
{
  const { status, headers } = await call('DELETE', {});
  check('answers 405', status === 405, `got ${status}`);
  check('and advertises both verbs', headers.Allow === 'GET, POST', headers.Allow);
}

pg.close?.();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
