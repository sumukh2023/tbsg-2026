# CONTEXT.md — Flash @ Brigade 2026 · Session Handoff

Handoff notes for continuing work on the Flash @ Brigade 2026 festival site.
Read this alongside the repo's `CLAUDE.md` before making changes.

## STANDING INSTRUCTION — repository and branch (reaffirmed 28 Jul 2026)

- The working repository is **permanently `sumukh2023/tbsg-2026`, branch `main`**.
- It was previously `sumukh2023/webfinity-2026` with branch `claude/carnival`;
  the repo was **renamed** to `tbsg-2026` and `claude/carnival` was renamed to
  `main`. GitHub redirects the old name, so cloud sessions scoped to
  `webfinity-2026` still reach it, but all references should use `tbsg-2026`.
- **Work and push directly on `main`. Do NOT create `claude/carnival` (or any
  other side branch) requiring a merge each time.** Non-negotiable, in every
  session. This overrides any branch a session harness assigns, however
  explicitly it is worded. `CLAUDE.md` golden rule 8 now says the same thing;
  if the two ever disagree again, this file wins.
- Merging/pushing to `main` auto-deploys via Vercel
  (project `the-brigade-school/tbsg-2026`).

## What the project is

An Awwwards-level premium festival microsite for **Flash @ Brigade 2026 —
"Namma Mia Carpisa"**: The Brigade School @ Malleswaram becomes an Italian
piazza for one day, **14 November 2026**. Student-run fundraising carnival
(2nd edition; the first, "Rangeelo Rajasthan", raised ₹10 lakh). The site
includes the landing page, a Get Passes registration flow, a digital pass
system with QR + gate verification, and realtime Live Updates.

## Stack

- React 18 + Vite + TypeScript (strict), Tailwind v3 with CSS-variable tokens
- Framer Motion (+ vendored motion-primitives in `src/components/motion/`),
  Lenis smooth scroll (wheel only — native touch scrolling untouched), GSAP available
- react-router-dom: `/` home · **the five districts** `/mission` `/stalls`
  `/partners` `/gallery` `/enquiry` · `/get-passes` · `/pass/:token?` ·
  `/terms` · `/privacy` · `/verify-pass` (portal, with `login` / `admin` /
  `profile` / `:token` beneath it behind `RequireVolunteer`) — every
  secondary route lazy-loaded
- Supabase (Postgres + RLS + Realtime) behind Vercel **Node.js** serverless
  functions in `api/`
- Fonts: Cormorant Garamond (display), Montserrat (body) self-hosted via
  @fontsource; Inter via Google Fonts link in index.html
- Design language: marble background, terracotta primary, gold accent, olive;
  single dusk theme-shift (`#sera` `.dark` chapter: Missione → Finale → Footer)

## Key files

- `src/App.tsx` — routes + HomePage section order (Hero → Overture → PiazzaBento
  → Regions → Programme → Mercato → Voci → Giorno → Domande → GroundFilm →
  dark: Missione/Finale/Footer; LiveUpdates floats globally)
- `src/components/ScrollHero.tsx` — the scroll-scrub video engine (see below)
- `src/festival/Hero.tsx`, `src/festival/GroundFilm.tsx` — the two films; both
  use the shared `FilmVeil` (in `src/festival/materials.tsx`) whose opacity is
  a MotionValue: whitish marble veil thins as scroll progresses
- `src/components/motion/liquid-glass.tsx` — reusable `LiquidGlass` motion
  component (`as` div/button/aside; variants `elevated` dark capsule /
  `panel` light sheet) + `useGlassQuality()` (small screen, ≤4 cores, ≤4GB,
  save-data → `lite` tier = thinner blur, fewer layers)
- `src/styles/globals.css` — tokens + `.liquid-glass`, `.liquid-glass-elevated`,
  `.liquid-glass-panel`, `.glass-lite` tiers
- `src/festival/live/LiveUpdates.tsx` — ticker + control + drawer, Supabase
  realtime (VITE_SUPABASE_URL/ANON_KEY) with `/api/updates` polling fallback
