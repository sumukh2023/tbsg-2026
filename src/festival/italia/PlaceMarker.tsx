import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PlacedPlace } from './places';

/**
 * One place on the map.
 *
 * Drawn in SVG rather than as HTML positioned over the map, because the
 * marker has to stay on its city while the country breathes, scales with the
 * viewport and is zoomed on a phone. In the same coordinate space it simply
 * cannot come loose; layered above it, it would need its own transform kept
 * in sync with the map's, which is a bug waiting for a resize.
 *
 * The plate is deliberately not a teardrop pin. A pin points at a spot
 * because a map is a tool; this is an exhibit, and the label is the invitation.
 */

/** The glyph inside the plate. Twelve units, centred on the origin. */
const GLYPHS: Record<string, string> = {
  // A pediment on columns: the classical cities.
  temple: 'M-6 4 h12 M-5 4 v-5 M-2 4 v-5 M2 4 v-5 M5 4 v-5 M-7 -5 L0 -9 L7 -5 Z',
  // A dome on a drum.
  dome: 'M-5 4 h10 M-4 4 v-4 a4 4 0 0 1 8 0 v4 M0 -6 v2',
  // Water.
  water: 'M-6 1 q3 -3 6 0 t6 0 M-6 4 q3 -3 6 0 t6 0',
  // Peaks.
  peak: 'M-7 4 L-2 -5 L1 0 L3 -3 L7 4 Z',
  // A leaning tower, for the one that leans.
  tower: 'M-3 4 h7 M-2 4 L-0.5 -6 M3 4 L2 -6 M-1.6 0 h3.2 M-1.2 -3 h3',
  // An arch: the arena.
  arch: 'M-6 4 v-6 a6 6 0 0 1 12 0 v6 M-2 4 v-3 a2 2 0 0 1 4 0 v3',
};

const GLYPH_FOR: Record<string, keyof typeof GLYPHS> = {
  roma: 'temple',
  venezia: 'water',
  firenze: 'dome',
  milano: 'dome',
  napoli: 'peak',
  pisa: 'tower',
  verona: 'arch',
  torino: 'dome',
  bologna: 'tower',
  siena: 'temple',
  palermo: 'temple',
  genova: 'water',
  'cinque-terre': 'water',
  'costiera-amalfitana': 'water',
  'lago-di-como': 'water',
  dolomiti: 'peak',
};

// Half-width of the plate. Down from 17: the markers were reading as buttons
// on a map rather than as marks on an exhibit, and sixteen of them at that
// size is most of Tuscany.
const PLATE = 14;
const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const;

