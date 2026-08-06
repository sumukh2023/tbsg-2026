-- ---------------------------------------------------------------------
-- The student roll belongs to the PASS, so the constraint should too.
--
-- WHAT WENT WRONG. `registrations_student_details` has required, since
-- 20260801, that a booking with visitor_type 'student' carry a USN, a class
-- and a section on the BOOKING row. That was correct when a booking was a
-- pass. The individual-passes overhaul (20260807) moved the roll onto each
-- attendee, because three student tickets are three different pupils and one
-- set of columns cannot describe them. api/register.ts then started posting
-- nulls at booking level and Postgres refused every student booking:
--
--   new row for relation "registrations" violates check constraint
--   "registrations_student_details"
--
-- which reached the visitor as "The registration could not be saved", with
-- nothing on the form to correct.
--
-- WHAT THIS DOES. It stops asking the booking for something that is no
-- longer the booking's to know, and asks the pass instead, so the roll is
-- still guaranteed to exist somewhere rather than merely allowed to vanish.
-- A parent booking is unchanged: it names ONE child, once, and the booking
-- is exactly the right place for that.
--
-- api/register.ts also fills the booking's roll from the single attendee
-- while the student limit stays at one pass, so the two are independent:
-- either alone fixes the failure, and applying this migration to a
-- deployment running the older function does not break it.
--
-- Safe to run more than once, and safe against live data.
-- ---------------------------------------------------------------------
begin;

-- ---------------------------------------------------------------------
-- 1. The booking no longer answers for a student's roll.
--
--    NOT VALID for the same reason it always was: rows written before any of
--    this must not block the deploy.
-- ---------------------------------------------------------------------
alter table public.registrations
  drop constraint if exists registrations_student_details;

alter table public.registrations
  add constraint registrations_student_details check (
    case visitor_type
      -- One child, named once, on the booking that was made for them.
      when 'parent' then student_name is not null and usn is not null
                        and class is not null and section is not null
      -- 'student' is deliberately absent: see passes_student_roll below.
      else true
    end
  ) not valid;

comment on constraint registrations_student_details on public.registrations is
  'Parents name the child on the booking. A student booking carries no roll
   here: each pass carries its own, guarded by passes_student_roll.';

-- ---------------------------------------------------------------------
-- 2. The pass does, because the pass is what admits a person.
--
--    Backfill first, so the constraint has a chance of validating later:
--    a student pass minted between 20260807 and this migration inherited
--    its booking's roll already, but one minted from a booking that had
--    none would be null on both sides. There is nothing to recover it from
--    in that case, which is exactly why the constraint is NOT VALID.
-- ---------------------------------------------------------------------
update public.passes p
set usn = coalesce(p.usn, r.usn),
    class = coalesce(p.class, r.class),
    section = coalesce(p.section, r.section),
    student_name = coalesce(p.student_name, r.student_name, p.attendee_name)
from public.registrations r
where p.registration_id = r.id
  and p.attendee_category = 'student'
  and (p.usn is null or p.class is null or p.section is null);

alter table public.passes
  drop constraint if exists passes_student_roll;

alter table public.passes
  add constraint passes_student_roll check (
    attendee_category <> 'student'
    or (usn is not null and class is not null and section is not null)
  ) not valid;

comment on constraint passes_student_roll on public.passes is
  'A pass admitting a student carries that student''s own roll. Not the
   booking''s: a booking can hold several pupils.';

-- ---------------------------------------------------------------------
-- 3. Look a student up by USN on the PASS as well as on the booking.
--    The gate and the office search by USN, and for a student booking that
--    value now only exists here. Partial, so it indexes the rows that have
--    one rather than carrying a null entry for every guest.
-- ---------------------------------------------------------------------
create index if not exists passes_usn_idx
  on public.passes (usn)
  where usn is not null;

commit;