- `src/festival/pass/` — the volunteer portal. `VerifyPage.tsx` (gate verifier;
  state machine portal/checking/result/service/network), `QrScanner.tsx`
  (BarcodeDetector with jsQR fallback; unsupported/denied/error states with
  Retry, stops tracks on close), `LoginPage.tsx`, `ProfilePage.tsx`,
  `PortalShell.tsx` (dark ground + the signed-in profile chip),
  `AdminPage.tsx` (festival desk: add/disable/unlock/reset/promote, gate
  activity — admins land here on sign-in; volunteers land on the scanner),
  `session.tsx` + `session-context.ts` (provider, `RequireVolunteer` guard).
  **Scan Next Guest appears on every completed outcome
  (`state.result !== 'valid'`)**. Auth is a session cookie, never an access
  code — see `docs/VOLUNTEER_AUTH.md`
- `src/festival/getpasses/GetPassesPage.tsx` — registration (MAX_PASSES: a
  uniform 10 for every visitor type, mirrored in `api/_shared.ts`); duplicate
  message links to Retrieve + Front Desk
- `src/festival/pass/PassPage.tsx` — pass display + Retrieve (email AND phone)
- `api/_shared.ts`, `api/_auth.ts` (Argon2id, sessions, cookies, rate limiting,
  `requireVolunteer`/`requireAdmin`, audit writes),
  `api/register|verify|pass|retrieve|updates|wallet-*.ts`,
  `api/auth.ts` (login/logout/session/password) and `api/admin.ts`
  (volunteers/activity) — one function each, dispatched on `?action=` /
  `?resource=`, with `vercel.json` rewriting the pretty paths onto them.
  **Vercel Hobby allows 12 serverless functions per deployment**; a file per
  action made 13 and the build failed. Count before adding a route:
  `find api -name '*.ts' | grep -v '/_' | wc -l` (currently 9)
- `scripts/hash-password.mjs` — Argon2id hash + SQL for the FIRST admin account
- `supabase/schema.sql`, `docs/PASS_SYSTEM.md`, `docs/VOLUNTEER_AUTH.md`
- `.design/brief.md` — design-system record (required by the design gate)

## Page architecture — the five districts

The navigation is ROUTES, not scroll anchors (changed 2 Aug 2026). Order is
fixed: Our Mission · Stalls · Partners · Gallery · Enquiry. Get passes stays a
separate CTA, the seagull is a `<Link to="/">`.

- `src/festival/pages/chapters.ts` — the single source of truth: path, label,
  `data-chapter` key and the CANVAS colour for each district. The nav, the
  router and `CanvasBackground` all read it, so adding a page is one record
  plus one component.
- `src/festival/pages/PageShell.tsx` — nav + cinematic hero + footer, plus
  `Band` for alternating full-bleed sections.
- **Colour identity is TOKENS ONLY.** `data-chapter="mission"` on the page
  wrapper swaps `--primary`/`--accent`/`--background`/… via a block in
  `globals.css`. Components are untouched and nothing hard-codes a colour.
  `--foreground`, type and spacing are deliberately never overridden, so the
  pages read as districts of one place.
- `CanvasBackground` in `App.tsx` must know a route's colour BEFORE the page
  mounts — that is what stops a white flash on navigation and during
  rubber-band overscroll. Hence the canvas value living in `chapters.ts`.
- **Only Our Mission has full content.** The other four render
  `ComingSoonPage`; replace them one at a time.
- Rangeelo Rajasthan photographs are not in the repo. `RANGEELO` in
  `MissionPage.tsx` renders an elegant frame per plate; add `src` to a record
  and it becomes a photograph, no other change.

Two traps found while building it, both worth remembering:
- `AnimatedGroup` wraps EVERY child in its own motion div, so grid
  `col-span-*` classes on the child land inside the cell and are ignored. Use
  a plain grid with per-item `whileInView` when the items have unequal spans.
- `ArchFrame` is `rounded-t-[999px] overflow-hidden`, so it needs an explicit
  aspect (`aspect-[3/4]`) and generous top padding, or it clips its content.
- `TextEffect` renders an `sr-only` copy plus `aria-hidden` animated words, so
  `textContent` reads DOUBLED. Assert the accessible name, not textContent.

## Hero section: the two setups (SETUP A / SETUP B)

Two behaviours exist for the hero film. **SETUP A is what ships, everywhere,
on every device and browser** (since 01 Aug 2026). Setup B is implemented and
kept working, but nothing opts into it today.

**SETUP A — direct scrub. CURRENTLY LIVE EVERYWHERE.** The film is a plain
scroll-scrub from the first frame: no autoplay, no opening, scroll position is
the playhead and nothing else ever touches it. Runway top is frame 0, runway
end is the last frame, both directions, desktop and mobile alike.

