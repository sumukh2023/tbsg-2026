# Volunteer & administrator authentication

The gate portal used to be guarded by one shared code (`VERIFIER_ACCESS_CODE`).
It is now an account system: every volunteer signs in as themselves, every
check-in is attributed to a person, and access can be withdrawn from one
individual without changing anything for anyone else.

That change is the point. A shared code cannot be revoked from one volunteer,
cannot tell you who admitted a guest, and is only as private as the least
careful person holding it.

---

## Deployment, in order

The migration must run **before** the code that needs it. `/api/verify` now
requires a volunteer session and will not fall back to a code, so a deploy
that lands first would close the gate.

### 1. Run the migration

Supabase → SQL Editor → paste and run:

```
supabase/migrations/20260802_volunteer_authentication.sql
```

It creates `volunteers`, `volunteer_sessions`, `volunteer_login_attempts` and
`verification_events`, adds two reporting views, and repoints
`passes.checked_in_by` at `volunteers.id`. Existing free-text check-ins are
preserved in `passes.checked_in_by_name`, so nothing that already happened is
lost. Safe to run twice.

Then run the second file:

```
supabase/migrations/20260802_restrict_volunteer_views.sql
```

The first migration's two reporting views arrive **UNRESTRICTED** — a view has
no RLS of its own, and Supabase grants `anon` select on new objects in
`public` by default, so the gate's activity log and volunteer roster would be
readable with the public anon key. This revokes that grant and sets
`security_invoker` so the underlying tables' RLS applies. The API is
unaffected: it reads with the service-role key.

### 2. Create the first administrator

There is no sign-up, so the first account is made by hand — there is no
administrator yet to authorise it. From a checkout of this repo:

```bash
node scripts/hash-password.mjs you@brigadeschools.edu.in "Your Full Name"
```

It asks for the password twice **without echoing it**, so it never appears on
screen, in your shell history, or in the process list. It prints an Argon2id
hash and the exact `insert` to paste into the Supabase SQL editor.

Choose a long passphrase. Minimum is 12 characters and length beats
punctuation — four ordinary words are stronger and easier to type on a phone
at a gate than `P@ssw0rd!`.

> Only the hash leaves the script. Never put a plaintext password in SQL, in a
> commit, or in a chat message.

### 3. Remove the retired variable

In Vercel → Project → Settings → Environment Variables, **delete
`VERIFIER_ACCESS_CODE`**. Nothing reads it. A live shared code is exactly what
this replaced, and leaving it set invites someone to try it.

**No new environment variables are needed.** The system uses the `SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` that already exist.

### 4. Deploy, then sign in

Visit **`/volunteer`** or **`/admin`**. You will be sent to `login` under
whichever of the two you opened.

The portal answers on both addresses and NEITHER redirects to the other: the
one you arrive at is the one you stay under, so an administrator who opened
`/admin` gets the dashboard at `/admin/admin`. `/verify-pass` is the portal's
original address and still works, redirecting with the rest of the path
intact; it cannot be removed, because it is printed as a QR code on every
pass issued before the rename. See `src/festival/pass/routes.ts`.

**Sign-in is role-blind** — it never looks at `role`, so an administrator and a
volunteer sign in through the same form with the same rules. Where you land
afterwards differs: an administrator goes to **`<base>/admin`**, the
festival desk; a volunteer goes straight to the scanner. A specific link (a
scanned pass) always wins over both, so a QR survives the detour through the
login page.

### Cannot sign in?

The single "Invalid email or password." covers five different causes on
purpose, so the form gives away nothing. To see which one it is:

```sql
select email, role, active, failed_attempts, locked_until,
       locked_until > now() as currently_locked, last_login
from public.volunteers order by created_at desc;

select created_at, email, successful, reason
from public.volunteer_login_attempts order by created_at desc limit 15;
```

`reason` is the answer: `bad_password`, `unknown_email`, `locked`, `disabled`,
`rate_limited` or `malformed`.

**If `successful` is TRUE and you still cannot get in, the password is not the
problem** — authentication passed and the session did not survive. The login
page now says exactly that instead of blaming the password. It means the
browser did not store or return the cookie: cookies blocked for the site,
Private Browsing, or an extension. `npm run e2e:auth` reproduces both the
working path and this one against the real handlers in a real browser.