export const PlaceMarker = memo(function PlaceMarker({
  place,
  index,
  open,
  onOpen,
}: {
  place: PlacedPlace;
  index: number;
  open: boolean;
  onOpen: (slug: string) => void;
}) {
  const still = useReducedMotion();
  /**
   * HOVER LIVES HERE, not in the section.
   *
   * It used to be one `hovered` slug in the parent, which meant moving the
   * cursor across the map re-rendered ALL SIXTEEN markers on every enter and
   * every leave: thirty-two renders to light one plate. Owning it locally
   * means a hover re-renders exactly the marker under the cursor, and the
   * other fifteen never hear about it.
   */
  const [hovered, setHovered] = useState(false);
  const active = hovered || open;
  const dir = place.side === 'left' ? -1 : 1;
  // More air between the plate and its name than before (14 -> 20).
  const labelX = place.x + dir * (PLATE + 20);
  const anchor = place.side === 'left' ? 'end' : 'start';

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${place.name}, ${place.epithet}. Open`}
      aria-expanded={open}
      className="cursor-pointer focus:outline-none"
      /* POINTER events, not mouse. Framer's onHoverStart is a mouse-event
         wrapper, and it is the reason hover was unreliable outside Chrome;
         pointerenter/leave are what every current engine implements the same
         way, and they cover pen and touch as well. */
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onOpen(place.slug)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(place.slug);
        }
      }}
      /* Markers arrive one after another once the map is woken. The stagger
         is the whole reveal: all sixteen at once is a rash, one after another
         is a place filling up. */
      initial={{ opacity: 0, y: 14, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: still ? 0 : index * 0.1,
        ease: EASE_OUT_QUART,
      }}
      style={{ transformOrigin: `${place.x}px ${place.y}px`, transformBox: 'view-box' }}
    >
      {/* The connector, drawn from the label back to the plate while the
          marker is live. It draws itself in and rubs itself out. */}
      <motion.line
        x1={labelX - dir * 4}
        y1={place.y}
        x2={place.x + dir * PLATE}
        y2={place.y}
        stroke="#C9A227"
        strokeWidth="1.4"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: active ? 1 : 0, opacity: active ? 0.9 : 0 }}
        transition={{ duration: 0.42, ease: EASE_OUT_QUART }}
      />

      {/* The ripple. Only while live, and it never repeats fast enough to
          become a pulse — this is a hover cue, not a beacon. */}
      {active && !still && (
        <motion.circle
          cx={place.x}
          cy={place.y}
          r={PLATE}
          fill="none"
          stroke="#C9A227"
          strokeWidth="1.2"
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{
            transformOrigin: `${place.x}px ${place.y}px`,
            transformBox: 'view-box',
          }}
        />
      )}

      <motion.g
        animate={{ scale: active ? 1.15 : 1 }}
        transition={
          still
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 15, mass: 0.6 }
        }
        style={{
          transformOrigin: `${place.x}px ${place.y}px`,
          transformBox: 'view-box',
        }}
      >
        {/* The warm glow, PAINTED rather than filtered. It was a CSS
            drop-shadow, and WebKit rasterises those on the CPU: sixteen of
            them, re-run whenever the plate scales, is a hover that stutters
            on exactly the browser this map was worst on. A soft ring behind
            the plate reads the same and costs a fill. */}
        {active && (
          <rect
            x={place.x - PLATE - 4}
            y={place.y - PLATE - 4}
            width={(PLATE + 4) * 2}
            height={(PLATE + 4) * 2}
            rx={(PLATE + 4) * 0.62}
            fill="none"
            stroke="#C9A227"
            strokeWidth="3"
            strokeOpacity="0.28"
          />
        )}

        {/* Its own shadow, deepening when live. */}
        <ellipse
          cx={place.x}
          cy={place.y + PLATE * 0.92}
          rx={PLATE * 0.78}
          ry={PLATE * 0.3}
          fill="#241E16"
          opacity={active ? 0.28 : 0.16}
        />
        <rect
          x={place.x - PLATE}
          y={place.y - PLATE}
          width={PLATE * 2}
          height={PLATE * 2}
          rx={PLATE * 0.62}
          fill="#2A2622"
          stroke="#C9A227"
          strokeWidth={active ? 1.8 : 0}
        />
        <g
          transform={`translate(${place.x} ${place.y}) scale(1.05)`}
          fill="none"
          stroke={active ? '#F6E7B0' : '#E7DFD0'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={GLYPHS[GLYPH_FOR[place.slug] ?? 'temple']} />
        </g>
      </motion.g>

      {/* The name. Charcoal at rest, Venetian gold when live — the same
          transition the brief asks for, done on fill so it costs nothing. */}
      <motion.text
        x={labelX}
        y={place.y + 1}
        textAnchor={anchor}
        dominantBaseline="middle"
        className="pointer-events-none select-none font-display"
        style={{ fontSize: 27, fontWeight: 500 }}
        animate={{ fill: active ? '#B08D2F' : '#332C24' }}
        transition={{ duration: 0.3 }}
      >
        {place.name}
      </motion.text>

      {/* A generous, invisible target. The plate is elegant and small; a
          thumb is neither. */}
      <circle
        cx={place.x}
        cy={place.y}
        r={PLATE * 2.4}
        fill="transparent"
        className="cursor-pointer"
      />
    </motion.g>
  );
});
