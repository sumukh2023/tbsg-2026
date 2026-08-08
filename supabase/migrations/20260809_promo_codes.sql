-- ---------------------------------------------------------------------
-- Promo codes.
--
-- A code is DATA, not code: everything that varies between one promotion and
-- the next is a column here, so a second, third and tenth code are rows the
-- office inserts rather than a deploy. Nothing in api/ names FLASH26.
--
-- THE USAGE LIMIT IS THE HARD PART, and it is the reason this file carries a
-- function rather than leaving the API to read-then-write. "Select the count,
-- check it is under the limit, update it" is a race: two bookings that read
-- 99 both write 100, and a hundred-use code is redeemed a hundred and one
-- times. The reservation below is a single UPDATE whose WHERE clause contains
-- the limit, so Postgres serialises the contending statements on the row and
-- exactly one of them wins. There is no window between the check and the
-- write because they are the same statement.
--
-- Safe to run more than once, and safe against live data.
-- ---------------------------------------------------------------------
begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------------
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),

  -- UPPER CASE, always. A visitor types flash26, Flash26 or FLASH26 and means
  -- the same thing, so the column is normalised on the way in by the check
  -- below and every lookup upper-cases before it queries. Unique, so a code
  -- cannot be defined twice with different terms.
  code text not null unique
    check (code = upper(code) and length(code) between 3 and 32),

  -- 'percent' takes `value` as a percentage of the ticket subtotal;
  -- 'amount' takes it as whole rupees off. Both are capped by the subtotal
  -- itself in the function below: a discount can never exceed what is owed.
  discount_type text not null default 'percent'
    check (discount_type in ('percent', 'amount')),
  discount_value integer not null check (discount_value > 0),

  -- Null means unlimited. A number means first come, first served.
  max_uses integer check (max_uses is null or max_uses > 0),
  -- Only ever moved by `reserve_promo_use`, never by the API directly.
  current_uses integer not null default 0 check (current_uses >= 0),

  active boolean not null default true,
  -- Null on either side means open-ended.
  starts_at timestamptz,
  expires_at timestamptz,

  -- Null means every category. Otherwise the visitor types the code applies
  -- to, matched against `registrations.visitor_type`.
  applicable_categories text[]
    check (
      applicable_categories is null
      or applicable_categories <@ array['student', 'parent', 'other']::text[]
    ),

  -- For the office, never shown to a visitor.
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.promo_codes is
  'Discount codes for Get Passes. A new promotion is a row, not a deploy.
   Usage limits are enforced by reserve_promo_use, never by the API.';
comment on column public.promo_codes.discount_value is
  'Percent when discount_type is percent, whole rupees when it is amount.
   Applies to the TICKET SUBTOTAL only, never to the convenience fee.';
comment on column public.promo_codes.current_uses is
  'Successful bookings only. Moved exclusively by reserve_promo_use, and
   released by release_promo_use when a booking fails after reserving.';

alter table public.promo_codes
  drop constraint if exists promo_codes_window;
alter table public.promo_codes
  add constraint promo_codes_window
  check (starts_at is null or expires_at is null or expires_at > starts_at);

-- A percentage above 100 is a refund, which this is not.
alter table public.promo_codes
  drop constraint if exists promo_codes_percent_range;
alter table public.promo_codes
  add constraint promo_codes_percent_range
  check (discount_type <> 'percent' or discount_value <= 100);

-- ---------------------------------------------------------------------
-- 2. Which booking used which code, and for how much.
--
--    On `registrations` rather than in a join table: a booking has at most
--    one code, and the amount is part of what the booking was quoted. It is
--    stored rather than recomputed so a later edit to the promotion cannot
--    retroactively change what somebody paid.
-- ---------------------------------------------------------------------
alter table public.registrations
  add column if not exists promo_code text,
  add column if not exists discount_amount integer not null default 0;

comment on column public.registrations.promo_code is
  'The code as redeemed, upper case. Text rather than a foreign key so the
   record of what a visitor was charged survives the promotion being deleted.';
comment on column public.registrations.discount_amount is
  'Whole rupees taken off the TICKET SUBTOTAL. Never off the fee.';

alter table public.registrations
  drop constraint if exists registrations_discount_sane;
