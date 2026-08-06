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

console.log('\nAn old client with no attendee list still books');
{
  const before=db.passes.length;
  const {status,payload}=await post({
    full_name:'Legacy Client', email:'legacy@example.com', phone:'9886012366',
    visitor_type:'other', number_of_passes:4, visitor_detail:'Guest', terms_accepted:true,
  });
  check('answers 201', status===201, `${status} ${payload?.error??''}`);
  check('and still mints FOUR passes, not one', db.passes.length===before+4, String(db.passes.length-before));
}
pg.close?.();
console.log(fail===0?'\nAll checks passed.':`\n${fail} failing.`);
process.exit(fail?1:0);
