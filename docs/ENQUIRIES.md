# Enquiries

`/enquiry` is a contact form that stores every message and then emails two
people about it: the desk, and the person who wrote in.

## What exists

| Piece | File |
| --- | --- |
| Page (form inline, success in place) | `src/festival/pages/EnquiryPage.tsx` |
| API | `api/enquiry.ts` |
| **Resend client, templates and escaping** | `api/_email.ts` |
| Table | `supabase/migrations/20260803_contact_enquiries.sql` |
| End-to-end test | `scripts/e2e-enquiry.mjs` (`npm run e2e:enquiry`) |

`api/_email.ts` is the project's **first and only** email integration. It is
underscore-prefixed, so Vercel does not expose it as a route and it costs
nothing against the 12-function Hobby limit (`/api/enquiry` is the 11th).

### The order, and why it matters

**Validate → store → email.** The row is the record; the emails are a
courtesy. A Resend outage, a missing key or a bounced address costs a
notification and never the message, and the response reports
`acknowledgement_sent` honestly so the page does not promise a confirmation
email that was never sent.

## Deploying

### 1. Run the migration

Supabase dashboard → **SQL Editor** → **New query** → paste the whole of
`supabase/migrations/20260803_contact_enquiries.sql` → **Run**. Idempotent.

It creates the table, four indexes, an `updated_at` trigger, and closes the
table to the browser-facing roles with both RLS and `REVOKE`.

### 2. Verify the lockdown

Both must come back **empty**:

```sql
select policyname from pg_policies
where schemaname = 'public' and tablename = 'contact_enquiries';

select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'contact_enquiries'
  and grantee in ('anon', 'authenticated');
```

An enquiry carries a name, an email, sometimes a phone number and free text
that may say anything at all. None of it is public data.

### 3. Resend

There was no email integration in this project before this page, so all of
this is new setup.

#### Before you have a domain: `onboarding@resend.dev`

Resend's shared sandbox sender works with no DNS at all, and
`RESEND_FROM="Flash @ Brigade <onboarding@resend.dev>"` is a valid value. It
has one restriction that decides whether this is useful to you:

> It can only deliver to **the email address the Resend account was
> registered with**. Any other recipient is refused with a `403`.

So on the sandbox sender:

| | Result |
| --- | --- |
| Desk copy to `ENQUIRY_RECIPIENT` | Delivers **only if** that is the Resend account address |
| Acknowledgement to a visitor | Refused, unless the visitor typed that same address |
| The enquiry row | Stored either way |

Which makes it fine for **proving the pipeline end to end** (set
`ENQUIRY_RECIPIENT` to the account address, then fill the form using that same
address and both emails arrive), and useless for real visitors. Verify a
domain before the form is public, or every visitor gets silence.

A refusal shows up in the Vercel logs as `[email] stage=send
resend_status=403`, and a refused desk copy additionally as `[enquiry]
stage=notify id=… reason=rejected`.

#### With a domain

1. Create a Resend account and **add the sending domain**. Resend will give
   you DKIM, SPF and (optionally) DMARC records to add at the DNS host for
   whichever domain the site sends as. Wait for it to verify.
   - Sending from a domain you do not control will be rejected or land in
     spam. `brigadeschools.edu.in` needs the school's DNS admin; a subdomain
     such as `mail.flashbrigade.in` is the usual way to avoid touching the
     main domain's records.
2. Create an **API key** with send permission.
3. Add both to the Vercel project (all environments):

   | Variable | Example | Notes |
   | --- | --- | --- |
   | `RESEND_API_KEY` | `re_xxxxxxxx` | Server-side only. Read in `api/_email.ts` and nowhere else. |
   | `RESEND_FROM` | `Flash @ Brigade <noreply@your-verified-domain>` | Must be **on the verified domain**. |
   | `ENQUIRY_RECIPIENT` | `sumukh.nayak@outlook.com` | Optional. Where the desk copy goes; the code defaults to this address. |

4. Redeploy.

Until steps 1–4 are done the form still works and still stores every enquiry.
It simply cannot email anyone, the failure is logged as
`[enquiry] stage=notify … reason=unconfigured`, and the success screen drops
its mention of a confirmation email.

### 4. Reading the enquiries

No admin UI yet. Until there is one:

```sql
select created_at, full_name, email, mobile, subject, message, marketing_opt_in
from public.contact_enquiries
where status = 'new'
order by created_at desc;
```

Mark one handled with `update public.contact_enquiries set status = 'replied'
where id = '…';`. Statuses are `new`, `replied`, `closed` — lower case, to
match `payment_status`, `visitor_type` and `role` elsewhere in this schema.

## Security

- **Server-side validation.** The page's rules are a courtesy; `api/enquiry.ts`
  revalidates everything and never trusts the client. Consent and its
  timestamp are recorded server-side.
- **Sanitisation.** Names and emails go through `cleanText`. The message is
  cleaned by hand instead, because `cleanText` collapses whitespace and would
  flatten a multi-paragraph enquiry into one line: control characters are
  stripped, newlines kept, blank-line runs capped, length capped at 4000.
- **XSS.** Every value interpolated into either email is HTML-escaped
  (`escapeHtml` / `escapeParagraph` in `api/_email.ts`). The desk copy is the
  more dangerous of the two, because we are the ones who open it.
- **Rate limiting.** Counted against the enquiries table itself, so there is
  no second table and no in-memory counter for a serverless function to lose:
  3 per email address and 8 per source IP hash in 10 minutes, answered `429`
  with `Retry-After`. A failed count **fails open** — one extra enquiry beats
  a form nobody can use.
- **Duplicates.** An identical message from the same address within 5 minutes
  returns `200` with the original id and sends nothing further, so a double
  click or a bfcache replay is not a second enquiry.
- **IP addresses are never stored.** Only a SHA-256, and only to make rate
  limiting work for a sender who varies their email.
- **The Resend key never reaches the client.** It is read in `api/_email.ts`,
  sent as a bearer header, and never returned or logged. The test asserts it
  appears in no message body.

## Testing

```bash
npm run e2e:enquiry
```

Runs the **real handler** against the shared PostgREST stub and a local Resend
stand-in that records what was posted. It covers validation, the stored row,
both emails, the `Reply-To`, HTML escaping, duplicates, rate limiting, and the
two failure modes (Resend rejecting, Resend unconfigured) that must still
return `201` with the enquiry safely stored.
