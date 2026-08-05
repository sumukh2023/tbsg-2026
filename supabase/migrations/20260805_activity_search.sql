-- Searchable gate activity.
--
-- The festival desk needs to answer "did this person come through?" from a
-- name, an email address, a mobile number or a ticket reference. The activity
-- view could only answer it from a reference or a volunteer's name, because
-- everything about the ATTENDEE lives two joins away: an event names a pass,
-- a pass belongs to a registration, and the registration is where the name,
-- email and phone are.
--
-- So the view reaches through both joins. It does NOT copy anything: a
-- corrected email corrects the whole history at once, exactly as the
-- volunteer name already does.
--
-- The joins are LEFT joins on purpose. A scan of an unknown code writes an
-- event with no pass at all (`action = 'lookup_failed'`), and those rows are
-- the most interesting ones in the log — an inner join would silently drop
-- them.
--
-- WARNING, same as the migration that created this view: a view has no RLS of
-- its own and Supabase grants `anon` select on new objects in `public` by
-- default. `create or replace` preserves the existing grants, and
-- `20260802_restrict_volunteer_views.sql` already revoked them here — but the
-- revoke is repeated at the bottom so that running this file on a database
-- where that one was skipped still leaves the view closed. It now carries
-- contact details, so an accidental public grant would be worse than before.
--
-- Safe to run more than once.

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
    r.full_name as attendee_name,
    r.email     as attendee_email,
    r.phone     as attendee_phone
  from public.verification_events e
  join public.volunteers v on v.id = e.volunteer_id
  left join public.passes p on p.id = e.pass_id
  left join public.registrations r on r.id = p.registration_id;

-- Search reads these columns with ILIKE and no leading anchor, which no
-- b-tree index can serve. pg_trgm can, and these are the four columns the
-- desk actually searches on. The extension ships with Supabase.
create extension if not exists pg_trgm;

create index if not exists registrations_full_name_trgm_idx
  on public.registrations using gin (full_name gin_trgm_ops);
create index if not exists registrations_email_trgm_idx
  on public.registrations using gin (email gin_trgm_ops);
create index if not exists registrations_phone_trgm_idx
  on public.registrations using gin (phone gin_trgm_ops);
create index if not exists passes_pass_reference_trgm_idx
  on public.passes using gin (pass_reference gin_trgm_ops);
create index if not exists volunteers_full_name_trgm_idx
  on public.volunteers using gin (full_name gin_trgm_ops);

-- The log is always read newest-first and paged; without this the server
-- sorts the whole table to hand back twenty-five rows.
create index if not exists verification_events_created_at_idx
  on public.verification_events (created_at desc);

revoke all on public.verification_activity from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute 'alter view public.verification_activity set (security_invoker = on)';
  else
    raise notice
      'PostgreSQL < 15: security_invoker unavailable, relying on REVOKE alone.';
  end if;
end $$;
