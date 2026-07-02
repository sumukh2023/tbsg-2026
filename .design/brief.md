# Design brief — Festa Italiana (school carnival)

Source: `ui-ux-pro-max --design-system "school carnival festival community fundraiser event landing"`,
then taste-skill correction (the DB's default palette was AI-purple + an academic
serif — both overridden).

## Design read (taste-skill)
An event landing for a school + family community, joyful and high-energy. Register:
Vibrant & Block-based — bold color blocks, geometric, duotone, high contrast, large type.

## Style
Vibrant & Block-based (from ui-ux-pro-max). Full-bleed color-block sections
(alternating red / teal / sun / paper), big rounded display type, motion-forward.

## Palette (taste-corrected — NOT the DB's #7C3AED purple)
- primary (festa red):   #E1362C  (--primary)
- accent  (adriatic teal): #0E8C8C (--accent)
- sun (bold yellow pop): #F4B518  (--sun)
- background (bright paper): #FBFAF6 (--background)  [cool/bright, not warm-cream]
- foreground (ink):      #17140F  (--foreground)
Duotone red+teal with a sun-yellow pop is on-style for "Vibrant & Block-based"
(this style deliberately uses high-contrast duotone, overriding the single-accent default).

## Typography (from ui-ux-pro-max "Playful Creative")
- display/heading: Fredoka   body: Nunito
- Google Fonts: Fredoka:wght@400..700 + Nunito:wght@400..800

## Motion plan (src/components/motion/)
- Hero: TextEffect (per-word) headline, InfiniteSlider ribbon of Italian words.
- Attractions: AnimatedGroup (blur-slide) reveal of color blocks; BorderTrail on featured.
- Stats: AnimatedNumber count-ups on a teal block.
- Schedule: InView staggered reveals.
- Food: InfiniteSlider marquee.
- Tickets: Magnetic CTA buttons.
- Closing: Spotlight + TextEffect on a red block.
