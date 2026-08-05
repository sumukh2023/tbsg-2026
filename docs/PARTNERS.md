# Partners and the sponsor Expression of Interest

The `/partners` page and the `/partner-interest` form behind its call to
action, plus the table and the endpoint they write to.

## What exists

| Piece | Where |
| --- | --- |
| The page | `src/festival/pages/PartnersPage.tsx` |
| The form | `src/festival/pages/PartnerInterestPage.tsx` |
| The endpoint | `api/partner-interest.ts` |
| The table | `supabase/migrations/20260805_partner_interest.sql` |
| The emails | `api/_email.ts` (shared with `/api/enquiry`) |
| The test | `npm run e2e:partner` |

The form is built entirely from pieces that already existed — the Get Passes
field primitives (`FloatingInput`, `FloatingSelect`, `FloatingTextarea`,
`Consent`), the shared transactional chrome in `src/festival/forms/` and the
same evening ground as Donate. What is new is the questions.

## 1. The table

Run `supabase/migrations/20260805_partner_interest.sql` in the Supabase SQL
editor **before** deploying. `/api/partner-interest` inserts into
`partner_interest` and answers 503 until it exists. The file is safe to run
more than once.

The full statement is in that file; it also creates the indexes, the
`updated_at` trigger, and — importantly — closes the table with **both** RLS
and a `revoke`, because a row here names a company, a named contact, their
direct number and what they are willing to spend.

`status` is `new` → `contacted` → `closed`, lower case to match every other
enumerated column in this schema.

## 2. Environment

Nothing new. The endpoint uses exactly what `/api/enquiry` already uses:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | storing the row | already set |
| `SUPABASE_SERVICE_ROLE_KEY` | storing the row | already set; server-side only |
| `RESEND_API_KEY` | both emails | already set; read in `api/_email.ts` and nowhere else |
| `RESEND_FROM` | both emails | must be on a verified domain |
| `ENQUIRY_RECIPIENT` | the desk copy | **one value for the whole site** — see below |

Without `RESEND_API_KEY`/`RESEND_FROM` the form still works and still stores
every approach. It simply cannot email anyone, the failure is logged as
`[partner] stage=notify … reason=unconfigured`, and the success screen drops
its mention of a confirmation email rather than promising one that never
went.

### The desk address is centralised

`deskInbox()` in `api/_email.ts` is the only place any form reads the
recipient from, and it reads `ENQUIRY_RECIPIENT`. Both `/api/enquiry` and
`/api/partner-interest` call it.

So when `enquiries@flashatbrigade.com` exists, set `ENQUIRY_RECIPIENT` to it
once in the Vercel project and redeploy. **That is the whole change** — no
code, and no second place to remember.

## 3. Resend

No new configuration. The two messages this endpoint sends use the same
sender, the same branded shell and the same escaping as the enquiry form:

- **Desk copy** → `deskInbox()`, subject `[Partner Interest] <Organisation>`,
  `Reply-To` set to the visitor. Hitting Reply in the desk inbox writes to the
  organisation, not to the noreply sender. Carries the organisation, contact,
  contact details, sponsorship interest, estimated value, proposal and
  timestamp.
- **Acknowledgement** → the visitor, subject `We have your Expression of
  Interest`.

Both are sent AFTER the row is stored, and neither can fail the request.

## 4. Deployment notes

**The Hobby function ceiling is now full.** `api/partner-interest.ts` is the
twelfth serverless function, and Vercel Hobby allows twelve. Adding a
thirteenth file to `api/` will fail the build, not degrade quietly. Count
before adding a route:

```bash
find api -name '*.ts' | grep -v '/_' | wc -l   # must stay <= 12
```

Underscore-prefixed files (`_shared`, `_auth`, `_email`) are not routes and do
not count. The next route to be added should be folded into an existing
function behind a `?resource=`/`?action=` parameter, the way `api/admin.ts`
and `api/auth.ts` already are.

Nothing else is needed: `/api/partner-interest` is a file-named route, so
`vercel.json` needs no rewrite, and the SPA catch-all already excludes
`/api/`.

## 5. What is deliberately not built

**File upload.** The Additional Information section says, in the interface,
that uploads are not open and asks for attachments as a reply to the
acknowledgement email instead. There is no storage bucket, no signed-upload
route and no size or type gate anywhere in this project; a control that
looked like an upload would have been a lie to whoever used it. When storage
is added, that panel is where the real control goes.

## 6. Reading the approaches

No admin UI yet. Until there is one, in the Supabase table editor:

```sql
select created_at, organisation_name, contact_person, email, mobile,
       sponsorship_interest, estimated_value, status
from public.partner_interest
where status = 'new'
order by created_at desc;
```

Then move each row's `status` on as the team works through them.
