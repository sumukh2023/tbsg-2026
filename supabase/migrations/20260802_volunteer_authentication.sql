-- Flash @ Brigade 2026 · volunteer/administrator authentication
--
-- Replaces the shared VERIFIER_ACCESS_CODE with per-person accounts, server
-- side sessions and a full audit trail of gate activity.
--
-- Safe to run more than once. Run it in the Supabase SQL editor BEFORE
-- deploying the code that depends on it: the new /api/verify requires a
-- volunteer session and will not fall back to an access code.
--
-- Architecturally isolated from the attendee side: nothing here references
-- `registrations`, and the only link to `passes` is the audit trail recording
-- WHO acted on a pass.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Volunteer and administrator accounts.
-- ---------------------------------------------------------------------
create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  -- Stored lower-cased by the API; the unique index below is also lowered so
  -- two accounts can never differ only by case.
  email text not null,
  -- Argon2id PHC string ($argon2id$v=19$m=...,t=...,p=...$salt$hash). Never a
  -- plaintext or reversible value; the API is the only writer.
  password_hash text not null,
  role text not null default 'volunteer'
    check (role in ('volunteer', 'admin')),
  -- Disabling is preferred over deleting: an account that checked people in
  -- must keep existing so the audit trail still resolves to a name.
  active boolean not null default true,
  -- Lockout state. Cleared on every successful login.
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  -- Set when an admin resets a password, so the UI can require a change.
  must_change_password boolean not null default false,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.volunteers (id) on delete set null
);

create unique index if not exists volunteers_email_key
  on public.volunteers (lower(email));

-- Server-only table. Every read and write goes through the API with the
-- service-role key, which bypasses RLS; leaving RLS on with no policies means
-- an anon or authenticated browser client can never touch password hashes.
alter table public.volunteers enable row level security;

-- ---------------------------------------------------------------------
-- Server-side sessions. The cookie carries an opaque token; only its
-- SHA-256 hash is stored, so a leaked database row cannot be replayed as a
-- session (exactly how passes.verification_token_hash works).
-- ---------------------------------------------------------------------
create table if not exists public.volunteer_sessions (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null
    references public.volunteers (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Set on logout and on an admin revoking access. A row is kept rather than
  -- deleted so "signed out at" stays answerable.
  revoked_at timestamptz,
  -- Coarse client hint for the session list. Never an IP address and never a
  -- full user-agent string: enough to recognise your own session, not enough
  -- to be a tracking record.
  client_label text
);

alter table public.volunteer_sessions enable row level security;

create index if not exists volunteer_sessions_token_idx
  on public.volunteer_sessions (token_hash);
create index if not exists volunteer_sessions_volunteer_idx
  on public.volunteer_sessions (volunteer_id, created_at desc);
-- Sweeping expired sessions: cheap scan of only the rows that can be removed.
create index if not exists volunteer_sessions_expiry_idx
  on public.volunteer_sessions (expires_at)
  where revoked_at is null;

-- ---------------------------------------------------------------------
-- Login attempt ledger, for rate limiting and for a login history.
-- Serverless functions hold no memory between invocations, so the limiter
-- has to be durable; this table is that memory.
-- ---------------------------------------------------------------------
create table if not exists public.volunteer_login_attempts (
  id bigserial primary key,
  -- Lower-cased email as TYPED. Deliberately not a foreign key: attempts
  -- against an address that does not exist are exactly what we need to see.
  email text not null,
  -- SHA-256 of the client IP, not the IP. Enough to rate-limit one source,
  -- not a stored record of who was where.
  ip_hash text,
  successful boolean not null,
  volunteer_id uuid references public.volunteers (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.volunteer_login_attempts enable row level security;

create index if not exists volunteer_login_attempts_email_idx
  on public.volunteer_login_attempts (email, created_at desc);
create index if not exists volunteer_login_attempts_ip_idx
  on public.volunteer_login_attempts (ip_hash, created_at desc)
  where ip_hash is not null;

-- ---------------------------------------------------------------------
-- Verification audit trail. One row per action a volunteer takes on a
-- pass, which is what makes "who checked this person in" answerable even
-- after a later undo.
-- ---------------------------------------------------------------------
create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid references public.passes (id) on delete set null,
  volunteer_id uuid not null
    references public.volunteers (id) on delete restrict,
  -- The actor's role AT THE TIME. Denormalised on purpose: promoting someone
  -- later must not rewrite what their past actions were taken as.
  volunteer_role text not null check (volunteer_role in ('volunteer', 'admin')),
  action text not null
    check (action in ('verify', 'checkin', 'undo', 'lookup_failed')),
  -- Outcome as the volunteer saw it, so the timeline reads correctly.
  result text,
  -- The reference typed or scanned, kept even when no pass matched — an
  -- unmatched code is a real event at the gate.
  pass_reference text,
  created_at timestamptz not null default now()
);

alter table public.verification_events enable row level security;

create index if not exists verification_events_volunteer_idx
  on public.verification_events (volunteer_id, created_at desc);
create index if not exists verification_events_pass_idx
  on public.verification_events (pass_id, created_at desc);
create index if not exists verification_events_created_idx
  on public.verification_events (created_at desc);

-- ---------------------------------------------------------------------
-- passes: point check-in at a volunteer ID rather than a typed name.
--
-- The old `checked_in_by` was free text. It is preserved as
-- `checked_in_by_name` so passes checked in under the access-code system keep
-- their history, and `checked_in_by` becomes the foreign key the task asks
-- for. Guarded so a re-run is a no-op.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'passes'
      and column_name = 'checked_in_by' and data_type <> 'uuid'
  ) then
    alter table public.passes rename column checked_in_by to checked_in_by_name;
  end if;
end $$;

alter table public.passes
  add column if not exists checked_in_by_name text,
  add column if not exists checked_in_by uuid
    references public.volunteers (id) on delete set null,
  add column if not exists undone_by uuid
    references public.volunteers (id) on delete set null,
  add column if not exists undone_at timestamptz;

create index if not exists passes_checked_in_by_idx
  on public.passes (checked_in_by)
  where checked_in_by is not null;

-- ---------------------------------------------------------------------
-- Reporting views. The display name is JOINED, never duplicated into the
-- event rows, so renaming a volunteer corrects every past report at once.
--
-- WARNING: a view has no RLS of its own, and Supabase grants `anon` select on
-- new objects in `public` by default — so these two arrive UNRESTRICTED and
-- readable with the public anon key. `20260802_restrict_volunteer_views.sql`
-- revokes that grant and sets security_invoker. RUN IT TOO.
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
    e.pass_id
  from public.verification_events e
  join public.volunteers v on v.id = e.volunteer_id;

create or replace view public.volunteer_checkin_totals as
  select
    v.id as volunteer_id,
    v.full_name,
    v.role,
    count(*) filter (where e.action = 'checkin') as checkins,
    count(*) filter (where e.action = 'undo') as undos,
    max(e.created_at) filter (where e.action = 'checkin') as last_checkin_at
  from public.volunteers v
  left join public.verification_events e on e.volunteer_id = v.id
  group by v.id, v.full_name, v.role;

-- ---------------------------------------------------------------------
-- Housekeeping: drop sessions and attempt rows that have aged out. Call
-- from a scheduled job if you add one; harmless to run by hand.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_volunteer_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.volunteer_sessions
    where expires_at < now() - interval '7 days';
  delete from public.volunteer_login_attempts
    where created_at < now() - interval '30 days';
$$;
