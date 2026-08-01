-- Flash @ Brigade 2026 · parent roll, visitor details, organisation
--
-- Follows 20260801_booking_categories_and_student_roll.sql. Run that one
-- first; this migration assumes usn / class / section already exist.
--
--   1. student_name — the child a PARENT is booking for. Students give their
--      own roll and need no separate name; parents give their child's.
--   2. visitor_detail / organisation — who an "other" visitor is, and who
--      they represent (optional: plenty represent nobody but themselves).
--   3. the student-details constraint widens to cover parents.
--
-- Idempotent, transactional, preserves all existing rows.

begin;

-- ---------------------------------------------------------------------
-- 1. Columns.
-- ---------------------------------------------------------------------
alter table public.registrations
  add column if not exists student_name varchar(120),
  add column if not exists visitor_detail text,
  add column if not exists organisation varchar(160);

-- ---------------------------------------------------------------------
-- 2. Visitor detail vocabulary, for 'other' registrations.
-- ---------------------------------------------------------------------
alter table public.registrations
  drop constraint if exists registrations_visitor_detail_check;

alter table public.registrations
  add constraint registrations_visitor_detail_check check (
    visitor_detail is null
    or visitor_detail in ('Guest', 'Faculty', 'Alumni', 'Sponsor', 'Vendor', 'Media')
  ) not valid;

-- ---------------------------------------------------------------------
-- 3. Roll requirement now covers parents as well as students, and a parent
--    additionally names the child. NOT VALID so registrations taken before
--    this migration — parents with no roll on file — do not block the
--    deploy; new and updated rows are checked from here on.
-- ---------------------------------------------------------------------
alter table public.registrations
  drop constraint if exists registrations_student_details;

alter table public.registrations
  add constraint registrations_student_details check (
    case visitor_type
      when 'student' then usn is not null and class is not null and section is not null
      when 'parent' then student_name is not null and usn is not null
                        and class is not null and section is not null
      else true
    end
  ) not valid;

commit;
