# Design brief: Flash @ Brigade 2026, "Namma Mia Carpisa"

Premium microsite for The Brigade School @ Malleswaram's student-run fundraising
carnival, 14 November 2026. Theme: Italy. Audience: design-competition judges,
parents, students. Bar: Awwwards-grade cultural-festival experience.

## ui-ux-pro-max query (recorded verbatim result)

```
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "luxury italian mediterranean renaissance fashion marble terracotta olive premium cinematic apple stripe linear" \
  --design-system -p "Flash @ Brigade - Namma Mia Carpisa"
```

- **PATTERN:** Bento Grid Showcase (hero, bento of key experiences, detail cards, CTA)
- **STYLE:** Liquid Glass (used with restraint: glass reserved for the nav and one
  or two interactive surfaces, per the repo's anti-glassmorphism rule)
- **PALETTE (returned):** premium black `#1C1917` + gold accent `#A16207` on
  `#FAFAF9`, border `#D6D3D1`
- **TYPOGRAPHY (returned):** Cormorant / Montserrat ("luxury, high-end, fashion,
  elegant, refined, premium")
- **KEY EFFECTS:** fluid 400-600ms curves, dynamic blur, color transitions
- **AVOID:** cheap visuals, fast animations

Supplementary `--domain color` query returned the warm terracotta family
(primary `#9A3412`, warm backgrounds) for Mediterranean/Italian keywords.

## Direction (taste-skill read)

Reading this as: a cultural-festival event microsite for judges and a school
community, with a luxury Italian editorial and exhibition language (Milan Design
Week, Loro Piana, Apple keynote pacing), leaning toward serif-display typography,
warm marble surfaces and one deliberate evening chapter.

Dials: DESIGN_VARIANCE 8 / MOTION_INTENSITY 7 / VISUAL_DENSITY 3.

The brief explicitly names the palette (terracotta, marble white, olive, deep
green, gold, charcoal), which is the sanctioned override for a warm palette.

## Tokens as applied

| Token | Light "marble day" | Dark "evening piazza" (one deliberate chapter) |
| --- | --- | --- |
| background | hsl(38 38% 94%) marble | hsl(160 22% 8%) deep green-charcoal |
| foreground | hsl(32 21% 12%) warm ink | hsl(40 33% 93%) marble |
| primary | hsl(16 52% 43%) terracotta | hsl(42 52% 58%) aged gold |
| secondary | hsl(56 24% 88%) pale olive | hsl(158 14% 16%) |
| accent | hsl(41 60% 36%) aged gold | hsl(42 52% 58%) |
| radius | 0.25rem, crisp editorial; arches carry the curve language | same |

Fonts: `Cormorant Garamond` (display/heading, 400-700 + italic) and
`Montserrat` (body/sans, 400-600), loaded in `index.html`.

## Constraints honored

- Photography/video CDNs are unreachable from this build environment and no
  image-generation tool is available, so the art direction is type + material:
  SVG-turbulence marble, film grain, arched-portico geometry, gold hairlines.
  Slots where real photography/video can later be dropped are listed in the PR.
- No gradient text, no aurora blobs, zero em-dashes, eyebrows rationed,
  one marquee max, one theme flip (day to evening) executed once, deliberately.

## Mission chapter: DMC 743 (added 2 Aug 2026)

The landing page already spends its terracotta freely, so Our Mission takes a
yellow identity of its own: **DMC 743, Medium Yellow, `#FED376`**.

Measured, not assumed. As type on the chapter background (`hsl(34 44% 95%)`)
DMC 743 gives **1.29:1**, far under the 4.5:1 floor. Dark ink ON a DMC 743
fill gives **11.49:1**. The same hue darkened to `hsl(40 80% 30%)` gives
**5.01:1** on the page ground and **5.22:1** on cards.

So the chapter runs the colour at two tiers:

| Token | Value | Used for |
| --- | --- | --- |
| `--highlight` | `hsl(40 98% 73%)` (DMC 743) | fills only: section-number tiles, primary button, card hover wash, decorative rules |
| `--highlight-foreground` | `hsl(32 30% 13%)` | the ink that sits on those fills |
| `--primary` / `--accent` | `hsl(40 80% 30%)` | every piece of TYPE in the accent colour |

`highlight` is a real Tailwind colour (`tailwind.config.ts`) and is defined in
`:root` and `.dark` as well, so a component that uses it does not break outside
the chapter. Nothing sets type in `text-highlight`.
