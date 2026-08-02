# Donations

`/donate` takes a donation from a form to a recorded intent. There is **no
payment gateway**, and nothing in this system ever writes
`payment_status = 'paid'` until one is added.

## What exists

| Piece | File |
| --- | --- |
| Page (form → review → processing → thank you) | `src/festival/pages/DonatePage.tsx` |
| Amount plates + custom field | `src/festival/donate/AmountField.tsx` |
| Amount constants shared with the API | `src/festival/donate/amounts.ts` |
| **The payment seam** | `src/festival/donate/payment.ts` |
| API | `api/donate.ts` |
| Table | `supabase/migrations/20260802_donations.sql` |

The page owns the form, validation, review and success screens. It calls
`settleDonation()` exactly once, between review and thank-you, and renders the
outcome. It has no idea whether a gateway exists.

## Deploying

### 1. Run the migration

Supabase dashboard → **SQL Editor** → **New query** → paste the whole of
`supabase/migrations/20260802_donations.sql` → **Run**.

It is idempotent, so running it twice is safe. It creates the table, four
indexes, an `updated_at` trigger, and closes the table to the browser-facing
roles with both RLS and `REVOKE`.

### 2. Verify the lockdown

Both of these must come back **empty**:

```sql
select policyname from pg_policies
where schemaname = 'public' and tablename = 'donations';

select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'donations'
  and grantee in ('anon', 'authenticated');
```

An empty first result means RLS is on with no policies, so the table is closed
to `anon` and `authenticated`. An empty second means Supabase's default grant
on new objects in `public` has been taken back. Both layers matter: this
project has shipped a hole before by relying on only one of them.

The API reaches the table with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS
by design. Donor names, emails, phone numbers and amounts are not public data
and must never be readable through the anon API.

### 3. Environment

Nothing new. `/api/donate` uses the two variables the rest of the API already
needs, in the Vercel project settings:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If either is missing the endpoint answers `503` with a sentence saying the
service is not configured, and the name of the missing variable appears in the
Vercel logs (never its value).

### 4. Reading the donations

There is no admin UI for these yet. Until there is, the Supabase table editor
is the desk's view:

```sql
select created_at, full_name, email, phone, donor_type, organisation,
       amount, recognition_preference, marketing_opt_in
from public.donations
where payment_status = 'pending'
order by created_at desc;
```

## Adding a payment gateway

The whole integration is three edits, none of which touch the form, the
validation, the review screen, the success screen or the table.

**1. `api/donate.ts`** — there is a marked `>>> PAYMENT GATEWAY SEAM <<<`
block after the insert. Create the gateway order there against `row.id` and
return its id:

```ts
const order = await razorpay.orders.create({
  amount: payload.amount * 100,   // paise; the column stores whole rupees
  currency: 'INR',
  receipt: row.id,
});
return send(res, 201, { id: row.id, order_id: order.id, key: RAZORPAY_KEY_ID });
```

**2. `src/festival/donate/payment.ts`** — `settleDonation` currently records
the intent and returns `settled: false`. Open the checkout after
`recordIntent` resolves, and return `settled: true` once the payment is
verified. The marked `>>> GATEWAY GOES HERE <<<` block is the only place that
changes. Flip `PAYMENTS_LIVE` to `true`.

**3. A new endpoint** — verify the gateway's signature **server-side** and
PATCH the row:

```sql
update public.donations
set payment_status = 'paid', payment_reference = $1, paid_at = now()
where id = $2;
```

Never trust the browser's word that a payment succeeded. The
`donations_payment_coherent` constraint refuses a `paid` row without both a
reference and a timestamp, and `donations_payment_reference_key` makes a
webhook replay a no-op rather than a duplicate.

### Why the success screen needs no edit

It branches on `outcome.settled`, not on a hard-coded assumption. While
`settled` is false it shows the "payment integration is currently under
development" note; the moment `settleDonation` starts returning `true` that
paragraph disappears on its own and the icon changes from a heart to a tick.

## Amount handling

Whole rupees everywhere: in the column, in the API, in the page, in the URL of
nothing. Paise are a gateway concern and the conversion belongs at its
boundary, so no stored or displayed value ever depends on when it was written.

- Presets: ₹500, ₹1,000, ₹2,500, ₹5,000, ₹10,000.
- Custom: positive integers only, enforced at the keystroke, so no state can
  hold `12.5`, `-4` or `1e9`.
- Floor: `MIN_DONATION` (₹100), deliberately **below** the smallest preset, so
  someone giving ₹200 is not refused because the cheapest button says ₹500.
  Mirrored as `MIN_AMOUNT` in `api/donate.ts`, which is the authority.
- Ceiling: ₹1,00,00,000, matching the column's check, so a value the database
  would reject is refused with a sentence instead of a 500.
