/**
 * End-to-end test for POST /api/retrieve, running the REAL handler against
 * the shared PostgREST stub.
 *
 * The subject is the third factor. Retrieval used to need an email and a
 * mobile number; it now needs the name as well, matched LENIENTLY. Those two
 * requirements pull against each other, and both halves have to hold:
 *
 *   - lenient enough that "  priya   MENON " opens Priya Menon's pass, because
 *     a visitor who has proved they know the address, the number and the name
 *     should not be turned away over a double space;
 *   - strict enough that knowing the address and the number is NOT sufficient,
 *     which is the entire reason the field was added.
 *
 * And the refusal must stay the same sentence whichever factor was wrong, or
 * the error message becomes an oracle for enumerating registrations.
 *
 *   node scripts/e2e-retrieve.mjs
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e-retrieve/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5631;
process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';

const pg = await start(PG_PORT);
db.registrations = [];
db.passes = [];

await build({
  entryPoints: ['api/retrieve.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@vercel/node'],
  logLevel: 'error',
});
const { default: handler } = await import(`${OUT}retrieve.js`);

/* ------------------------------------------------------------------ */
const registrationId = randomUUID();
db.registrations.push({
  id: registrationId,
  full_name: 'Priya Menon',
  email: 'priya@example.com',
  phone: '9886012345',
  created_at: new Date().toISOString(),
});
db.passes.push({
  id: randomUUID(),
  registration_id: registrationId,
  status: 'valid',
  verification_token_hash: 'old-hash',
  created_at: new Date().toISOString(),
});

// A second household on the SAME address and number, registered later. Its
// existence is the reason the handler cannot just take the newest row.
const siblingId = randomUUID();
db.registrations.push({
  id: siblingId,
  full_name: 'Arjun Menon',
  email: 'priya@example.com',
  phone: '9886012345',
  created_at: new Date(Date.now() + 1000).toISOString(),
});
db.passes.push({
  id: randomUUID(),
  registration_id: siblingId,
  status: 'valid',
  verification_token_hash: 'old-hash-2',
  created_at: new Date().toISOString(),
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function post(body) {
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
  await handler({ method: 'POST', headers: {}, body, query: {} }, res);
  return { status, payload };
}

const GENERIC = 'Pass not found. Please check the details entered and try again.';
const base = { email: 'priya@example.com', phone: '9886012345' };

console.log('\nThe name is accepted however it is typed');
for (const [label, full_name] of [
  ['exactly as registered', 'Priya Menon'],
  ['all lower case', 'priya menon'],
  ['SHOUTED', 'PRIYA MENON'],
  ['leading and trailing space', '   Priya Menon   '],
  ['a double space inside', 'Priya  Menon'],
  ['a tab inside', 'Priya\tMenon'],
  ['mixed case and loose spacing', '  pRiYa   mEnOn '],
]) {
  const { status, payload } = await post({ ...base, full_name });
  check(label, status === 200 && typeof payload.token === 'string', `${status} ${payload?.error ?? ''}`);
}

console.log('\nAccents fold, so a phone keyboard and a laptop agree');
{
  const id = randomUUID();
  db.registrations.push({
    id,
    full_name: 'José Fernandes',
    email: 'jose@example.com',
    phone: '9886099999',
    created_at: new Date().toISOString(),
  });
  db.passes.push({
    id: randomUUID(),
    registration_id: id,
    status: 'valid',
    verification_token_hash: 'h',
    created_at: new Date().toISOString(),
  });
  const accented = await post({ email: 'jose@example.com', phone: '9886099999', full_name: 'José Fernandes' });
  const plain = await post({ email: 'jose@example.com', phone: '9886099999', full_name: 'jose fernandes' });
  check('as registered, with the accent', accented.status === 200);
  check('typed without the accent', plain.status === 200, `${plain.status}`);
}

console.log('\nBut it is still a real check');
for (const [label, patch] of [
  ['the wrong name is refused', { full_name: 'Rohan Desai' }],
  ['a missing name is refused', { full_name: '' }],
  ['no name field at all is refused', {}],
  ['a partial name is refused', { full_name: 'Priya' }],
  ['a name with letters removed is refused', { full_name: 'PriyaMenon' }],
  ['the right name, wrong email', { full_name: 'Priya Menon', email: 'someone@example.com' }],
  ['the right name, wrong number', { full_name: 'Priya Menon', phone: '9000000000' }],
]) {
  const body = { ...base, ...patch };
  if ('full_name' in patch && patch.full_name === undefined) delete body.full_name;
  const { status, payload } = await post(body);
  check(label, status === 404, `got ${status}`);
  check('  and says nothing about WHICH field was wrong', payload?.error === GENERIC, payload?.error);
}

console.log('\nThe right household member gets the right pass');
{
  const { status, payload } = await post({ ...base, full_name: 'arjun  MENON' });
  check('the sibling on the same email and number resolves', status === 200, `got ${status}`);
  const rotated = db.passes.find((p) => p.registration_id === siblingId);
  check(
    "and it is the SIBLING's pass that was rotated",
    Boolean(payload.token) && rotated.verification_token_hash !== 'old-hash-2'
  );
}

console.log('\nThe token is rotated on every retrieval');
{
  const before = db.passes.find((p) => p.registration_id === registrationId).verification_token_hash;
  const a = await post({ ...base, full_name: 'Priya Menon' });
  const mid = db.passes.find((p) => p.registration_id === registrationId).verification_token_hash;
  const bnd = await post({ ...base, full_name: 'Priya Menon' });
  const after = db.passes.find((p) => p.registration_id === registrationId).verification_token_hash;
  check('the stored hash changes', before !== mid && mid !== after);
  check('and a fresh token comes back each time', a.payload.token !== bnd.payload.token);
}

pg.close?.();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
