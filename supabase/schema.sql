-- Flash @ Brigade 2026 · pass registrations
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.

create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  visitor_type text not null
    check (visitor_type in ('student', 'parent', 'guest', 'alumni', 'faculty', 'other')),
  number_of_passes integer not null
    check (number_of_passes between 1 and 10),
  accessibility_requirements text,
  comments text,
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
