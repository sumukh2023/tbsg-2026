-- Flash @ Brigade 2026 · booking categories, tiered limits, student roll
--
-- Brings an existing database in line with schema.sql:
--   1. visitor types reduced to student / parent / other
--   2. number_of_passes ceiling moved out of the database (tiered per type
--      in api/_shared.ts PASS_LIMITS; "other" is unrestricted)
--   3. usn / class / section added for the school roll, required for students
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor or
-- via `supabase db push`.

begin;

-- ---------------------------------------------------------------------
-- 1. School roll columns. Added first so the retired visitor types can be
--    migrated into 'other' without tripping the student-details constraint.
-- ---------------------------------------------------------------------
alter table public.registrations
  add column if not exists usn varchar(20),
  add column if not exists class text,
  add column if not exists section text;

-- ---------------------------------------------------------------------
-- 2. Retired visitor types. Existing guest/alumni/faculty registrations are
--    real people holding real passes, so they are folded into 'other'
--    rather than deleted; 'other' is unrestricted, so their pass counts
--    stay valid whatever they were.
-- ---------------------------------------------------------------------
update public.registrations
   set visitor_type = 'other'
 where visitor_type in ('guest', 'alumni', 'faculty');

alter table public.registrations
  drop constraint if exists registrations_visitor_type_check;

alter table public.registrations
  add constraint registrations_visitor_type_check
  check (visitor_type in ('student', 'parent', 'other'));

-- ---------------------------------------------------------------------
-- 3. Pass count: lower bound only. The upper bound is now per visitor type
--    and enforced by the API, which is the only writer.
-- ---------------------------------------------------------------------
alter table public.registrations
  drop constraint if exists registrations_number_of_passes_check;

alter table public.registrations
  add constraint registrations_number_of_passes_check
  check (number_of_passes >= 1);

-- ---------------------------------------------------------------------
-- 4. Student roll is mandatory for students, and only for students.
--    NOT VALID: rows written before this migration have no roll details and
--    must not block the deploy. New and updated rows are checked from now
--    on; backfill the old ones, then `validate constraint` to close the gap.
-- ---------------------------------------------------------------------
alter table public.registrations
  drop constraint if exists registrations_student_details;

alter table public.registrations
  add constraint registrations_student_details check (
    visitor_type <> 'student'
    or (usn is not null and class is not null and section is not null)
  ) not valid;

commit;
