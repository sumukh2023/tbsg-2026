-- Flash @ Brigade 2026 · pass registrations
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.

create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  visitor_type text not null
    check (visitor_type in ('student', 'parent', 'other')),
  -- Tiered ceilings live in the API (api/_shared.ts PASS_LIMITS): student 1,
  -- parent 2, other unrestricted. The column only guards the lower bound so
  -- an unrestricted booking is not silently truncated at the database.
  number_of_passes integer not null
    check (number_of_passes >= 1),
  -- School roll. Students give their own; parents give their child's, and
  -- name them. Neither applies to an 'other' visitor.
  student_name varchar(120),
  usn varchar(20),
  class text,
  section text,
  constraint registrations_student_details check (
    case visitor_type
      when 'student' then usn is not null and class is not null and section is not null
      when 'parent' then student_name is not null and usn is not null
                        and class is not null and section is not null
      else true
    end
  ),
  -- Who an 'other' visitor is, and who they represent (optional).
  visitor_detail text
    check (
      visitor_detail is null
      or visitor_detail in ('Guest', 'Faculty', 'Alumni', 'Sponsor', 'Vendor', 'Media')
    ),
  organisation varchar(160),
  accessibility_requirements text,
  comments text,
  -- Consent captured at booking time. The API requires acceptance, so every
  -- row written by it arrives true and dated; the default is false so that
  -- anything inserted by other means is not mistaken for consent.
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz,
  constraint registrations_terms_dated check (
    terms_accepted = false or terms_accepted_at is not null
  ),
  -- Operational mail about your own booking is part of holding a pass; the
  -- festival newsletter is opt-in.
  booking_email_opt_in boolean not null default true,
  marketing_email_opt_in boolean not null default false,
  status text not null default 'received'
    check (status in ('received', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Writes go exclusively through the server (api/register.ts) using the
-- service-role key, which bypasses RLS. Keeping RLS enabled with no anon
-- policies means browser clients can neither read nor write this table.
alter table public.registrations enable row level security;

-- Fast duplicate-window lookups by the API.
create index if not exists registrations_email_created_idx
  on public.registrations (email, created_at desc);

-- Student lookups by USN. Partial: only student rows carry one.
create index if not exists registrations_usn_idx
  on public.registrations (usn)
  where usn is not null;

-- ---------------------------------------------------------------------
-- Digital passes: one per registration, verified on event day by token.
-- The QR encodes an opaque token; only its SHA-256 hash is stored here.
-- ---------------------------------------------------------------------
create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null
    references public.registrations (id) on delete cascade,
  pass_reference text not null unique,
  verification_token_hash text not null unique,
  status text not null default 'valid'
    check (status in ('valid', 'checked_in', 'cancelled')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by text,
  apple_wallet_serial text,
  google_wallet_object_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Server-only table: all reads/writes go through the Edge functions with
-- the service-role key. RLS stays closed to anon clients.
alter table public.passes enable row level security;

create index if not exists passes_token_idx
  on public.passes (verification_token_hash);
create index if not exists passes_reference_idx
  on public.passes (pass_reference);
create index if not exists passes_registration_idx
  on public.passes (registration_id);

-- ---------------------------------------------------------------------
-- Live carnival updates, published to the homepage in real time.
-- ---------------------------------------------------------------------
create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'general'
    check (category in ('general', 'performance', 'food', 'schedule', 'important', 'emergency')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high')),
  cta_label text,
  cta_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.updates enable row level security;

-- Visitors may read only published updates (browser uses the anon key).
drop policy if exists "anon reads published updates" on public.updates;
create policy "anon reads published updates"
  on public.updates for select
  to anon
  using (published = true);

create index if not exists updates_published_idx
  on public.updates (published, published_at desc);

-- Publishing an update stamps published_at automatically, so rows never
-- surface with a missing timestamp (the "January 1" bug: new Date(null)).
create or replace function public.set_updates_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists updates_set_published_at on public.updates;
create trigger updates_set_published_at
  before insert or update on public.updates
  for each row execute function public.set_updates_published_at();

-- Backfill any already-published rows that were missing the timestamp.
update public.updates
  set published_at = created_at
  where published = true and published_at is null;

-- Stream inserts/updates to browsers via Supabase Realtime.
-- (Run once; errors harmlessly if the table is already in the publication.)
alter publication supabase_realtime add table public.updates;

-- Example event-day updates (publish by flipping `published`):
-- insert into public.updates (title, message, category, published, published_at) values
--   ('Welcome to Flash @ Brigade 2026', 'The piazza is open. Programmes at every gate.', 'general', true, now()),
--   ('Gates open at 09:30', 'Both gates, coupon counters just inside.', 'schedule', true, now()),
--   ('Pizza workshop registrations are open', 'Limited spots, at the mercato desk.', 'food', true, now());
