-- Flash @ Brigade 2026 · contact enquiries
--
-- Backs the form on /enquiry. Every enquiry is stored BEFORE any email is
-- attempted, so a Resend outage costs a notification, never the message
-- itself: the row is the record and the emails are a convenience on top.
--
-- Safe to run more than once. Run it in the Supabase SQL editor BEFORE
-- deploying the code that depends on it: /api/enquiry inserts into this table
-- and will return a service error until it exists.
--
-- Independent of the attendee side (`registrations`, `passes`), the volunteer
-- side (`volunteers`) and `donations`. Nothing here references another table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------
create table if not exists public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),

  full_name text not null check (length(trim(full_name)) between 2 and 120),
  -- Lower-cased by the API. NOT unique: one person may write more than once.
  email text not null check (position('@' in email) > 1),
  -- Optional, unlike everywhere else on this site. Somebody asking a question
  -- should not have to hand over a phone number to do it.
  mobile text,

  subject text not null check (
    subject in (
      'general', 'passes', 'stall-booking', 'sponsorship',
      'donations', 'technical-support', 'other'
    )
  ),
  message text not null check (length(trim(message)) between 10 and 4000),

  marketing_opt_in boolean not null default false,

  -- Lower case to match `payment_status`, `visitor_type` and `role` elsewhere
  -- in this schema. The desk sees "New", "Replied", "Closed"; the column
  -- stores the same three states in the casing the rest of the database uses.
  status text not null default 'new'
    check (status in ('new', 'replied', 'closed')),

  -- The consent that gated the form, recorded server-side like every other
  -- consent on this site.
  privacy_accepted boolean not null default false check (privacy_accepted),
  privacy_accepted_at timestamptz not null default now(),

  -- SHA-256 of the submitting IP, never the address itself. Exists ONLY so
  -- the API can rate limit a source that is not sending the same email each
  -- time; it is not a contact detail and cannot be reversed into one.
  ip_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes.
-- ---------------------------------------------------------------------
-- The desk's working view: newest first.
create index if not exists contact_enquiries_created_idx
  on public.contact_enquiries (created_at desc);

-- "What still needs answering", which is the only query that runs often.
-- Partial, so it stays small as answered enquiries accumulate.
create index if not exists contact_enquiries_open_idx
  on public.contact_enquiries (created_at desc)
  where status = 'new';

-- Both rate-limit lookups: same sender, or same source, inside a window.
create index if not exists contact_enquiries_email_recent_idx
  on public.contact_enquiries (lower(email), created_at desc);
create index if not exists contact_enquiries_ip_recent_idx
  on public.contact_enquiries (ip_hash, created_at desc)
  where ip_hash is not null;

-- ---------------------------------------------------------------------
-- Keep updated_at honest, so "when was this last touched" survives a status
-- change made by hand in the Supabase table editor.
-- ---------------------------------------------------------------------
create or replace function public.touch_contact_enquiries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contact_enquiries_touch_updated_at
  on public.contact_enquiries;
create trigger contact_enquiries_touch_updated_at
  before update on public.contact_enquiries
  for each row execute function public.touch_contact_enquiries_updated_at();

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
-- RLS by design. An enquiry carries a name, an email, sometimes a phone
-- number and a free-text message that may say anything at all; none of that
-- is public data and none of it is readable through the anon API.
-- ---------------------------------------------------------------------
alter table public.contact_enquiries enable row level security;
revoke all on public.contact_enquiries from anon, authenticated;

-- Verify after running (both queries should come back empty):
--
--   select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'contact_enquiries';
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'contact_enquiries'
--     and grantee in ('anon', 'authenticated');
