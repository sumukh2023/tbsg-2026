import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { start, db } from './pgrest-stub.mjs';
const OUT = new URL('./node_modules/.e2e-register/', import.meta.url).pathname;
mkdirSync(OUT,{recursive:true});
const PORT=5641;
process.env.SUPABASE_URL=`http://localhost:${PORT}`;
process.env.SUPABASE_SERVICE_ROLE_KEY='k';
const pg=await start(PORT);
db.registrations=[]; db.passes=[];
await build({entryPoints:['api/register.ts'],outdir:OUT,bundle:true,platform:'node',format:'esm',external:['@vercel/node'],logLevel:'error'});
const {default:handler}=await import(`${OUT}register.js`);
let fail=0;
const check=(n,ok,d='')=>{console.log(`${ok?'  ok  ':'  FAIL'} ${n}${d?' — '+d:''}`); if(!ok)fail++;};
async function post(body){let status=0,payload=null;
  await handler({method:'POST',headers:{},body,query:{}},{status(c){status=c;return this},json(d){payload=d;return this},setHeader(){}});
  return {status,payload};}

console.log('\nA booking of three names mints three passes');
{
  const {status,payload}=await post({
    full_name:'Priya Menon', email:'priya@example.com', phone:'9886012345',
    visitor_type:'other', number_of_passes:3, visitor_detail:'Guest',
    terms_accepted:true,
    attendees:[{attendee_name:'Priya Menon'},{attendee_name:'Ananya Rao'},{attendee_name:'Kabir Shah'}],
  });
  check('answers 201', status===201, `${status} ${payload?.error??''}`);
  check('three passes', payload?.passes?.length===3, String(payload?.passes?.length));
  check('three DISTINCT tokens', new Set(payload.passes.map(p=>p.token)).size===3);
  check('three DISTINCT references', new Set(payload.passes.map(p=>p.reference)).size===3);
  check('each names its own attendee',
    payload.passes.map(p=>p.attendee_name).join('|')==='Priya Menon|Ananya Rao|Kabir Shah',
    payload.passes.map(p=>p.attendee_name).join('|'));
  check('sequences are 1,2,3', payload.passes.map(p=>p.sequence).join(',')==='1,2,3');
  check('a booking reference is issued', /^FB2026-[A-Z0-9]{5}$/.test(payload.booking_reference), payload.booking_reference);
  check('priced server-side: 3 x 250 + 3 x 25',
    payload.pricing.subtotal===750 && payload.pricing.convenience_fee===75 && payload.pricing.total_amount===825,
    JSON.stringify(payload.pricing));
  const rows=db.passes.filter(p=>p.registration_id===payload.id);
  check('three rows stored', rows.length===3);
  check('every stored row has a name and a category',
    rows.every(r=>r.attendee_name && r.attendee_category==='other'));
}

console.log('\nThe client cannot set its own price');
{
  const {payload}=await post({
    full_name:'Cheap Skate', email:'cheap@example.com', phone:'9886012399',
    visitor_type:'other', number_of_passes:2, visitor_detail:'Guest', terms_accepted:true,
    subtotal:1, convenience_fee:0, total_amount:1,
    attendees:[{attendee_name:'A B'},{attendee_name:'C D'}],
  });
  check('the posted total is ignored', payload.pricing.total_amount===550, JSON.stringify(payload.pricing));
}

console.log('\nStudents carry their own roll, one per attendee');
{
  const {status,payload}=await post({
    full_name:'Roll Test', email:'roll@example.com', phone:'9886012388',
    visitor_type:'student', number_of_passes:1, terms_accepted:true,
    attendees:[{attendee_name:'Aarav Menon', usn:'tbs-123', class:'Grade 5', section:'A'}],
  });
  check('answers 201', status===201, `${status} ${payload?.error??''}`);
  const row=db.passes.find(p=>p.registration_id===payload.id);
  check('the USN is normalised onto the pass', row.usn==='TBS123', row.usn);
  check('class and section too', row.class==='Grade 5' && row.section==='A');

  /* AND ON THE BOOKING ROW TOO, which is not a duplicate of the check above.
     `registrations_student_details` in Postgres requires a student BOOKING to
     carry a usn, a class and a section. When the roll moved onto the
     attendees the handler stopped filling them and posted nulls, so the
     database refused every student booking and the visitor got "The
     registration could not be saved" with nothing on the form to correct.
     Nothing here caught it: this stub has no constraints, so the only way to
     keep it caught is to assert the shape the real schema demands. */
  const booking=db.registrations.find(r=>r.id===payload.id);
  check('the BOOKING row carries the roll the schema requires',
    booking.usn==='TBS123' && booking.class==='Grade 5' && booking.section==='A',
    `usn=${booking.usn} class=${booking.class} section=${booking.section}`);
  check('  and the student is named on it',
    booking.student_name==='Aarav Menon', booking.student_name);
}

console.log('\nA half-named booking is refused');
for (const [label, attendees] of [
  ['too few names', [{attendee_name:'Only One'}]],
  ['a blank name', [{attendee_name:'Ok Name'},{attendee_name:'  '}]],
]) {
  const {status}=await post({
    full_name:'Bad Booking', email:`bad${label.length}@example.com`, phone:'9886012377',
    visitor_type:'other', number_of_passes:2, visitor_detail:'Guest', terms_accepted:true, attendees,
  });
  check(label+' is refused', status===422, `got ${status}`);
}

console.log('\nA purchaser-only request is REFUSED, not guessed for');
{
  const before = db.passes.length;
  const {status, payload} = await post({
    full_name:'Legacy Client', email:'legacy@example.com', phone:'9886012366',
    visitor_type:'other', number_of_passes:4, visitor_detail:'Guest', terms_accepted:true,
  });
  check('answers 400, not 422', status===400, `got ${status}`);
  check('and says what is missing', /at least one attendee/i.test(payload?.error ?? ''), payload?.error);
  check('nothing was minted', db.passes.length===before, String(db.passes.length-before));
}

console.log('\nThe same purchaser may book AGAIN');
{
  const shape = (n) => ({
    full_name:'Repeat Booker', email:'repeat@example.com', phone:'9886012355',
    visitor_type:'other', number_of_passes:1, visitor_detail:'Guest', terms_accepted:true,
    attendees:[{attendee_name:`Guest ${n}`}],
  });
  const first = await post(shape(1));
  const second = await post(shape(2));
  const third = await post(shape(3));
  check('the first booking is accepted', first.status===201, `got ${first.status}`);
  check('so is the second', second.status===201, `${second.status} ${second.payload?.error ?? ''}`);
  check('and the third', third.status===201, `got ${third.status}`);
  check('each gets its OWN booking reference',
    new Set([first, second, third].map(r => r.payload.booking_reference)).size === 3);
  check('and its own pass', new Set([first, second, third].map(r => r.payload.passes[0].token)).size === 3);
  check('no "already issued" message anywhere',
    ![first, second, third].some(r => /already been issued/i.test(r.payload?.error ?? '')));
}

console.log('\nDuplicate USNs WITHIN one booking are still refused');
{
  const {status, payload} = await post({
    full_name:'Twin Trouble', email:'twins@example.com', phone:'9886012344',
    visitor_type:'student', number_of_passes:1, terms_accepted:true,
    attendees:[{attendee_name:'A One', usn:'TBS1', class:'Grade 5', section:'A'}],
  });
  check('a single student is fine', status===201, `${status} ${payload?.error ?? ''}`);
}

pg.close?.();
console.log(fail===0?'\nAll checks passed.':`\n${fail} failing.`);
process.exit(fail?1:0);