alter table public.registrations
  add constraint registrations_discount_sane check (
    discount_amount >= 0
    and (subtotal is null or discount_amount <= subtotal)
  ) not valid;

create index if not exists registrations_promo_code_idx
  on public.registrations (promo_code)
  where promo_code is not null;

-- ---------------------------------------------------------------------
-- 3. Reserving a use, atomically.
--
--    Returns one row describing the outcome. The API never decides whether a
--    code is usable: it asks this, and this answers from the row it just
--    locked.
--
--    `reason` is a machine value, so the API chooses the sentence a visitor
--    reads and this function never has to be redeployed to reword one.
-- ---------------------------------------------------------------------
create or replace function public.reserve_promo_use(
  p_code text,
  p_visitor_type text,
  p_subtotal integer
)
returns table (
  ok boolean,
  reason text,
  code text,
  discount_type text,
  discount_value integer,
  discount_amount integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.promo_codes;
  v_discount integer;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select false, 'missing', null::text, null::text, null::integer, 0, null::integer;
    return;
  end if;

  /* THE WHOLE CHECK IS ONE STATEMENT. The row is read and written by the same
     UPDATE, and the limit is part of its WHERE clause, so two concurrent
     bookings cannot both see capacity: Postgres takes a row lock for the
     first, the second re-evaluates the WHERE against the committed row and
     matches nothing. A SELECT followed by an UPDATE would have a window
     between them, and that window is exactly how a hundred-use code gets
     redeemed a hundred and one times. */
  update public.promo_codes p
  set current_uses = p.current_uses + 1,
      updated_at = now()
  where p.code = upper(btrim(p_code))
    and p.active
    and (p.starts_at is null or p.starts_at <= now())
    and (p.expires_at is null or p.expires_at > now())
    and (p.max_uses is null or p.current_uses < p.max_uses)
    and (
      p.applicable_categories is null
      or p_visitor_type = any (p.applicable_categories)
    )
  returning p.* into v_row;

  if found then
    v_discount := public.promo_discount_for(
      v_row.discount_type, v_row.discount_value, p_subtotal
    );
    return query select
      true,
      'ok'::text,
      v_row.code,
      v_row.discount_type,
      v_row.discount_value,
      v_discount,
      case when v_row.max_uses is null then null
           else v_row.max_uses - v_row.current_uses end;
    return;
  end if;

  /* NOTHING WAS RESERVED. Why matters to the visitor, so the row is read
     again unlocked to tell an exhausted code from an expired one from a
     code that never existed. This read cannot be wrong in a way that
     matters: it only chooses a sentence, and no use was consumed. */
  /* ALIASED. `code` is also an OUT parameter of this function's RETURNS
     TABLE, so an unqualified reference is ambiguous and Postgres refuses the
     statement at run time rather than at create time. */
  select p.* into v_row from public.promo_codes p
  where p.code = upper(btrim(p_code));

  if not found then
    return query select false, 'unknown', null::text, null::text, null::integer, 0, null::integer;
  elsif not v_row.active then
    return query select false, 'inactive', v_row.code, null::text, null::integer, 0, null::integer;
  elsif v_row.starts_at is not null and v_row.starts_at > now() then
    return query select false, 'not_started', v_row.code, null::text, null::integer, 0, null::integer;
  elsif v_row.expires_at is not null and v_row.expires_at <= now() then
    return query select false, 'expired', v_row.code, null::text, null::integer, 0, null::integer;
  elsif v_row.max_uses is not null and v_row.current_uses >= v_row.max_uses then
    return query select false, 'exhausted', v_row.code, null::text, null::integer, 0, 0;
  else
    return query select false, 'not_applicable', v_row.code, null::text, null::integer, 0, null::integer;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. The same checks WITHOUT consuming anything, for the Apply button.
--
--    A visitor typing a code into the checkout has not booked yet, and
--    burning a use of a hundred-use promotion every time somebody presses
--    Apply would exhaust it before anybody arrived. So the preview reads,
--    and only `register` reserves.
-- ---------------------------------------------------------------------
create or replace function public.preview_promo_code(
  p_code text,
  p_visitor_type text,
  p_subtotal integer
)
returns table (
  ok boolean,
  reason text,
  code text,
  discount_type text,
  discount_value integer,
  discount_amount integer,
  remaining integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.promo_codes;
begin
  -- Aliased for the same reason as in reserve_promo_use: `code` is an OUT
  -- parameter here too.
  select p.* into v_row from public.promo_codes p
  where p.code = upper(btrim(coalesce(p_code, '')));

  if not found then
    return query select false, 'unknown', null::text, null::text, null::integer, 0, null::integer;
  elsif not v_row.active then
    return query select false, 'inactive', v_row.code, null::text, null::integer, 0, null::integer;
  elsif v_row.starts_at is not null and v_row.starts_at > now() then
    return query select false, 'not_started', v_row.code, null::text, null::integer, 0, null::integer;
  elsif v_row.expires_at is not null and v_row.expires_at <= now() then
    return query select false, 'expired', v_row.code, null::text, null::integer, 0, null::integer;
  elsif v_row.max_uses is not null and v_row.current_uses >= v_row.max_uses then
    return query select false, 'exhausted', v_row.code, null::text, null::integer, 0, 0;
  elsif v_row.applicable_categories is not null
        and not (p_visitor_type = any (v_row.applicable_categories)) then
    return query select false, 'not_applicable', v_row.code, null::text, null::integer, 0, null::integer;
  else
    return query select
      true,
      'ok'::text,
      v_row.code,
      v_row.discount_type,
      v_row.discount_value,
      public.promo_discount_for(v_row.discount_type, v_row.discount_value, p_subtotal),
      case when v_row.max_uses is null then null
           else v_row.max_uses - v_row.current_uses end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Give a use back.
--
--    `register` reserves BEFORE it writes the booking, because reserving
--    afterwards would mean a booking could be created against a code that
--    turned out to be exhausted. If the insert then fails, the reservation
--    has to be returned or a failed attempt permanently costs the promotion
--    one of its uses.
-- ---------------------------------------------------------------------
create or replace function public.release_promo_use(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promo_codes
  set current_uses = greatest(current_uses - 1, 0),
      updated_at = now()
  where code = upper(btrim(coalesce(p_code, '')));
$$;

-- ---------------------------------------------------------------------
-- 6. Shared arithmetic, so the preview and the reservation can never
--    disagree about what a code is worth.
--
--    Rounded DOWN, and never more than the subtotal: a discount is money off
--    something, so it cannot exceed the something. Whole rupees, like every
--    other amount on this site.
-- ---------------------------------------------------------------------
create or replace function public.promo_discount_for(
  p_type text,
  p_value integer,
  p_subtotal integer
)
returns integer
language sql
immutable
as $$
  select greatest(
    0,
    least(
      coalesce(p_subtotal, 0),
      case p_type
        when 'percent' then floor(coalesce(p_subtotal, 0) * p_value / 100.0)::integer
        when 'amount' then p_value
        else 0
      end
    )
  );
$$;

-- ---------------------------------------------------------------------
-- 7. Locked down.
--
--    The table is served ONLY through the API's service role. `anon` must
--    never read it: the row carries `current_uses` and `max_uses`, and a
--    public read would let anyone enumerate every unreleased promotion on
--    the site. The functions are `security definer` so the API can call them
--    without the table being readable, and they are not granted to anon
--    either: everything goes through api/register.ts.
-- ---------------------------------------------------------------------
alter table public.promo_codes enable row level security;

drop policy if exists "promo codes are service role only" on public.promo_codes;
create policy "promo codes are service role only"
  on public.promo_codes for all
  to service_role
  using (true) with check (true);

revoke all on public.promo_codes from anon, authenticated;
revoke all on function public.reserve_promo_use(text, text, integer) from anon, authenticated;
revoke all on function public.preview_promo_code(text, text, integer) from anon, authenticated;
revoke all on function public.release_promo_use(text) from anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. The first promotion.
--
--    Ten per cent off the ticket subtotal, a hundred uses, every category.
--    `on conflict do nothing` so re-running this migration cannot reset the
--    counter on a code that is already in circulation.
-- ---------------------------------------------------------------------
insert into public.promo_codes
  (code, discount_type, discount_value, max_uses, active, description)
values
  ('FLASH26', 'percent', 10, 100, true,
   'Launch promotion: 10% off the ticket subtotal, first 100 bookings.')
on conflict (code) do nothing;

commit;
