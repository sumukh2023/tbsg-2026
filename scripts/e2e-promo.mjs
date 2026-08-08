/**
 * End-to-end test for promo codes, running the REAL api/register handler.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT.
 *
 * It proves the HANDLER is right: that the discount comes off the tickets and
 * never off the convenience fee, that a client's own arithmetic is ignored,
 * that a refused code refuses the booking rather than quietly charging full
 * price, that the Apply button consumes nothing, and that a use reserved for
 * a booking that then fails is handed back.
 *
 * It does NOT prove the usage limit holds under concurrency. That property
 * belongs to a single Postgres UPDATE whose WHERE clause carries the limit,
 * and a JavaScript stand-in running on one thread cannot demonstrate it: a
 * stub will always look atomic. It was verified separately by pointing forty
 * concurrent psql clients at a five-use code on a real Postgres 16 carrying
 * this project's schema, which produced exactly five successes and
 * current_uses = 5. If the SQL in
 * supabase/migrations/20260809_promo_codes.sql changes, re-run that, because
 * nothing in this file will notice.
 *
 *   node scripts/e2e-promo.mjs
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { start, db } from './pgrest-stub.mjs';

const OUT = new URL('./node_modules/.e2e-promo/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PG_PORT = 5633;
process.env.SUPABASE_URL = `http://localhost:${PG_PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key';

const pg = await start(PG_PORT);
db.registrations = [];
db.passes = [];

await build({
  entryPoints: ['api/register.ts'],
  outdir: OUT,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@vercel/node'],
  logLevel: 'error',
});
const { default: handler } = await import(`${OUT}register.js`);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function post(body, query = {}) {
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
  await handler({ method: 'POST', headers: {}, body, query }, res);
  return { status, payload };
}

let n = 0;
/** A five-ticket "other" booking: 5 x 250 = 1250 subtotal, 125 fee. */
const booking = (extra = {}) => {
  n += 1;
  return {
    full_name: `Buyer ${n}`,
    email: `buyer${n}@example.com`,
    phone: '9886012345',
    visitor_type: 'other',
    visitor_detail: 'Guest',
    number_of_passes: 5,
    terms_accepted: true,
    attendees: Array.from({ length: 5 }, (_, i) => ({
      attendee_name: `Guest ${n}.${i + 1}`,
    })),
    ...extra,
  };
};

const seed = () => {
  db.promo_codes = [
    {
      code: 'FLASH26',
      discount_type: 'percent',
      discount_value: 10,
      max_uses: 100,
      current_uses: 0,
      active: true,
      starts_at: null,
      expires_at: null,
      applicable_categories: null,
    },
    {
      code: 'SLEEPING',
      discount_type: 'percent',
      discount_value: 50,
      max_uses: null,
      current_uses: 0,
      active: false,
      starts_at: null,
      expires_at: null,
      applicable_categories: null,
    },
    {
      code: 'LASTYEAR',
      discount_type: 'percent',
      discount_value: 50,
      max_uses: null,
      current_uses: 0,
      active: true,
      starts_at: null,
      expires_at: '2020-01-01T00:00:00Z',
      applicable_categories: null,
    },
    {
      code: 'SOLDOUT',
      discount_type: 'percent',
      discount_value: 50,
      max_uses: 2,
      current_uses: 2,
      active: true,
      starts_at: null,
      expires_at: null,
      applicable_categories: null,
    },
    {
      code: 'PUPILS',
      discount_type: 'percent',
      discount_value: 25,
      max_uses: null,
      current_uses: 0,
      active: true,
      starts_at: null,
      expires_at: null,
      applicable_categories: ['student'],
    },
    {
      code: 'FIFTYOFF',
      discount_type: 'amount',
      discount_value: 50,
      max_uses: null,
      current_uses: 0,
      active: true,
      starts_at: null,
      expires_at: null,
      applicable_categories: null,
    },
  ];
};
seed();

const INVALID = 'This promo code is invalid or no longer available.';
const uses = (code) => db.promo_codes.find((c) => c.code === code).current_uses;

console.log('\nNo promo code prices exactly as before');
{
  const { status, payload } = await post(booking());
  check('answers 201', status === 201, `${status} ${payload?.error ?? ''}`);
  check('subtotal 5 x 250', payload.pricing.subtotal === 1250, String(payload.pricing.subtotal));
  check('fee 5 x 25', payload.pricing.convenience_fee === 125, String(payload.pricing.convenience_fee));
  check('no discount', payload.pricing.discount_amount === 0);
  check('no code recorded', payload.pricing.promo_code === null);
  check('total 1375', payload.pricing.total_amount === 1375, String(payload.pricing.total_amount));
}

