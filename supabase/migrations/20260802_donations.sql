-- Flash @ Brigade 2026 · donations
--
-- Records donation INTENT from /donate. There is no payment gateway wired up
-- yet, so nothing in here ever writes `payment_status = 'paid'`; the API only
-- ever inserts `pending`. The columns a gateway will need already exist, so
-- integrating one is an UPDATE path rather than a migration.
--
-- Safe to run more than once. Run it in the Supabase SQL editor BEFORE
-- deploying the code that depends on it: /api/donate inserts into this table
-- and will return a service error until it exists.
--
-- Architecturally separate from both the attendee side (`registrations`,
-- `passes`) and the volunteer side (`volunteers`). A donation is its own
-- record; nothing here references another table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),

  -- Donor identity. Stored exactly as the API cleaned it: trimmed, control
  -- characters stripped, length capped.
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  -- Lower-cased by the API. NOT unique: one person may give more than once,
  -- and a second gift must never be rejected as a duplicate.
  email text not null check (position('@' in email) > 1),
  phone text not null,

  donor_type text not null
    check (donor_type in ('individual', 'parent', 'alumni', 'corporate')),
  -- Only ever set for a corporate donor, and optional even then. The check
  -- enforces that at the database, so a client cannot attach an organisation
  -- to an individual gift.
  organisation text
    check (organisation is null or donor_type = 'corporate'),

  -- WHOLE RUPEES, never paise, and never a float. A gateway will want the
  -- smallest unit later; converting at the boundary is safer than storing a
  -- value whose unit depends on when the row was written.
  amount integer not null check (amount > 0 and amount <= 10000000),

  recognition_preference text not null default 'public'
    check (recognition_preference in ('public', 'anonymous')),
  marketing_opt_in boolean not null default false,

  -- The consent that gated the form. Recorded server-side, like registrations.
  terms_accepted boolean not null default false check (terms_accepted),
  terms_accepted_at timestamptz not null default now(),

  -- ------------------------------------------------------------------
  -- Payment. Everything below is written by the gateway integration when
  -- there is one; until then `pending` is the only value that ever appears.
  --
  --   pending    intent recorded, no money has moved
  --   paid       the gateway confirmed a successful capture
  --   failed     the gateway reported a failure
  --   refunded   captured and later returned
  -- ------------------------------------------------------------------
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  -- The gateway's own identifier (a Razorpay payment_id, say). Unique where
  -- present, so a webhook replay cannot record the same payment twice.
  payment_reference text,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A pending donation has no reference and no paid timestamp; a paid one has
-- both. Enforced here rather than in the API so a future webhook cannot half
-- update a row and leave it in a state nothing else knows how to read.
alter table public.donations drop constraint if exists donations_payment_coherent;
alter table public.donations add constraint donations_payment_coherent check (
  (payment_status = 'paid' and payment_reference is not null and paid_at is not null)
  or (payment_status <> 'paid' and paid_at is null)
);

-- ---------------------------------------------------------------------
-- Indexes.
-- ---------------------------------------------------------------------
-- The desk's working view: newest first.
create index if not exists donations_created_idx
  on public.donations (created_at desc);

-- "Show me everything still unpaid", which is every row today. Partial, so it
-- stays small once real payments start landing.
create index if not exists donations_pending_idx
  on public.donations (created_at desc)
  where payment_status = 'pending';

-- Looking a donor up by email, case-insensitively.
create index if not exists donations_email_idx
  on public.donations (lower(email));

-- One row per gateway payment. Partial, because `pending` rows all have a
-- null reference and null is not unique-constrained usefully otherwise.
create unique index if not exists donations_payment_reference_key
  on public.donations (payment_reference)
  where payment_reference is not null;

-- ---------------------------------------------------------------------
-- Keep updated_at honest.
-- ---------------------------------------------------------------------
create or replace function public.touch_donations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists donations_touch_updated_at on public.donations;
create trigger donations_touch_updated_at
  before update on public.donations
  for each row execute function public.touch_donations_updated_at();

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
-- RLS by design, so donations can be written by the serverless function and
-- read by nobody through the public API. Donor names, emails, phone numbers
-- and amounts are not public data.
-- ---------------------------------------------------------------------
alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;

-- Verify after running (both queries should come back empty):
--
--   select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'donations';
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'donations'
--     and grantee in ('anon', 'authenticated');