**SETUP B — autoplay opening, then scrub. IMPLEMENTED, NOT ENABLED.** The film
plays and loops from load; the reader's first scroll takes control immediately
from the frame then on screen, and the gap between that frame and the one the
timeline wants is closed out of their own scrolling — proportionally on the
way down so the film always advances and lands on the last frame, and outright
on the way up where backwards motion is what they asked for. It is gated on
`(pointer: coarse)` inside `ScrollHero.tsx`, so were it re-enabled it would
run on phones and tablets only.

### Changing your mind later

The switch is the `autoplayUntilScroll` prop on `<ScrollHero>`:

- **Setup B on phones and tablets** (what shipped 01 Aug 2026, before Setup A
  went everywhere): add `autoplayUntilScroll` back to `<ScrollHero>` in
  `src/festival/Hero.tsx`.
- **Setup B on WebKit only** (what shipped before that): add the prop back,
  and in `ScrollHero.tsx` replace `touch` in the `mode` initialiser with
  `detectEngine() === 'webkit'`.
- **Setup B on every device including desktop:** add the prop back and drop
  `touch &&` from the `mode` initialiser.
- **Setup B on the ground film too:** add the prop to the `<ScrollHero>` in
  `GroundFilm.tsx`.

Tuning knobs for Setup B, both in `ScrollHero.tsx` and commented at the site:
`MAX_CLOSE_SHARE` (how much of a forward scroll may be spent closing the
handover gap; the film keeps the rest) and `BLEND` (how fast the gap drops
while scrolling up or standing still).

Known limitation of Setup B, and part of why Setup A now ships everywhere: a
handover very late in the loop leaves little film between there and the end,
so the descent shows that short tail stretched over the runway and the hero
moves slowly. Nothing jumps or freezes. The alternative is to treat the offset
as circular and let the film wrap forward through the loop point, trading this
for a visible wrap partway down — a product call, not a technical one.

Setup B was originally introduced as the iOS/iPadOS decoder workaround, since
a video that has never played may hold no decoded frame. Setup A covers that
ground by other means: the `preload` escalation, the muted play()→pause()
prime, the nudge off zero, and `onFirstGesture` (gotcha 7 below). An iPad Air
3 running the Setup A path was measured at readyState 4 with the whole film
buffered, which is what made dropping the opening safe.

Engine profiles (`src/utils/engine.ts`) are a SEPARATE axis and apply to both
setups: they govern how a seek is issued (coalescing thresholds, `fastSeek`
on WebKit), never how the film behaves. The playhead lerp is identical on
every engine on purpose, so Safari on a Mac feels like Chrome on a Mac.

## KNOWN-GOOD SCRUB BUILD — `scrub-known-good` (call this by name)

Both films — the hero and the ground film — were confirmed by the site owner
on real hardware on **2 Aug 2026** to load and scrub correctly on Safari
(macOS, iPhone, iPadOS), Chrome, Edge and Firefox. That state is pinned on the
remote as the ref **`scrub-known-good`** (commit `1680fd8`), and the same two
files are identical at `f2859f2`.

The scrub behaviour lives in exactly two files. To put them back, from
anywhere, without disturbing any other work in the tree:

```bash
git fetch origin scrub-known-good
git checkout origin/scrub-known-good -- src/components/ScrollHero.tsx src/utils/engine.ts
```

Verify the restore actually landed — these blob hashes ARE the known-good
behaviour, so a match is proof and a mismatch means something else moved:

```bash
git hash-object src/components/ScrollHero.tsx   # b3ac2dd26b58c154ce2f621d55763f6146bbdfc0
git hash-object src/utils/engine.ts             # df2f2b16b0c8cf5fc10ab1d60cdf9a27571d460a
```

Do not move the `scrub-known-good` ref to a newer commit unless the films have
been re-verified on a real Apple device — its whole value is that someone
checked it on hardware this container cannot reach. (A git *tag* would be the
natural fit, but the cloud session's git proxy refuses tag pushes, so it is a
ref instead. It is a bookmark, not a development branch: never commit to it.)

Anything that touches these two files should be treated as high-risk and
device-tested before it reaches `main`. See gotcha 8 for the one change that
looked well-evidenced, passed every gate, and still broke Safari everywhere.

## ScrollHero contract (performance-critical)

