-- ---------------------------------------------------------------------
-- One pass per ATTENDEE, not one pass per booking.
--
-- A booking used to mint a single pass carrying a single QR code, whatever
-- `number_of_passes` said. Four people arriving together shared one code, so
-- checking one of them in checked all four in, and the gate had no way to
-- admit them separately. This makes the pass the unit: every attendee gets
-- their own row, their own reference, their own QR and their own check-in.
--
-- WHAT IS NOT RENAMED, AND WHY. The brief describes a `bookings` table.
-- `public.registrations` already IS that table: one row per booking, holding
-- the purchaser and what they paid. Renaming it would rewrite every query in
-- api/, the `verification_activity` view the gate log is built on, the admin
-- reports and four end-to-end suites, in exchange for a better noun. The
-- brief also requires all of those to keep working, and they are what a
-- volunteer depends on at a gate. So `registrations` keeps its name and
-- gains the booking columns; read "registration" as "booking" throughout.
--
-- Safe to run more than once, and safe to run against live data: every
-- change is additive, and the backfill is written so existing passes come
-- out describing exactly the person they already described.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. The booking.
-- ---------------------------------------------------------------------
alter table public.registrations
  add column if not exists booking_reference text,
  add column if not exists subtotal integer,
  add column if not exists convenience_fee integer,
  add column if not exists total_amount integer,
  add column if not exists payment_status text not null default 'unpaid';

comment on column public.registrations.booking_reference is
  'Human-readable booking id, FB2026-XXXXX. What a visitor quotes at the desk.';
comment on column public.registrations.subtotal is
  'Tickets only, whole rupees. The fee is separate so a receipt can show both.';
comment on column public.registrations.convenience_fee is
  'Whole rupees, charged per ticket. See src/festival/getpasses/pricing.ts.';
comment on column public.registrations.total_amount is
  'Subtotal plus fee. Stored rather than derived so a price change cannot
   retroactively alter what somebody was quoted.';

alter table public.registrations
  drop constraint if exists registrations_payment_status_check;
alter table public.registrations
  add constraint registrations_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'refunded', 'waived'));

-- Every booking that predates this column gets one, so `booking_reference`
-- can be relied on as present. Generated from the row's own id, so re-running
-- this migration cannot hand the same booking two different references.
update public.registrations
set booking_reference = 'FB2026-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where booking_reference is null;

alter table public.registrations
  alter column booking_reference set not null;

create unique index if not exists registrations_booking_reference_idx
  on public.registrations (booking_reference);

-- ---------------------------------------------------------------------
-- 2. The pass, which now describes a PERSON.
--
-- The attendee's identity lives here rather than on the booking, because
-- that is the whole change: the booking has one purchaser and many
-- attendees, and only the pass knows which attendee it admits.
-- ---------------------------------------------------------------------
alter table public.passes
  add column if not exists attendee_name text,
  add column if not exists attendee_category text,
  add column if not exists student_name text,
  add column if not exists usn varchar(20),
  add column if not exists class text,
  add column if not exists section text,
  add column if not exists sequence integer;

comment on column public.passes.attendee_name is
  'Who this pass admits. NOT the purchaser: one booking has many of these.';
comment on column public.passes.attendee_category is
  'student | parent | other. Denormalised from the booking on purpose: a
   future booking may mix categories, and the gate reads it off the pass.';
comment on column public.passes.sequence is
  'Position within the booking, from 1. Only for ordering and display.';

-- Backfill: an existing pass admits the person named on its booking, in the
-- category that booking was made under. Student roll details come across too,
-- because the gate reads them off the pass.
update public.passes p
set attendee_name = coalesce(p.attendee_name, r.full_name),
    attendee_category = coalesce(p.attendee_category, r.visitor_type),
    student_name = coalesce(p.student_name, r.student_name),
    usn = coalesce(p.usn, r.usn),
    class = coalesce(p.class, r.class),
    section = coalesce(p.section, r.section),
    sequence = coalesce(p.sequence, 1)
from public.registrations r
where p.registration_id = r.id
  and (p.attendee_name is null or p.attendee_category is null or p.sequence is null);

alter table public.passes
  alter column attendee_name set not null,
  alter column attendee_category set not null,
  alter column sequence set not null;

alter table public.passes
  alter column sequence set default 1;

alter table public.passes
  drop constraint if exists passes_attendee_category_check;
alter table public.passes
  add constraint passes_attendee_category_check
  check (attendee_category in ('student', 'parent', 'other'));

-- One sequence number per booking. Cheap insurance against a retry inserting
-- "Visitor 3" twice, which would show a visitor two identical passes and
-- give the gate two rows to check the same person in on.
create unique index if not exists passes_booking_sequence_idx
  on public.passes (registration_id, sequence);

-- The gate types a reference when a camera will not focus. Already unique;
-- this makes the lookup an index seek rather than a scan as the table grows.
create index if not exists passes_attendee_name_idx
  on public.passes (lower(attendee_name));

-- ---------------------------------------------------------------------
-- 3. Retrieval reads by booking, so it needs the booking's own key.
-- ---------------------------------------------------------------------
create index if not exists registrations_email_phone_idx
  on public.registrations (email, phone);

-- ---------------------------------------------------------------------
-- 4. RLS is UNCHANGED, and that is deliberate.
--
-- Both tables already have row level security enabled with no policies, and
-- everything reaches them through the Vercel functions with the service-role
-- key, which bypasses RLS. Adding a policy here would be the only way for a
-- browser to read a pass directly, and a pass row names a child, their class
-- and their USN. There is no policy to add.
--
-- Verify (all three should come back empty):
--
--   select policyname from pg_policies
--   where schemaname = 'public' and tablename in ('registrations', 'passes');
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name in ('registrations', 'passes')
--     and grantee in ('anon', 'authenticated');
--
-- And the shape of the result (every pass should have a name and a sequence):
--
--   select count(*) filter (where attendee_name is null) as unnamed,
--          count(*) filter (where sequence is null) as unsequenced
--   from public.passes;
-- ---------------------------------------------------------------------
revoke all on public.registrations from anon, authenticated;
revoke all on public.passes from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. The gate activity log now names the ATTENDEE, not the purchaser.
--
-- The view joined `registrations.full_name`, which was right when a booking
-- had one pass and wrong the moment it had four: a volunteer searching the
-- log for the person they just checked in would have found the name of
-- whoever paid, repeated once per pass, and never the attendee.
--
-- The purchaser is kept alongside rather than dropped. The desk's real
-- question is often "who booked this", and the contact columns beside it are
-- the purchaser's anyway.
-- ---------------------------------------------------------------------
create or replace view public.verification_activity as
  select
    e.id,
    e.created_at,
    e.action,
    e.result,
    e.pass_reference,
    e.volunteer_id,
    v.full_name as volunteer_name,
    e.volunteer_role,
    e.pass_id,
    p.attendee_name  as attendee_name,
    p.attendee_category as attendee_category,
    r.booking_reference as booking_reference,
    r.full_name as purchaser_name,
    r.email     as attendee_email,
    r.phone     as attendee_phone
  from public.verification_events e
  join public.volunteers v on v.id = e.volunteer_id
  left join public.passes p on p.id = e.pass_id
  left join public.registrations r on r.id = p.registration_id;

-- Search reaches the attendee name with ILIKE and no leading anchor, which
-- only a trigram index can serve.
create index if not exists passes_attendee_name_trgm_idx
  on public.passes using gin (attendee_name gin_trgm_ops);
