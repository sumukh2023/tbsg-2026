<div align="center">

# Flash @ Brigade 2026
### “Namma Mia Carpisa”

**The Brigade School @ Malleswaram's student-run charity carnival.**
For one day, the campus becomes an Italian piazza.

Saturday, 14 November 2026 · 09:30 – 20:00 · Malleswaram, Bengaluru

[brigadeschools.edu.in](https://www.brigadeschools.edu.in) · [Instagram](https://www.instagram.com/thebrigade.schools) · [Facebook](https://www.facebook.com/TheBrigade.Schools/)

</div>

---

## What this is

This repo is the live website for **Flash**, an annual, entirely student-run
carnival — imagined, budgeted and run by the students of The Brigade School
@ Malleswaram, with teachers advising and students deciding. Every rupee of
surplus goes to the school's Passion with Compassion programme, funding education and
healthcare for underprivileged children.

Flash at TBSG began in November 2023 as *Rangeelo Rajasthan*. This is the **2nd edition**: the theme turns to Italy, the
courtyards become piazzas, and student organisers are running regional zones, a food street, a runway show and a closing set under
the lights — all in service of the underprivileged children the fund has supported so far.

The site is a single continuous story — landing page, ticketing and
event-day tooling sharing one design language — built on the
[`web-studio`](https://github.com/sumukh2023/web-studio) starter toolkit and
finished from scratch for this brief.

## The event

| | |
| --- | --- |
| **Date** | Saturday, 14 November 2026, 09:30 – 20:00 |
| **Venue** | The Brigade School @ Malleswaram, Brigade Gateway Enclave, #26/1 Railway Parallel Road, Malleswaram West, Bangalore 560055 |
| **Entry** | ₹200 per person · under-5s free · stalls/games/mercato priced individually |
| **Cause** | 100% of surplus funds children's education & healthcare (Passion with Compassion programme) |

**On the site:**

- **La Piazza** — six zones built and staffed by student guilds: La Passerella
  (runway), L'Orchestra (live music), Le Botteghe (artisan stalls), La Cucina
  (food street), Il Palco (main stage), I Giochi (carnival games)
- **Sei Regioni** — six regions of Italy claim a corner of campus: Venezia,
  Firenze, Roma, Milano, Amalfi, Sicilia
- **Il Programma** — the day's six headline performances, from the opening
  Parata delle Regioni to the closing Notte Italiana
- **Il Mercato** — the food street menu, trattoria classics priced for
  pocket money
- **Il Giorno** — the full minute-by-minute schedule, gates to *Arrivederci*
- **Get Passes** — the ticketing flow: registration, a digital pass, live event-day updates and back-end gate verification for volunteers on Event Day

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | React 18 + Vite 5 + TypeScript (strict), React Router |
| Styling | Tailwind CSS v3 + CSS-variable design tokens (marble/terracotta by day, deep evening green by dusk) |
| Animation | Framer Motion · GSAP · Lenis (smooth scroll) |
| UI | shadcn/ui (Radix) + the vendored Motion Primitives library |
| Backend | Vercel Functions (Node runtime, `api/`) + Supabase (Postgres, RLS, Realtime) |
| Ticketing | Digital passes with QR check-in, Apple/Google Wallet passes — see [`docs/PASS_SYSTEM.md`](docs/PASS_SYSTEM.md) |
| Deployment | Vercel |

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview  # preview the production build
```

The pass/ticketing system (`api/`) needs Supabase credentials — copy
`.env.example` to `.env` and see [`docs/PASS_SYSTEM.md`](docs/PASS_SYSTEM.md)
for the full architecture and required environment variables. The rest of
the site (everything under `/`) runs fully static without them.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` then `vite build` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run slop:check` | Anti-slop design detector (impeccable) |

## Project structure

```
src/
  festival/          # the site itself — Hero, Overture, PiazzaBento, Regions,
                      # Programme, Mercato, Voci, Giorno, Domande, Missione,
                      # Finale, SiteNav, SiteFooter, GroundFilm
  festival/getpasses/ # ticketing flow (registration → digital pass)
  festival/pass/      # pass display + gate verification pages
  festival/live/      # event-day live updates
  components/         # shared primitives (Navbar, Hero, Footer, GlassCard, …)
  components/motion/  # vendored Motion Primitives (TextEffect, BorderTrail, …)
  components/animations/  # FadeIn, SlideUp, StaggerChildren, Reveal (GSAP)
  layouts/            # RootLayout (smooth scroll + chrome)
  styles/             # globals.css — design tokens (light "marble day" / dark "evening piazza")
api/                  # Vercel Functions: register, retrieve, verify, wallet passes
supabase/schema.sql   # database schema for registrations & passes
docs/PASS_SYSTEM.md   # full ticketing architecture
.design/brief.md      # recorded design direction (style, palette, typography)
```

## Contact

- Landline: [+91 80411 48397](tel:+918041148397)
- Mobile: [+91 96866 69805](tel:+919686669805)
- Email: [bfcommunication@brigadeschools.edu.in](mailto:bfcommunication@brigadeschools.edu.in)
- [Facebook](https://www.facebook.com/TheBrigade.Schools/) ·
  [Instagram](https://www.instagram.com/thebrigade.schools) ·
  [YouTube](https://www.youtube.com/channel/UCrjGGrOH85T6ZTuKiAhb0VQ) ·
  [LinkedIn](https://www.linkedin.com/school/the-brigade-schools-bangalore/)

---

<div align="center">
<sub>© 2026 The Brigade School @ Malleswaram. Ci vediamo in piazza.</sub>
</div>