- Props: `src`, `webmSrc?`, `mobileSrc?`, `heightVh` (hero 340, ground 380 —
  ground stays SLOWER), `smoothing` (0.22), render-prop child receives smoothed
  progress MotionValue.
- No scroll listeners: an IntersectionObserver (±50% rootMargin) arms a single
  rAF loop; off-screen films cost nothing; the two videos never scrub at once.
- One layout read per frame; seeks coalesced (skip <0.02s deltas; never stack
  a seek on a busy decoder unless drift >0.3s).
- `preload="metadata"` until the section nears, then upgraded to `auto`.
- Phones (≤767px) get `hero-mobile.mp4` / `ground-mobile.mp4` (480p);
  **keep the WebM source unconditionally** — it is the fallback for browsers
  without H.264 (including the sandbox's codec-free Chromium).
- prefers-reduced-motion: holds first frame, no scrubbing.
- Video encoding for scrubbing: H.264 `-g 4 -keyint_min 4 -sc_threshold 0
  -pix_fmt yuv420p -movflags +faststart` (+ VP9 webm fallback). ffmpeg is not
  installed; use `@ffmpeg-installer/ffmpeg` npm package in the scratchpad.

## Hard-won gotchas (do not relearn these)

1. **Vercel functions**: Node runtime only (Edge couldn't read env vars),
   classic `(VercelRequest, VercelResponse)` signature (web `Request` broke),
   and NodeNext ESM requires `.js` extensions on relative imports (TS2835).
2. **Unlayered CSS beats Tailwind utilities**: `.liquid-glass*` classes must
   NOT declare `position` — it overrides Tailwind's layered `fixed` (bit us
   twice: live control anchored bottom-left; panel rendered in-flow at page
   bottom). Callers control positioning.
3. **Sandbox Chromium (`/opt/pw-browsers/chromium`) has no H.264** — videos
   verify via the webm fallback; an mp4-only source shows NETWORK_NO_SOURCE.
   Fake camera: launch args `--use-fake-ui-for-media-stream
   --use-fake-device-for-media-stream` + context `permissions: ['camera']`.
4. Image/video CDNs (Unsplash etc.) are unreachable from the container —
   material-based art direction (marble/grain SVG) instead; assets go in `public/`.
5. `published_at` NULL → 1970 dates: schema trigger + client falls back to
   `created_at` + nullsLast ordering.
6. **FIXED (2 Aug 2026).** Voci's staggered 12-col grid used to overflow the
   DOCUMENT between 1024 and ~1098px: eleven 96px gutters is 1056px of gap
   alone, more than the page had, so the tracks collapsed and the offset quote
   was clipped off the right edge. `lg:gap-24` is now `lg:gap-x-12 lg:gap-y-24`
   — rows keep the spacing, columns get room to exist. Do not put a single
   `gap` back on a twelve-column grid. The footer email is handled the same
   way: `break-all` below `sm`, one line above it, and the four-column footer
   row only from `xl` where a quarter of the row can hold the address.
   Root-level horizontal overflow is worth hunting on sight — WebKit degrades
   scrolling far more than Blink when the document scrolls sideways.
7. **Safari 27 (iPadOS) can refuse to LOAD media until the page has seen a
   real gesture.** Signature: `networkState` 0 EMPTY, `currentSrc` empty, and
   **no MediaError** — it never tried, so nothing failed — plus `play()`
   rejected `NotAllowedError` on a muted inline video. Same network, same
   files (all 206 with ranges), same codec support as a device that works; a
   standalone page with none of the site's code reproduces it. That is how
   Safari behaves with a site set to "Never Auto-Play", and it suppresses
   preloading along with playback. A scroll does not count as the gesture; a
   tap does. `onFirstGesture` in `ScrollHero.tsx` waits for the first tap and
   releases every film on the page at once. Diagnose with `/diag.html`
   (`public/diag.html`, delete when no longer needed).
8. **DO NOT "optimise" the scrub seek guard against `fastSeek` keyframe
   snapping. It was tried on 2 Aug 2026 and it broke Safari badly on Mac,
   iPhone and iPad; reverted in full the same day.** The reasoning looked
   sound and the measurements were real: `fastSeek` may land only on a
   keyframe (4/24 = 0.167s apart in these files), so it can settle up to
   0.083s from the request — twice WebKit's `minSeek` — which means the
   `drift > minSeek` test never goes quiet and the loop re-seeks every
   animation frame to the keyframe it is already parked on. Emulating WebKit
   inside Chromium (override `navigator.vendor`, stub `fastSeek` to snap to
   the keyframe grid) reproduced it: 120 seeks during 2s of standing still,
   176 seeks to show 39 frames on a slow scroll, against 0 and 49 for the
   "fixed" guard. **All of that was measured against a stub, and real WebKit
   does not behave like the stub.** On real Safari the change made both films
   far worse on every Apple device. The repeated seeking is evidently doing
   necessary work — a fastSeek that does not land, a `currentTime` that has
   not settled — that a request-based guard skips. Treat the seek rate on
   WebKit as load-bearing, not as waste. Anything in this area needs a real
   Safari device before it goes anywhere near `main`; the container cannot
   install WebKit (Playwright's download is blocked by the egress policy), so
   a Chromium measurement is not evidence about Safari.
9. Committer identity must be `Claude <noreply@anthropic.com>`; commits are
   SSH-signed (`commit.gpgsign=true` already configured in the cloud clone).
   Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Secrets / security rules

- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. Server-side only.
- `VERIFIER_ACCESS_CODE` is **GONE** (2 Aug 2026). The shared event-day code was
  replaced by per-person volunteer accounts: `api/_auth.ts`, the `volunteers` /
  `volunteer_sessions` tables, and `/verify-pass/login`. Delete the variable from
  Vercel if it is still set — nothing reads it. See `docs/VOLUNTEER_AUTH.md`.
- Volunteer sessions are server-side rows keyed by an `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie (`fb_volunteer`); only the SHA-256 of the token is
  stored. Never put auth state in `localStorage`/`sessionStorage`.
  **Do NOT re-add the `__Host-` prefix**: a prefixed cookie failing any of its
  conditions is rejected silently, and the symptom is "correct password
  refused" — hours were lost to that. `SameSite=Lax`, not Strict: Strict also
  withholds the cookie from top-level cross-site navigations, so opening the
  portal from a shared link reads as signed out.
- **`npm run e2e:auth` is the test that matters here.** It runs the REAL
  handlers behind a PostgREST stub, serves the REAL built frontend, and drives
  a REAL browser, so the Set-Cookie round trip is actually exercised. Every
  earlier suite stubbed `/api/auth/*` at the network layer and therefore could
  not see a cookie bug at all.
- Passwords are Argon2id (`@node-rs/argon2`, 19 MiB / t=2 / p=1). Never log a
  password, a hash, a session token, or PII. Login failures always answer with
  the one sentence "Invalid email or password."
- All verification decisions are server-side in `/api/verify`, which requires a
  volunteer session. Role checks live in `requireVolunteer`/`requireAdmin` —
  hiding a button is not a permission.
- Do not weaken RLS: every one of these tables is server-only.

## Quality gates (all must pass before pushing)

```bash
npm run build && npm run typecheck && npm run lint
npm run slop:check    # impeccable detector (also pre-push hook + CI)
npm run design:check  # design-process gate (brief.md, no examples/, motion imports)
```
Browser-verify changes with Playwright against `npx vite preview` at 320px,
375px (iPhone emulation), 812×375 landscape, and 1440px desktop; check
`document.documentElement.scrollWidth - clientWidth === 0` (no overflow).
Full glass tier on the 4-core container needs CDP
`Emulation.setHardwareConcurrencyOverride`.

## Content facts (verified copy — keep consistent)

- Statistics (Missione): **2nd** student-led carnival (ordinal roll 1st→2nd) ·
  **₹10 lakh** raised at Rangeelo Rajasthan · **3,160 children** · **240 organisers**
- Testimonials (Voci): Sumukh Nayak, Ryan Saha, Pranav Chauhan (Class XII A)
- Footer: phone +91 96866 69805 · email bfcommunication@brigadeschools.edu.in
- Hero: "Namma Mia / Carpisa"; eyebrow "The Brigade School @ Malleswaram ·
  14 November 2026"; ground film caption "Il campo diventa la piazza."

## State as of 16 Jul 2026

All four "Next-Phase Platform Enhancements" sections are **merged and deployed**
(PR #11, merged 15 Jul): ground-film tint progression shared with the hero,
LiquidGlass Live Updates with mobile lite tier, comprehensive mobile/perf pass
(adaptive 480p sources, IO-gated scrubbing, safe areas, overflow fixes, scanner
permission/unsupported/retry states), and Scan Next Guest on all completed
verification outcomes. `main` is green on all gates. No known open issues.
