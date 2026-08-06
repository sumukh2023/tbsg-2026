import { memo, useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ITALY_PATHS, VIEW_HEIGHT, VIEW_WIDTH } from './geometry';

/**
 * The silhouette.
 *
 * NO SVG FILTERS, NO CLIP PATH, NO BLEND MODE, AND NOTHING ANIMATING THE
 * COUNTRY. That is the whole design of this file and it is a rewrite, not a
 * tuning pass.
 *
 * The first version had an feTurbulence parchment, an emboss and a drop
 * shadow, a clipPath of four complex paths, a `mix-blend-mode: screen`
 * shimmer driven by SMIL, and a thirteen-second breathing transform over all
 * of it. Chromium GPU-accelerates most of that and only stuttered; WebKit
 * rasterises SVG filters ON THE CPU and re-runs them whenever the filtered
 * subtree moves, which is why the same section was minor lag in Chrome and
 * severe lag in Safari. A filter over a viewport-height SVG re-evaluated
 * every frame is not something a low-end phone can be optimised into
 * affording, so none of it survives.
 *
 * Everything that looked like a filter is now GEOMETRY, drawn from the same
 * four paths the country is made of:
 *
 *   the emboss    the same paths again, offset up-left in a pale ink
 *   the sheen     the same paths again, filled with a radial gradient
 *   the grain     the same paths again, filled with a small tiled pattern
 *
 * There is deliberately NO shadow under the land. The first pass had a soft
 * dark ellipse behind it, and on the section's warm ground it read as a
 * bruise rather than as lift — the emboss already does the separating, and it
 * does it in the direction the light is coming from.
 *
 * Reusing the paths as their own mask is what removes the clipPath: a fill
 * cannot escape the shape it is painted into. The cost is four extra draws
 * of a simplified outline, once, with nothing to recompute afterwards.
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
  /** True once the exhibit has been woken: pointer, focus or entering view. */
  awake: boolean;
  /** The marker layer, drawn in the same coordinate space. */
  children?: React.ReactNode;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${name}-${uid}`;
  const still = useReducedMotion();

  return (
    <svg
      /* A sliver of room on the left for the labels. Measured, not guessed:
         with every marker showing, the text spans x = -14 to 755 in a 0..847
         box, so Turin is the only one that reaches past the edge. */
      viewBox={`-28 0 ${VIEW_WIDTH + 28} ${VIEW_HEIGHT}`}
      className={className}
      role="img"
      aria-label="A map of Italy. Sixteen places can be opened for more about each."
    >
      <defs>
        <linearGradient id={id('land')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={TRICOLOUR.green} />
          <stop offset="46%" stopColor={TRICOLOUR.ivory} />
          <stop offset="100%" stopColor={TRICOLOUR.red} />
        </linearGradient>

        {/* The lighting pool, as a paint rather than as a lighting filter. */}
        <radialGradient id={id('sheen')} cx="0.36" cy="0.24" r="0.8">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="52%" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#6B5B3E" stopOpacity="0.16" />
        </radialGradient>

        {/* Parchment. A 6-unit tile of three specks, repeated by the renderer
            rather than generated per pixel by feTurbulence. */}
        <pattern
          id={id('grain')}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="2" r="0.7" fill="#6B5B3E" opacity="0.16" />
          <circle cx="5" cy="4.5" r="0.55" fill="#8A7350" opacity="0.13" />
          <circle cx="3" cy="6" r="0.45" fill="#4E4230" opacity="0.1" />
        </pattern>
      </defs>

      {/* The emboss: the country again, up and to the left, in pale ink.
          What shows is the sliver that the land on top does not cover, which
          is exactly the highlight a blind stamp leaves. */}
      <g transform="translate(-1.6 -2.2)" opacity="0.75">
        {ITALY_PATHS.map((d, i) => (
          <path key={i} d={d} fill="#FFFBF2" />
        ))}
      </g>

      {/* The land. */}
      {ITALY_PATHS.map((d, i) => (
        <path key={i} d={d} fill={`url(#${id('land')})`} />
      ))}

      {/* Sheen and grain, painted INTO the same shape, which is why no clip
          path is needed to keep them out of the sea. */}
      {ITALY_PATHS.map((d, i) => (
        <path key={`s${i}`} d={d} fill={`url(#${id('sheen')})`} />
      ))}
      {ITALY_PATHS.map((d, i) => (
        <path key={`g${i}`} d={d} fill={`url(#${id('grain')})`} opacity="0.5" />
      ))}

      {/* The outline. Gold once the exhibit is awake. A CSS transition on two
          presentation attributes, so waking costs one style recalculation
          rather than a React pass over anything. */}
      {ITALY_PATHS.map((d, i) => (
        <path
          key={`o${i}`}
          d={d}
          fill="none"
          stroke={awake ? '#C9A227' : '#8A7B5C'}
          strokeWidth={awake ? 2 : 1}
          strokeOpacity={awake ? 0.95 : 0.45}
          strokeLinejoin="round"
          style={{
            transition: still
              ? undefined
              : 'stroke 0.6s ease-out, stroke-width 0.6s ease-out, stroke-opacity 0.6s ease-out',
          }}
        />
      ))}

      {/* Dust. Six CSS keyframe animations on transform and opacity, which is
          the only thing left on this map that moves at all. */}
      {!still && awake && <Dust />}

      {children}
    </svg>
  );
});

function Dust() {
  return (
    <g aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => {
        const x = ((i * 137) % 90) / 100;
        const y = ((i * 211) % 88) / 100;
        const r = 1.6 + ((i * 7) % 5) * 0.5;
        const dur = 18 + ((i * 5) % 11);
        return (
          <circle
            key={i}
            cx={x * VIEW_WIDTH}
            cy={y * VIEW_HEIGHT}
            r={r}
            fill="#F6E7B0"
            opacity={0}
            style={{
              animation: `italia-dust ${dur}s ease-in-out ${(i * dur) / 6}s infinite`,
            }}
          />
        );
      })}
    </g>
  );
}
