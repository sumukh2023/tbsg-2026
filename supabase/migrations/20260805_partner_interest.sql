-- Flash @ Brigade 2026 · sponsor Expressions of Interest
--
-- Backs the form on /partner-interest. Same contract as contact_enquiries:
-- the row is stored BEFORE any email is attempted, so a Resend outage costs
-- a notification and never the approach itself. An organisation that offered
-- to sponsor and got silence is the one failure this table exists to prevent.
--
-- Safe to run more than once. Run it in the Supabase SQL editor BEFORE
-- deploying the code that depends on it: /api/partner-interest inserts here
-- and returns a service error until the table exists.
--
-- Independent of every other table. Nothing here references one.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------
create table if not exists public.partner_interest (
  id uuid primary key default gen_random_uuid(),

  organisation_name text not null
    check (length(trim(organisation_name)) between 2 and 160),
  contact_person text not null
    check (length(trim(contact_person)) between 2 and 120),
  -- Job title. Nice to have when the desk calls back; never required.
  designation text,

  organisation_type text not null check (
    organisation_type in (
      'corporate', 'small-business', 'educational', 'ngo',
      'startup', 'individual', 'other'
    )
  ),
  -- Normalised to include a scheme by the API, so it is always clickable.
  website text,

  -- Lower-cased by the API. NOT unique: an organisation may write twice, and
  -- refusing the second one would lose a sponsor over a typo.
  email text not null check (position('@' in email) > 1),
  mobile text not null,
  -- A landline or a switchboard. Optional, and not held to the mobile format.
  office_phone text,

  sponsorship_interest text not null check (
    sponsorship_interest in (
      'powered-by', 'co-powered-by', 'event-organised-by', 'undecided'
    )
  ),
  -- WHOLE RUPEES, and deliberately nullable: "we would like to help, we do
  -- not know with how much yet" is a real and welcome answer. bigint because
  -- a title sponsorship in rupees comfortably clears an int4.
  estimated_value bigint check (estimated_value is null or estimated_value >= 0),

  proposal text check (proposal is null or length(proposal) <= 4000),

  marketing_opt_in boolean not null default false,

  -- Lower case to match `status` on contact_enquiries and every other
  -- enumerated column in this schema. The desk reads "New", "Contacted",
  -- "Closed"; the column stores the same three states in the schema's casing.
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),

  -- The consent that gated the form, recorded server-side like every other
  -- consent on this site.
  privacy_accepted boolean not null default false check (privacy_accepted),
  privacy_accepted_at timestamptz not null default now(),

  -- SHA-256 of the submitting IP, never the address itself. Exists ONLY so
  -- the API can rate limit a source that is not sending the same address
  -- each time; it is not a contact detail and cannot be reversed into one.
  ip_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes.
-- ---------------------------------------------------------------------
-- The desk's working view: newest first.
create index if not exists partner_interest_created_idx
  on public.partner_interest (created_at desc);

-- "Who have we not called back yet" — the only query that runs often.
-- Partial, so it stays small as approaches are worked through.
create index if not exists partner_interest_open_idx
  on public.partner_interest (created_at desc)
  where status = 'new';

-- Both rate-limit lookups: same sender, or same source, inside a window.
create index if not exists partner_interest_email_recent_idx
  on public.partner_interest (lower(email), created_at desc);
create index if not exists partner_interest_ip_recent_idx
  on public.partner_interest (ip_hash, created_at desc)
  where ip_hash is not null;

-- ---------------------------------------------------------------------
-- Keep updated_at honest, so "when was this last touched" survives a status
-- change made by hand in the Supabase table editor.
-- ---------------------------------------------------------------------
create or replace function public.touch_partner_interest_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists partner_interest_touch_updated_at
  on public.partner_interest;
create trigger partner_interest_touch_updated_at
  before update on public.partner_interest
  for each row execute function public.touch_partner_interest_updated_at();

-- ---------------------------------------------------------------------
-- Lock it down.
--
-- Two independent layers, for the reason documented in
-- 20260802_restrict_volunteer_views.sql: RLS with no policies closes the
-- table to the browser-facing roles, and REVOKE takes away the default grant
-- Supabase hands `anon` on new objects in `public`. Either alone has been a
-- hole in this project before.
--
-- The API reaches this table with SUPABASE_SERVICE_ROLE_KEY, which bypasses
-- RLS by design. A row here names a company, a named contact, their direct
-- number and what they are willing to spend — commercially sensitive on the
-- organisation's side as well as personal on the contact's. None of it is
-- readable through the anon API.
-- ---------------------------------------------------------------------
alter table public.partner_interest enable row level security;
revoke all on public.partner_interest from anon, authenticated;

-- Verify after running (both queries should come back empty):
--
--   select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'partner_interest';
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'partner_interest'
--     and grantee in ('anon', 'authenticated');