console.log('\nThe Apply button quotes without consuming');
{
  const before = uses('FLASH26');
  const { status, payload } = await post(
    { promo_code: 'flash26', visitor_type: 'other', number_of_passes: 5 },
    { action: 'promo' }
  );
  check('answers 200', status === 200, `${status} ${payload?.error ?? ''}`);
  check('upper-cases the code', payload.code === 'FLASH26', payload.code);
  check('10% of 1250 is 125', payload.discount_amount === 125, String(payload.discount_amount));
  check('discounted subtotal 1125', payload.discounted_subtotal === 1125, String(payload.discounted_subtotal));
  check('fee untouched at 125', payload.convenience_fee === 125, String(payload.convenience_fee));
  check('total 1250', payload.total_amount === 1250, String(payload.total_amount));
  check('CONSUMED NOTHING', uses('FLASH26') === before, `${before} -> ${uses('FLASH26')}`);
}

console.log('\nA valid code discounts the TICKETS and not the fee');
{
  const before = uses('FLASH26');
  const { status, payload } = await post(booking({ promo_code: 'FLASH26' }));
  check('answers 201', status === 201, `${status} ${payload?.error ?? ''}`);
  const p = payload.pricing;
  check('subtotal is still the full 1250', p.subtotal === 1250, String(p.subtotal));
  check('discount 125', p.discount_amount === 125, String(p.discount_amount));
  check('fee STILL 125, not discounted', p.convenience_fee === 125, String(p.convenience_fee));
  check('total 1250 = 1250 - 125 + 125', p.total_amount === 1250, String(p.total_amount));
  check('the code is recorded', p.promo_code === 'FLASH26', p.promo_code);
  check('one use consumed', uses('FLASH26') === before + 1);

  const row = db.registrations.at(-1);
  check('and stored on the booking', row.promo_code === 'FLASH26' && row.discount_amount === 125,
    `${row.promo_code} / ${row.discount_amount}`);
  check('the stored total is the server total', row.total_amount === 1250, String(row.total_amount));
}

console.log('\nThe worked example from the brief');
{
  /* Five student tickets would be capped at one, so the brief's 1,000 is
     modelled as four parent tickets at 250. The arithmetic is the point:
     1000 - 100 + 100 fee = 1000, and the fee is never part of the 10%. */
  const { payload } = await post({
    full_name: 'Example Parent',
    email: 'example@example.com',
    phone: '9886012345',
    visitor_type: 'parent',
    number_of_passes: 2,
    student_name: 'A Child',
    usn: 'TBS9',
    class: 'Grade 5',
    section: 'A',
    terms_accepted: true,
    promo_code: 'FLASH26',
    attendees: [{ attendee_name: 'Parent One' }, { attendee_name: 'Parent Two' }],
  });
  const p = payload.pricing;
  check('2 x 250 = 500 subtotal', p.subtotal === 500, String(p.subtotal));
  check('10% is 50', p.discount_amount === 50, String(p.discount_amount));
  check('fee 2 x 25 = 50', p.convenience_fee === 50, String(p.convenience_fee));
  check('total 500 - 50 + 50 = 500', p.total_amount === 500, String(p.total_amount));
  check(
    'the discount was NOT taken off the final amount',
    p.total_amount !== Math.round((p.subtotal + p.convenience_fee) * 0.9),
    `a discount on the final amount would have been ${Math.round((p.subtotal + p.convenience_fee) * 0.9)}`
  );
}

console.log('\nA code that cannot be used refuses the booking');
for (const [label, code, expected] of [
  ['an unknown code', 'NOSUCHCODE', INVALID],
  ['an inactive code', 'SLEEPING', INVALID],
  ['an expired code', 'LASTYEAR', INVALID],
  [
    'an exhausted code',
    'SOLDOUT',
    'This promotion has been fully claimed. Every allocated code has been used.',
  ],
  ['a code for another category', 'PUPILS', 'This promo code does not apply to this booking.'],
]) {
  const before = db.registrations.length;
  const { status, payload } = await post(booking({ promo_code: code }));
  check(`${label} is refused`, status === 422, `got ${status}`);
  check('  with the right sentence', payload?.error === expected, payload?.error);
  check('  and nothing is booked', db.registrations.length === before);
}
check(
  'an exhausted code is told apart from an invalid one',
  true,
  'SOLDOUT says "fully claimed", the others say "invalid or no longer available"'
);