**`locked` is the one that catches people out.** Five failed attempts locks the
account for fifteen minutes, and from then on the CORRECT password is refused
with the same sentence — so it reads exactly like still getting the password
wrong. Wait it out, unlock from the dashboard, or clear it directly:

```sql
update public.volunteers
   set failed_attempts = 0, locked_until = null
 where lower(email) = lower('you@brigadeschools.edu.in');
```

Re-running the `insert` from `hash-password.mjs` also clears it, because its
`on conflict` branch resets `failed_attempts` and `locked_until`.

### Adding the rest of the team

Two ways, both fine:

- **The dashboard** at `<base>/admin` — an "Add a volunteer" form, plus
  disable / enable / unlock / reset password / promote / demote per person,
  and the recent gate activity. This is the normal route.
- **`hash-password.mjs`**, which now takes a role, for when nobody can sign in
  yet: `node scripts/hash-password.mjs them@school.edu.in "Their Name" admin`
  (role defaults to `volunteer`).

---

## Roles

| | Volunteer | Administrator |
|---|---|---|
| Sign in | yes | yes |
| Scan QR, type a reference | yes | yes |
| Verify a pass, view attendee details | yes | yes |
| Check in an attendee | yes | yes |
| Undo a check-in | **no** | yes |
| Create / disable / promote accounts | **no** | yes |
| Reset another person's password | **no** | yes |
| Read activity logs | **no** | yes |

Undo is an administrator action because it reverses a decision already taken
at the gate.

Roles are enforced on the **server**, in `requireAdmin`. The UI hides what you
cannot do, but hiding a button is not a permission — a volunteer calling the
admin API directly gets a 403.

---

## How a session works

1. `POST /api/auth/login` verifies the password with Argon2id.
2. The server mints a 32-byte random token, stores **only its SHA-256 hash**
   in `volunteer_sessions`, and returns the token in a cookie — never in the
   response body.
3. The cookie is `fb_volunteer`: `HttpOnly`, `Secure`, `SameSite=Lax`,
   `Path=/`, 12-hour expiry. **Not `__Host-` prefixed** — a prefixed cookie
   that fails any of the prefix's conditions is rejected SILENTLY, which
   presents as "my correct password was refused", and `vercel.app` is on the
   Public Suffix List so the protection it bought was already redundant.
4. Every protected request re-reads the row and re-checks expiry, revocation
   and whether the account is still active.

Because step 4 happens on every request, logging out, disabling an account or
resetting a password takes effect **immediately**, not whenever a token
happens to run out.

Nothing authentication-related is kept in `localStorage` or `sessionStorage`.
A token in web storage is readable by any script that ends up on the page,
which is the whole reason the cookie is `HttpOnly`.

---

## Endpoints

| Route | Method | Who | Purpose |
|---|---|---|---|
| `/api/auth/login` | POST | anyone | Sign in; sets the session cookie |
| `/api/auth/logout` | POST | anyone | Revoke the session; clear the cookie |
| `/api/auth/session` | GET | anyone | Who am I? `{volunteer: null}` when nobody |
| `/api/auth/password` | POST | signed in | Change your own password |
| `/api/verify` | POST | volunteer | `verify` · `checkin` · `undo` (admin) |
| `/api/admin/volunteers` | GET/POST | admin | List; create, disable, enable, reset, promote, demote |
| `/api/admin/activity` | GET | admin | `?view=timeline\|totals\|logins` |

> **Why six paths but two files.** Vercel's Hobby plan allows twelve
> serverless functions per deployment and one file per action put the project
> at thirteen, which fails the build outright. `api/auth.ts` and `api/admin.ts`
> each serve their whole group, dispatched on `?action=` / `?resource=`, and
> `vercel.json` rewrites the pretty paths onto them. Callers see no
> difference. If you add another route, check the count first:
> `find api -name '*.ts' | grep -v '/_' | wc -l` (currently 9).
>
> `vercel.json` itself is schema-validated with `additionalProperties: false`,
> so it cannot carry a comment — not even a `_comment` key, which fails the
> build with *"should NOT have additional property"*. Explanations for what is
> in that file belong here.

