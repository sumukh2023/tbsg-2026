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

## 5. Supporting documents

One optional attachment per approach: PDF, Word or PowerPoint, up to 10 MB,
into a **private** Supabase Storage bucket called `partner-documents`.

| Piece | Where |
| --- | --- |
| The control | `src/festival/forms/DocumentField.tsx` |
| The rules (client copy) | `src/festival/forms/documentRules.ts` |
| The transfer | `src/festival/forms/uploadDocument.ts` |
| The rules (authority) | `api/_storage.ts` |
| The columns and the bucket | `supabase/migrations/20260805_partner_documents.sql` |

### Why the bytes do not go through the API

A Vercel serverless function accepts a **4.5 MB** request body. A 10 MB file
base64'd into JSON is 13.3 MB, so a file routed through the function could
not be sent at the briefed size at all. Instead:

1. `POST /api/partner-interest?action=upload` with `{ filename, size }`
   returns a one-off **signed upload URL**, the storage path, an HMAC token
   over that path, and the content type to send.
2. The browser `PUT`s the file **straight to Supabase Storage**. Vercel never
   sees the bytes.
3. `POST /api/partner-interest` carries `document: { path, token, name }`.
   The server verifies the token, then **reads the object back out of
   Storage** and records the size and content type it actually finds there.

`?action=upload` hangs off the existing route rather than being a route of
its own because `api/` holds **twelve** functions and the Vercel Hobby plan
allows twelve. A thirteenth file does not deploy — it fails the build.

### What is trusted, and what is not

- The client never chooses the storage path. The server generates
  `<uuid>/<sanitised-name>`.
- The path comes back **signed**, so a submit cannot attach an object the
  server did not issue a place for.
- The content type is derived from the **extension by the server**, not read
  from what the browser claimed — browsers report `.doc` and `.ppt` as
  `application/octet-stream` often enough that trusting the claim means
  either rejecting real documents or accepting anything.
- `document_size` and `document_type` on the row are **read from Storage**
  after the upload. The declared size is checked first only so an oversized
  file is refused before it is sent.
- Executables and archives are refused by name; everything outside the
  five-type allowlist is refused anyway.
- Both emails carry a **signed URL that expires in 30 days**. No code path
  here produces a public URL.
- An approach that is rate-limited, duplicated or fails to insert **deletes
  its uploaded object** rather than leaving a stranger's file in the bucket.

### Post-deployment steps

Do these in order, before the first real submission.

**1. Run the migration.** `supabase/migrations/20260805_partner_documents.sql`
in the Supabase SQL editor. It adds the four `document_*` columns, the
"complete or absent" check constraint, the partial index, **and creates the
bucket** with its size and MIME limits. Safe to run more than once.

**2. Confirm the bucket is private and capped.** Storage → `partner-documents`
→ Settings, or:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'partner-documents';
```

`public` must be `false` and `file_size_limit` `10485760`. These bucket-level
limits are the real enforcement: between the signed URL being issued and the
file landing there is no code of ours in the path, so the bucket is what
stops a signed URL being used to upload something enormous.

**3. Confirm no policy exposes it.** `storage.objects` has RLS on by default,
and with no policy naming this bucket `anon` cannot read, list or write in
it. This must come back empty:

```sql
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and qual like '%partner-documents%';
```

Do **not** add a "public read" policy to make the email links work — they are
signed URLs and work without one.

**4. No new environment variables.** The upload signs paths with
`SUPABASE_SERVICE_ROLE_KEY`, which is already set. Nothing to add in Vercel.

**5. Send one real approach** with a small PDF attached and check three
things: the row has all four `document_*` columns filled, the desk email
carries a link that opens the file, and the link still names the file the
sender chose.

### Housekeeping

An upload whose form is then abandoned in the browser leaves an object with
no row. Nothing deletes those automatically. Once a term, list the orphans:

```sql
select name, created_at, (metadata->>'size')::bigint as bytes
from storage.objects o
where o.bucket_id = 'partner-documents'
  and not exists (
    select 1 from public.partner_interest p where p.document_path = o.name
  )
order by created_at;
```

and delete them from the Storage browser. Signed download links expire after
30 days; re-issue one from the Storage browser if the desk needs it later.

## 6. Reading the approaches

No admin UI yet. Until there is one, in the Supabase table editor:

```sql
select created_at, organisation_name, contact_person, email, mobile,
       sponsorship_interest, estimated_value, status,
       document_name, document_path
from public.partner_interest
where status = 'new'
order by created_at desc;
```

A `document_path` is an object key, not a URL. To open one, find it under
Storage → `partner-documents` and use "Get URL" there, which mints a fresh
signed link.

Then move each row's `status` on as the team works through them.