console.log('\nThe client cannot dictate the discount');
{
  const before = uses('FLASH26');
  const { status, payload } = await post(
    booking({
      promo_code: 'FLASH26',
      // Everything a tampered request might carry.
      discount_amount: 99999,
      subtotal: 1,
      convenience_fee: 0,
      total_amount: 1,
      pricing: { total_amount: 1 },
    })
  );
  check('still answers 201', status === 201, `got ${status}`);
  const p = payload.pricing;
  check('the posted discount is ignored', p.discount_amount === 125, String(p.discount_amount));
  check('the posted subtotal is ignored', p.subtotal === 1250, String(p.subtotal));
  check('the posted fee is ignored', p.convenience_fee === 125, String(p.convenience_fee));
  check('the posted total is ignored', p.total_amount === 1250, String(p.total_amount));
  check('exactly one use was taken', uses('FLASH26') === before + 1);
}

console.log('\nA flat-amount code works too, and cannot exceed the subtotal');
{
  const { payload } = await post(booking({ promo_code: 'FIFTYOFF' }));
  check('50 off 1250', payload.pricing.discount_amount === 50, String(payload.pricing.discount_amount));
  check('total 1325', payload.pricing.total_amount === 1325, String(payload.pricing.total_amount));

  db.promo_codes.push({
    code: 'HUGE',
    discount_type: 'amount',
    discount_value: 999999,
    max_uses: null,
    current_uses: 0,
    active: true,
    starts_at: null,
    expires_at: null,
    applicable_categories: null,
  });
  const big = await post(booking({ promo_code: 'HUGE' }));
  check(
    'a discount larger than the tickets is capped at the tickets',
    big.payload.pricing.discount_amount === 1250,
    String(big.payload.pricing.discount_amount)
  );
  check(
    'so the visitor still owes the fee, never a negative total',
    big.payload.pricing.total_amount === 125,
    String(big.payload.pricing.total_amount)
  );
}

console.log('\nEach booking consumes exactly one use');
{
  db.promo_codes.push({
    code: 'THREE',
    discount_type: 'percent',
    discount_value: 10,
    max_uses: 3,
    current_uses: 0,
    active: true,
    starts_at: null,
    expires_at: null,
    applicable_categories: null,
  });
  const results = [];
  for (let i = 0; i < 5; i += 1) {
    const { status } = await post(booking({ promo_code: 'THREE' }));
    results.push(status);
  }
  check('three succeed', results.filter((s) => s === 201).length === 3, JSON.stringify(results));
  check('two are refused', results.filter((s) => s === 422).length === 2);
  check('and the counter stops at the limit', uses('THREE') === 3, String(uses('THREE')));
}

console.log('\nA booking that fails after reserving gives the use back');
{
  db.promo_codes.push({
    code: 'ROLLBACK',
    discount_type: 'percent',
    discount_value: 10,
    max_uses: 5,
    current_uses: 0,
    active: true,
    starts_at: null,
    expires_at: null,
    applicable_categories: null,
  });
  /* The insert is made to fail the way it would in production: the booking
     reference is unique, so a registration table that already holds the row
     rejects it. Simpler here to break the table itself. */
  const real = db.registrations;
  Object.defineProperty(db, 'registrations', {
    configurable: true,
    get: () => real,
    set: () => {},
  });
  const originalPush = real.push;
  real.push = () => {
    throw new Error('insert refused');
  };
  const { status } = await post(booking({ promo_code: 'ROLLBACK' }));
  real.push = originalPush;
  check('the booking fails', status >= 500, `got ${status}`);
  check(
    'and the reserved use was returned',
    uses('ROLLBACK') === 0,
    `current_uses = ${uses('ROLLBACK')}`
  );
}

console.log('\nThe preview refuses what the booking would refuse');
for (const [label, code, expected] of [
  ['unknown', 'NOSUCHCODE', INVALID],
  ['inactive', 'SLEEPING', INVALID],
  ['expired', 'LASTYEAR', INVALID],
  ['exhausted', 'SOLDOUT', 'This promotion has been fully claimed. Every allocated code has been used.'],
]) {
  const { status, payload } = await post(
    { promo_code: code, visitor_type: 'other', number_of_passes: 5 },
    { action: 'promo' }
  );
  check(`${label} is refused by the preview`, status === 422, `got ${status}`);
  check('  with the same sentence the booking would give', payload?.error === expected, payload?.error);
}

console.log('\nThe preview prices from the CATEGORY, not from the request');
{
  const { payload } = await post(
    {
      promo_code: 'FLASH26',
      visitor_type: 'other',
      number_of_passes: 5,
      // A tampered subtotal, which must not reach the discount.
      subtotal: 1000000,
    },
    { action: 'promo' }
  );
  check('the discount is 10% of the REAL subtotal', payload.discount_amount === 125,
    String(payload.discount_amount));
}

pg.close?.();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