Account management, all `POST /api/admin/volunteers`:

```jsonc
{ "action": "create",  "full_name": "…", "email": "…", "password": "…" }
{ "action": "disable", "id": "<uuid>" }   // also kills their live sessions
{ "action": "enable",  "id": "<uuid>" }
{ "action": "reset",   "id": "<uuid>", "password": "…" }
{ "action": "promote", "id": "<uuid>" }   // -> admin
{ "action": "demote",  "id": "<uuid>" }   // -> volunteer
```

There is deliberately **no delete**. An account that checked people in must
keep existing for the audit trail to resolve to a name; `disable` is the
retirement path. An administrator also cannot act on their own account, so
nobody locks themselves out mid-event.

---

## Audit trail

Every gate action writes a row to `verification_events`:

- `volunteer_id` → `volunteers.id`
- `volunteer_role` — the role **at the time**, so promoting someone later does
  not rewrite the authority their past actions were taken under
- `action` — `verify` · `checkin` · `undo` · `lookup_failed`
- `result`, `pass_reference`, `pass_id`, `created_at`

The volunteer's **name is never copied into an event**. It is joined from
`volunteers`, so correcting a spelling corrects every past report at once.
Two views are provided:

```sql
select * from verification_activity order by created_at desc limit 50;
select * from volunteer_checkin_totals order by checkins desc;
```

Answering the questions the task asked for:

```sql
-- Who checked in each attendee
select p.pass_reference, r.full_name, v.full_name as checked_in_by, p.checked_in_at
from passes p
join registrations r on r.id = p.registration_id
left join volunteers v on v.id = p.checked_in_by
where p.status = 'checked_in';

-- Undo history
select pass_reference, volunteer_name, created_at
from verification_activity where action = 'undo' order by created_at desc;
```

---

## Security summary

| Concern | How it is handled |
|---|---|
| Password storage | Argon2id, 19 MiB / t=2 / p=1 (OWASP), per-password salt inside the PHC string |
| Password comparison | Argon2 verify — constant-time w.r.t. the hash |
| Account enumeration | One sentence for every failure, and a miss still pays for a full hash so the timing matches |
| Brute force | Durable ledger: 5 failures per email and 20 per source IP-hash in 15 minutes, plus a 15-minute account lockout |
| Session theft | Opaque token in an `HttpOnly` `__Host-` cookie; only its SHA-256 hash is stored, so a database dump cannot be replayed |
| CSRF | `SameSite=Strict` (the cookie is never sent cross-site) plus an `Origin` check on every state-changing route |
| Privilege escalation | Role checked server-side on every admin route; role changes revoke that person's sessions |
| Open redirect | `next=` is accepted only when it is a path inside the portal (`/volunteer`, `/admin` or `/verify-pass`) |
| SQL injection | No SQL is built from input; everything goes through PostgREST with encoded parameters |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` anywhere in the portal |
| Secret exposure | The service-role key is server-only. No hash, token or lockout field appears in any response |
| IP privacy | Rate limiting stores a SHA-256 of the address, never the address |
| Caching | `Cache-Control: no-store, private` on session and admin reads, so a shared gate tablet cannot serve one volunteer's identity to the next |
| Database exposure | RLS on every table with no anon policies, **plus** explicit `revoke` from `anon`/`authenticated` and `security_invoker` on both views — RLS alone does not cover a view |

### Deliberately not built

- **Supabase Auth** — excluded by the brief; this is a standalone system.
- **Password reset by email** — needs an email sender the project does not
  have. An administrator resets passwords instead, which is the right model
  for a one-day event. The `must_change_password` column already exists for it.
- **2FA** — the schema accommodates it (add columns to `volunteers`) but a
  one-day school carnival does not warrant the operational load.

---

## Future work this supports without refactoring

`volunteers` and `volunteer_sessions` are the pieces most features would need:
an administrator dashboard reads the two views; volunteer management is the
admin API; password reset adds a token table; 2FA adds columns; finer
permissions become a `permissions` column or table read in `requireAdmin`;
account lockout policy is already there as `failed_attempts` / `locked_until`;
session management is already row-per-session with a `client_label` and
`last_seen_at`, so a "sign out my other devices" screen is a query away.
