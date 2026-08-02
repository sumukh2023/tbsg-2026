-- Flash @ Brigade 2026 · consent and email preferences
--
-- Records what the attendee agreed to at booking time, and what mail they
-- asked for. Run after the two 20260801/20260802 booking migrations.
--
-- Idempotent, transactional, preserves all existing rows.

begin;

-- ---------------------------------------------------------------------
-- Columns.
--
-- terms_accepted defaults FALSE and terms_accepted_at is nullable, so
-- registrations taken BEFORE consent was collected are honestly recorded as
-- not having accepted rather than silently backfilled as though they had.
-- The API requires acceptance from now on, so every new row arrives true.
--
-- booking_email_opt_in defaults TRUE: operational mail about your own
-- booking is part of holding a pass. marketing_email_opt_in defaults FALSE:
-- the festival newsletter is opt-in, never assumed.
-- ---------------------------------------------------------------------
alter table public.registrations
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists booking_email_opt_in boolean not null default true,
  add column if not exists marketing_email_opt_in boolean not null default false;

-- ---------------------------------------------------------------------
-- A recorded acceptance must carry its timestamp: an accepted-but-undated
-- consent is not evidence of anything. NOT VALID so pre-consent rows do not
-- block the deploy; they are all terms_accepted = false and so satisfy it
-- anyway, but the flag keeps the deploy safe if any were edited by hand.
-- ---------------------------------------------------------------------
alter table public.registrations
  drop constraint if exists registrations_terms_dated;

alter table public.registrations
  add constraint registrations_terms_dated check (
    terms_accepted = false or terms_accepted_at is not null
  ) not valid;

-- ---------------------------------------------------------------------
-- Who asked for the newsletter, for the day someone has to send it.
-- Partial: only the rows that opted in.
-- ---------------------------------------------------------------------
create index if not exists registrations_marketing_opt_in_idx
  on public.registrations (marketing_email_opt_in)
  where marketing_email_opt_in;

commit;
