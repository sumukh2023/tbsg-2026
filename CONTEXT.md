# CONTEXT.md — Flash @ Brigade 2026 · Session Handoff

Handoff notes for continuing work on the Flash @ Brigade 2026 festival site.
Read this alongside the repo's `CLAUDE.md` before making changes.

## STANDING INSTRUCTION — repository and branch (updated 16 Jul 2026)

- The working repository is **permanently `sumukh2023/tbsg-2026`, branch `main`**.
- It was previously `sumukh2023/webfinity-2026` with branch `claude/carnival`;
  the repo was **renamed** to `tbsg-2026` and `claude/carnival` was renamed to
  `main`. GitHub redirects the old name, so cloud sessions scoped to
  `webfinity-2026` still reach it, but all references should use `tbsg-2026`.
- **Work and push directly on `main`. Do NOT create `claude/carnival` (or any
  other side branch) requiring a merge each time.** This supersedes the repo
  `CLAUDE.md` golden rule 8 ("work on a branch and open a PR") and any
  session-harness branch instructions.
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
- react-router-dom: `/` home · `/get-passes` · `/pass/:token?` · `/verify-pass/:token`
  (secondary routes lazy-loaded)
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
- `src/festival/pass/VerifyPage.tsx` — gate verifier: shared in-page `QrScanner`
  (BarcodeDetector, jsQR fallback), access-code gate (sessionStorage), state
  machine code/checking/result/service/network. **Scan Next Guest appears on
  every completed outcome (`state.result !== 'valid'`)**; scanner has
  unsupported/denied/error states with Retry, stops tracks on close
- `src/festival/getpasses/GetPassesPage.tsx` — registration (PASS_LIMITS:
  student 1, parent 2, guest 2, alumni 1, faculty 5, other 3); duplicate
  message links to Retrieve + Front Desk
- `src/festival/pass/PassPage.tsx` — pass display + Retrieve (email AND phone)
- `api/_shared.ts`, `api/register|verify|pass|retrieve|updates|wallet-*.ts`
- `supabase/schema.sql`, `docs/PASS_SYSTEM.md`
- `.design/brief.md` — design-system record (required by the design gate)

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
6. Voci's staggered 12-col grid overflows below ~1150px (96px gaps) — it is
   `lg:` only. Footer email needs `break-all`.
7. Committer identity must be `Claude <noreply@anthropic.com>`; commits are
   SSH-signed (`commit.gpgsign=true` already configured in the cloud clone).
   Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Secrets / security rules

- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` or `VERIFIER_ACCESS_CODE` to the
  browser; never log secrets/tokens/PII; do not weaken RLS.
- All verification decisions come from `/api/verify` (server-side); the client
  only renders results. HTTP semantics: 200 valid/checked_in · 401/403 bad code
  · 404 invalid · 409 already checked in · 410 cancelled · 503 service.

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
