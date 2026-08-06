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
  booking_reference: 'FB2026-AAAAA',
  number_of_passes: 3,
  total_amount: 825,
  payment_status: 'unpaid',
  created_at: new Date(Date.now() - 60000).toISOString(),
});
// Priya's booking holds THREE passes: herself and two guests. This is the
// shape the whole overhaul exists for, and retrieval must return all three.
const PRIYA_PARTY = ['Priya Menon', 'Ananya Rao', 'Kabir Shah'];
PRIYA_PARTY.forEach((attendee_name, i) => {
  db.passes.push({
    id: randomUUID(),
    registration_id: registrationId,
    status: 'valid',
    attendee_name,
    attendee_category: 'other',
    sequence: i + 1,
    verification_token_hash: `old-hash-${i}`,
    created_at: new Date().toISOString(),
  });
});

// A second household on the SAME address and number, registered later. Its
// existence is the reason the handler cannot just take the newest row.
const siblingId = randomUUID();
db.registrations.push({
  id: siblingId,
  full_name: 'Arjun Menon',
  email: 'priya@example.com',
  phone: '9886012345',
  booking_reference: 'FB2026-SSSSS',
  number_of_passes: 1,
  total_amount: 275,
  payment_status: 'unpaid',
  created_at: new Date(Date.now() + 1000).toISOString(),
});
db.passes.push({
  id: randomUUID(),
  registration_id: siblingId,
  status: 'valid',
  attendee_name: 'Arjun Menon',
  attendee_category: 'other',
  sequence: 1,
  verification_token_hash: 'sibling-hash',
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
    Boolean(payload.token) && rotated.verification_token_hash !== 'sibling-hash'
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

console.log('\nRetrieval returns the WHOLE booking, not one pass');
{
  const { status, payload } = await post({ ...base, full_name: 'Priya Menon' });
  check('answers 200', status === 200, `got ${status}`);
  check('three tokens for three attendees', payload.tokens?.length === 3,
    String(payload.tokens?.length));
  check('every token is distinct', new Set(payload.tokens).size === 3);
  check('the legacy single `token` is the first of them',
    payload.token === payload.tokens[0]);
  const hashes = db.passes
    .filter((p) => p.registration_id === registrationId)
    .map((p) => p.verification_token_hash);
  check('EVERY pass was rotated, not just the first',
    hashes.every((h) => !String(h).startsWith('old-hash')));
  check('and no two passes share a token',
    new Set(hashes).size === hashes.length);
}

console.log('\nAny attendee name opens the booking');
for (const [label, full_name] of [
  ['a guest, not the purchaser', 'Ananya Rao'],
  ['the other guest', 'Kabir Shah'],
  ['loosely typed', '  kABIR   shah '],
]) {
  const { status, payload } = await post({ ...base, full_name });
  check(label, status === 200 && payload.tokens?.length === 3,
    `${status} ${payload?.error ?? ''}`);
}
{
  const { status, payload } = await post({ ...base, full_name: 'Someone Else' });
  check('a name on NO pass is still refused', status === 404, `got ${status}`);
  check('  with the same sentence as always', payload?.error === GENERIC);
}

/* ------------------------------------------------------------------ *
 * A HOUSEHOLD THAT BOOKS TWICE.
 *
 * The reason the reply is a list of bookings rather than a flat run of
 * tokens. Priya books again a month later; both bookings are hers, both have
 * their own reference and their own total, and the desk will ask for one of
 * them by name. Returning only one of the two hides passes she paid for, and
 * flattening them into one deck leaves her unable to say which pass came
 * from which booking.
 * ------------------------------------------------------------------ */
const secondBookingId = randomUUID();
db.registrations.push({
  id: secondBookingId,
  full_name: 'Priya Menon',
  email: 'priya@example.com',
  phone: '9886012345',
  booking_reference: 'FB2026-BBBBB',
  number_of_passes: 2,
  total_amount: 550,
  payment_status: 'paid',
  // Newest. `order=created_at.desc` is what puts it at the top of the list.
  created_at: new Date(Date.now() + 5000).toISOString(),
});
['Priya Menon', 'Meera Menon'].forEach((attendee_name, i) => {
  db.passes.push({
    id: randomUUID(),
    registration_id: secondBookingId,
    // One of the two already used, so the booking's own status has to be
    // something other than a copy of the first pass's.
    status: i === 0 ? 'checked_in' : 'valid',
    attendee_name,
    attendee_category: 'other',
    sequence: i + 1,
    verification_token_hash: `second-hash-${i}`,
    created_at: new Date().toISOString(),
  });
});

console.log('\nA purchaser who booked twice gets BOTH bookings');
{
  const { status, payload } = await post({ ...base, full_name: 'Priya Menon' });
  check('answers 200', status === 200, `got ${status}`);
  check('two bookings, not one', payload.bookings?.length === 2,
    String(payload.bookings?.length));
  const [newest, oldest] = payload.bookings ?? [];
  check('newest first', newest?.reference === 'FB2026-BBBBB', newest?.reference);
  check('  and the earlier one after it', oldest?.reference === 'FB2026-AAAAA',
    oldest?.reference);
  check('each carries its own pass count', newest?.passes === 2 && oldest?.passes === 3,
    `${newest?.passes} and ${oldest?.passes}`);
  check('each carries its own total', newest?.total_amount === 550 && oldest?.total_amount === 825,
    `${newest?.total_amount} and ${oldest?.total_amount}`);
  check('each carries the date it was booked',
    Boolean(newest?.booked_at) && Boolean(oldest?.booked_at));
  check('a part-used booking says so, rather than copying one pass',
    newest?.status === 'partly_checked_in', newest?.status);
  check('an untouched booking is active', oldest?.status === 'active', oldest?.status);
  check('the decks do not bleed into each other',
    newest?.tokens.length === 2 && oldest?.tokens.length === 3);
  check('every token across both bookings is distinct',
    new Set([...newest.tokens, ...oldest.tokens]).size === 5);
  check('EVERY pass in the SECOND booking was rotated too',
    db.passes
      .filter((p) => p.registration_id === secondBookingId)
      .every((p) => !String(p.verification_token_hash).startsWith('second-hash')));
  check('the flat `tokens` still carries all of them, newest first',
    payload.tokens?.length === 5 && payload.tokens[0] === newest.tokens[0]);
  check('and `token` is still the first of those', payload.token === payload.tokens[0]);
}

console.log('\nAn attendee who appears in only ONE of them gets only that one');
{
  const { status, payload } = await post({ ...base, full_name: 'Meera Menon' });
  check('answers 200', status === 200, `got ${status}`);
  check('one booking, not both', payload.bookings?.length === 1,
    String(payload.bookings?.length));
  check('and it is the one she is on', payload.bookings?.[0]?.reference === 'FB2026-BBBBB',
    payload.bookings?.[0]?.reference);
}

console.log('\nA sibling on the same details still gets only their own');
{
  const { status, payload } = await post({ ...base, full_name: 'Arjun Menon' });
  check('answers 200', status === 200, `got ${status}`);
  check('exactly one booking', payload.bookings?.length === 1,
    String(payload.bookings?.length));
  check('theirs', payload.bookings?.[0]?.reference === 'FB2026-SSSSS',
    payload.bookings?.[0]?.reference);
}

console.log('\nA booking whose passes are all cancelled reads as cancelled');
{
  const id = randomUUID();
  db.registrations.push({
    id,
    full_name: 'Nikhil Rao',
    email: 'nikhil@example.com',
    phone: '9886011111',
    booking_reference: 'FB2026-XXXXX',
    number_of_passes: 2,
    total_amount: 550,
    payment_status: 'refunded',
    created_at: new Date().toISOString(),
  });
  [0, 1].forEach((i) => {
    db.passes.push({
      id: randomUUID(),
      registration_id: id,
      status: 'cancelled',
      attendee_name: `Nikhil Rao ${i}`,
      attendee_category: 'other',
      sequence: i + 1,
      verification_token_hash: `cancelled-${i}`,
      created_at: new Date().toISOString(),
    });
  });
  const { status, payload } = await post({
    email: 'nikhil@example.com',
    phone: '9886011111',
    full_name: 'Nikhil Rao',
  });
  check('answers 200', status === 200, `got ${status}`);
  check('and the booking reads cancelled', payload.bookings?.[0]?.status === 'cancelled',
    payload.bookings?.[0]?.status);
}

pg.close?.();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
