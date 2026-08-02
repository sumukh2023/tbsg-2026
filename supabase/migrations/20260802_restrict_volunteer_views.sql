-- Flash @ Brigade 2026 · close the two UNRESTRICTED reporting views
--
-- RUN THIS. The previous migration created `verification_activity` and
-- `volunteer_checkin_totals` and left them reachable by the anon key.
--
-- Why that is a hole, and why the base tables were not:
--
--   A TABLE with `enable row level security` and no policies is closed to
--   anon — that is what protects `volunteers`, `volunteer_sessions`,
--   `volunteer_login_attempts` and `verification_events`.
--
--   A VIEW has no RLS of its own. Worse, before PostgreSQL 15 a view always
--   ran with its OWNER's privileges, so a view owned by `postgres` over an
--   RLS-protected table hands out exactly the rows RLS was there to withhold.
--   Supabase grants `anon` select on new objects in `public` by default, and
--   `VITE_SUPABASE_ANON_KEY` is public by design (it ships in the browser
--   bundle for Live Updates). So anyone could have read the gate's activity
--   log and the volunteer roster — names, roles, who admitted whom, and when.
--
-- Two independent fixes, either of which is sufficient:
--
--   1. REVOKE the grant, so anon and authenticated cannot select at all.
--   2. security_invoker, so the view runs as the CALLER and the underlying
--      tables' RLS applies normally (PostgreSQL 15+).
--
-- Both are applied. The API is unaffected: it reads with the service-role
-- key, which bypasses RLS by design and keeps its grant.
--
-- Safe to run more than once.

-- 1. Take the default grant back off the views.
revoke all on public.verification_activity from anon, authenticated;
revoke all on public.volunteer_checkin_totals from anon, authenticated;

-- 2. Make the views run as the caller rather than as their owner, so RLS on
--    the tables underneath is enforced. Guarded because `security_invoker`
--    is PostgreSQL 15+; on an older server the revokes above still stand.
do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute 'alter view public.verification_activity set (security_invoker = on)';
    execute 'alter view public.volunteer_checkin_totals set (security_invoker = on)';
  else
    raise notice
      'PostgreSQL < 15: security_invoker unavailable, relying on REVOKE alone.';
  end if;
end $$;

-- 3. Belt and braces on the tables themselves. RLS already closes them, but
--    these hold password hashes and session tokens: there is no reason for a
--    browser-facing role to hold any grant on them at all.
revoke all on public.volunteers from anon, authenticated;
revoke all on public.volunteer_sessions from anon, authenticated;
revoke all on public.volunteer_login_attempts from anon, authenticated;
revoke all on public.verification_events from anon, authenticated;

-- 4. And on the attendee tables, which are equally server-only. `updates` is
--    deliberately left alone: it has an anon SELECT policy for published rows
--    and the homepage ticker depends on it.
revoke all on public.registrations from anon, authenticated;
revoke all on public.passes from anon, authenticated;

-- ---------------------------------------------------------------------
-- Verify. Both queries should return ZERO rows once this has run.
-- ---------------------------------------------------------------------
-- Anything a browser-facing role can still reach:
--
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee in ('anon', 'authenticated')
--     and table_name <> 'updates';
--
-- Views still running with owner privileges:
--
--   select c.relname
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'v'
--     and not coalesce((
--       select option_value::boolean from pg_options_to_table(c.reloptions)
--       where option_name = 'security_invoker'), false);
