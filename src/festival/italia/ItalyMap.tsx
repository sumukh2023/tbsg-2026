import { memo, useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ITALY_PATHS, VIEW_HEIGHT, VIEW_WIDTH } from './geometry';

/**
 * The silhouette itself: one SVG, all of its material done with filters and
 * gradients rather than images, so it stays sharp at any size and costs one
 * request of nothing.
 *
 * THE COLOURS. Green, white and red are the flag's, and they are here as
 * literal values rather than tokens on purpose — they are the subject, not
 * the theme. They are also pulled well back: full-strength flag colours on a
 * marble page would read as a sports banner. What is left is the tricolour as
 * a wash across the country, which you notice a second after you notice the
 * shape.
 *
 * Nothing here touches the global palette.
 */

/** Muted from the flag's own #008C45 / #F4F5F0 / #CD212A. */
const TRICOLOUR = {
  green: '#5C7F5A',
  ivory: '#F2ECDF',
  red: '#B0553F',
} as const;

export const ItalyMap = memo(function ItalyMap({
  awake,
  children,
  className,
}: {
  /** True once the exhibit has been woken — hover, focus or a tap. */
  awake: boolean;
  /** The marker layer, drawn in the same coordinate space. */
  children?: React.ReactNode;
  className?: string;
}) {
  // Filter and gradient ids must be unique per instance or a second map on
  // the page would silently steal the first one's fills.
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${name}-${uid}`;
  const still = useReducedMotion();

  return (
    <svg
      /* A sliver of room on the left for the labels. Measured, not guessed:
         with every marker showing, the text spans x = -14 to 755 in a 0..847
         box, so Turin — the westernmost city with a left-hand label — is the
         only one that reaches past the edge, and 28 units clears it. */
      viewBox={`-28 0 ${VIEW_WIDTH + 28} ${VIEW_HEIGHT}`}
      className={className}
      role="img"
      aria-label="A map of Italy. Sixteen places can be opened for more about each."
    >
      <defs>
        {/* The land: the tricolour laid across the country rather than in
            bands, so it reads as light on stone. */}
        <linearGradient id={id('land')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={TRICOLOUR.green} />
          <stop offset="46%" stopColor={TRICOLOUR.ivory} />
          <stop offset="100%" stopColor={TRICOLOUR.red} />
        </linearGradient>

        {/* Renaissance parchment. Fractal noise at a low frequency is the
            grain of laid paper; kept faint enough to be felt rather than
            seen. */}
        <filter id={id('parchment')} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            seed="7"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0.42 0 0 0 0 0.35 0 0 0 0 0.24 0 0 0 0.28 0"
            result="tint"
          />
          <feComposite in="tint" in2="SourceGraphic" operator="in" result="paper" />
          <feBlend in="SourceGraphic" in2="paper" mode="multiply" />
        </filter>

        {/* The emboss. A displaced, blurred copy of the shape lit from the
            top left — the same trick a printer's blind stamp uses, which is
            why it reads as pressed rather than as a bevel. */}
        <filter id={id('emboss')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="2.5"
            specularConstant="0.5"
            specularExponent="18"
            lightingColor="#fffaf0"
            result="spec"
          >
            <feDistantLight azimuth="315" elevation="58" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="lit" />
          <feComposite
            in="SourceGraphic"
            in2="lit"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="0.85"
            k4="0"
          />
        </filter>

        {/* Sitting on the page rather than printed on it. */}
        <filter id={id('lift')} x="-25%" y="-15%" width="150%" height="140%">
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="16"
            floodColor="#2a2118"
            floodOpacity="0.22"
          />
        </filter>

        {/* The shimmer: a narrow band of gold that crosses the country every
            now and then. It is a gradient whose stops move, masked to the
            land, so it costs no layout and no repaint of anything else. */}
        <linearGradient id={id('shimmer')} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="#C9A227" stopOpacity="0" />
          <stop offset="45%" stopColor="#E8CE7A" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#F6E7B0" stopOpacity="0.7" />
          <stop offset="55%" stopColor="#E8CE7A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
          {!still && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="-1.6 0; 1.6 0"
              dur="7s"
              begin="2s;shimmer.end+11s"
              id="shimmer"
              repeatCount="1"
              fill="freeze"
            />
          )}
        </linearGradient>

        <clipPath id={id('land-clip')}>
          {ITALY_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>

        {/* The lighting pool. Its centre drifts, which is what keeps the
            surface from looking like a flat fill. */}
        <radialGradient id={id('sheen')} cx="0.38" cy="0.28" r="0.75">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#6B5B3E" stopOpacity="0.14" />
        </radialGradient>
      </defs>

      {/* THE COUNTRY.
          The breathing is on a group rather than on the paths, so the markers
          inside ride with it and never drift off their cities. */}
      <motion.g
        filter={`url(#${id('lift')})`}
        animate={still ? undefined : { scale: [1, 1.012, 1] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      >
        <g filter={`url(#${id('emboss')})`}>
          {ITALY_PATHS.map((d, i) => (
            <path key={i} d={d} fill={`url(#${id('land')})`} />
          ))}
        </g>

        {/* Everything from here is clipped to the land, so no wash, shimmer
            or speck of dust ever appears in the sea. */}
        <g clipPath={`url(#${id('land-clip')})`}>
          <rect
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            fill={`url(#${id('land')})`}
            filter={`url(#${id('parchment')})`}
            opacity="0.5"
          />
          <motion.rect
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            fill={`url(#${id('sheen')})`}
            animate={still ? undefined : { x: [-18, 22, -18], y: [-10, 14, -10] }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
          />
          <rect
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            fill={`url(#${id('shimmer')})`}
            style={{ mixBlendMode: 'screen' }}
          />
          {!still && <Dust />}
        </g>

        {/* The outline. Always faintly there so the shape has an edge;
            gold once the exhibit is awake. */}
        {ITALY_PATHS.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke={awake ? '#C9A227' : '#8A7B5C'}
            strokeWidth={awake ? 2.2 : 1}
            strokeLinejoin="round"
            animate={{ opacity: awake ? 0.95 : 0.45 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={
              awake
                ? { filter: 'drop-shadow(0 0 6px rgba(201,162,39,0.45))' }
                : undefined
            }
          />
        ))}
      </motion.g>

      {children}
    </svg>
  );
});

/**
 * Floating dust. Twelve motes, each with its own drift and period, seeded
 * from the index so the pattern is stable between renders rather than
 * re-randomising on every paint.
 */
function Dust() {
  return (
    <g aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const x = ((i * 137) % 90) / 100;
        const y = ((i * 211) % 88) / 100;
        const r = 1.6 + ((i * 7) % 5) * 0.5;
        const dur = 18 + ((i * 5) % 11);
        return (
          <motion.circle
            key={i}
            cx={x * VIEW_WIDTH}
            cy={y * VIEW_HEIGHT}
            r={r}
            fill="#F6E7B0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.5, 0],
              y: [0, -26 - (i % 4) * 8, -52],
              x: [0, (i % 3) - 1, 0],
            }}
            transition={{
              duration: dur,
              repeat: Infinity,
              delay: (i * dur) / 12,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </g>
  );
}
