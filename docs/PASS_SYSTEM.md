# Flash @ Brigade: live updates + digital pass system

How the event-day systems work and what still needs credentials.

## Architecture

Static Vite SPA + Vercel Functions (`api/`, **Node.js runtime**) +
Supabase (Postgres, RLS, Realtime). All privileged access uses
`SUPABASE_SERVICE_ROLE_KEY` inside the server functions only; the
browser never sees it.

> Runtime note: these functions deliberately do NOT use the Edge runtime.
> On Edge, environment variables in a non-framework project are injected
> at deploy time and `process.env` reads proved unreliable (the verify
> endpoint 503'd before ever reaching Supabase). The Node runtime reads
> them dynamically per request; everything used (fetch, WebCrypto,
> TextEncoder) is global in Node 18+. Handlers use the classic
> `(VercelRequest, VercelResponse)` signature, which every @vercel/node
> version invokes unambiguously (web-standard `Request` handlers are
> version-dependent and broke registration when the runtime switched).
> If env vars are added or changed in Vercel, **redeploy** so every
> runtime picks them up.

### /api/verify status semantics

| Status | Meaning |
| --- | --- |
| 200 | `valid` or `checked_in` (successful check-in) |
| 401 | wrong volunteer access code |
| 404 | token unknown → INVALID PASS |
| 409 | already checked in (body carries original time/operator) |
| 410 | cancelled pass |
| 503 | configuration or database unavailable (never a verdict) |
| 500 | unexpected failure |

The volunteer UI renders network failure ("Network unavailable", fetch
threw) and service failure ("Service unavailable", 5xx answered)
distinctly, and neither is presented as an invalid pass. Missing env vars
are logged to Vercel Logs by NAME only, e.g.
`[verify] Missing required environment variable: SUPABASE_URL`.

### Registration and pass minting

1. `/get-passes` posts to `POST /api/register`.
2. The function validates/sanitizes, stores the registration, then mints a
   pass: a 192-bit random token (returned to the visitor exactly once) and
   its SHA-256 hash + a human-readable reference (`FB26-XXXXX`) stored in
   `passes`.
3. The success screen renders the digital pass. The QR encodes only
   `https://<site>/volunteer/<token>`; no personal data is inside it. Passes
   issued before the portal was renamed carry `/verify-pass/<token>`, which
   still resolves.

### Verification and check-in (event day)

- Volunteers scan the QR, which opens `/volunteer/<token>` (or the older
  `/verify-pass/<token>`, which redirects to it carrying the token).
- The page asks once per browser session for the shared
  `VERIFIER_ACCESS_CODE` (server-side env; every action re-checks it, so
  no secret ships in the bundle).
- `POST /api/verify` decides everything against the database:
  - `VALID PASS` → shows guest, type, passes, reference + a check-in button
  - `ALREADY CHECKED IN` → shows the original check-in time and operator
  - `CANCELLED / INVALID PASS`
  - network failure → a distinct "Unable to verify: network unavailable"
    state that never reads as an invalid pass
- Check-in is a conditional update (`status=eq.valid` filter), so two
  volunteers scanning simultaneously cannot double-admit: the second scan
  reports the first one's timestamp.

### Pass retrieval

`/pass` asks for the registration email, mobile number **and name**, and
calls `POST /api/retrieve`. Responses are identical for wrong details and no
match (no enumeration); on success the verification token is rotated, so
old links die and the visitor gets a fresh `/pass/<token>` presentation.

The name is matched **leniently** and the other two are not. An address and a
number have one correct form; a name does not, so the comparison folds case,
runs of whitespace (tabs and newlines included) and combining accents before
comparing. It is a third thing the requester has to know, not a spelling test.
Because that comparison cannot be written as a PostgREST filter, candidates
are fetched by email and phone and folded in memory, and more than one is
fetched: a household can hold several registrations on a shared address and
number, so taking only the newest would refuse everyone but the last person
to book. Covered by `npm run e2e:retrieve`.

### Live updates

- Table `updates` with RLS: anon may `select` only `published = true`.
- Publish by inserting/flipping `published` (see seed examples in
  `supabase/schema.sql`).
- With `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set, the homepage
  subscribes to Supabase Realtime and new updates appear without refresh
  (anon key in the client is by design; RLS constrains it).
- Without them, the client polls `GET /api/updates` once a minute.
- Unread state lives in `localStorage` per visitor.

## Required configuration (Vercel project settings)

| Variable | Where used | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Edge functions | project REST URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions | never client-side |
| `VERIFIER_ACCESS_CODE` | `api/verify.ts` | shared gate-volunteer code |
| `VITE_SUPABASE_URL` | browser | optional, realtime |
| `VITE_SUPABASE_ANON_KEY` | browser | optional, safe with RLS |

Run `supabase/schema.sql` once in the Supabase SQL editor.

## Apple Wallet (not yet enabled)

`api/wallet-apple.ts` is the integration point and currently answers 501.
Enabling it requires an Apple Developer account and:

- `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID` (registered Pass Type ID)
- `APPLE_PASS_CERT_P12_BASE64` + `APPLE_PASS_CERT_PASSWORD`
  (the Pass Type ID certificate; never commit it)

Implementation: build an `eventTicket` `pass.json` + assets, a
`manifest.json` of SHA-1 digests, sign it (PKCS#7) with the certificate,
zip as `.pkpass`, serve as `application/vnd.apple.pkpass`, and store the
serial in `passes.apple_wallet_serial`. Signing needs Node's crypto stack,
so switch that one function off the Edge runtime when implementing. The
UI intentionally shows no Apple Wallet button until this returns real
passes.

## Google Wallet (not yet enabled)

`api/wallet-google.ts` is the integration point and currently answers 501.
Enabling it requires a Google Wallet Issuer account and:

- `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_CLASS_SUFFIX`
- `GOOGLE_WALLET_SA_EMAIL` + `GOOGLE_WALLET_SA_PRIVATE_KEY_PEM`
  (service-account key; never commit it)

Implementation: create an `EventTicketClass` once, then per pass an
`EventTicketObject` (event, venue, guest, barcode = verification URL),
sign a `savetowallet` JWT (RS256) server-side and redirect to
`https://pay.google.com/gp/v/save/<jwt>`; store the object id in
`passes.google_wallet_object_id`. The UI shows no Google Wallet button
until then. The QR pass is the universal fallback either way.

## Event-day notes

- Verification requires connectivity; the volunteer UI makes network
  failure explicit and never converts it into a verdict.
- The verifier page is built for rapid repeated scanning: the access code
  persists for the session, each scan is one tap to check in.
