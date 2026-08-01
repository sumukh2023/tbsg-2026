/**
 * Rendering-engine identification and the per-engine tuning the scroll-scrub
 * films need.
 *
 * Browser-specific behaviour lives HERE and nowhere else. Components ask for
 * a profile and read values off it; none of them branch on a browser name.
 * Adding or retuning an engine is a change to this file alone, and the
 * defaults are the shared path, so an unrecognised browser behaves exactly
 * as Chrome does rather than falling into a special case.
 */

export type Engine = 'webkit' | 'edge' | 'blink' | 'gecko';

/**
 * Engine behind the window, not the badge on it. Order matters: every
 * iOS/iPadOS browser is WebKit underneath (including Edge and Chrome there),
 * and `navigator.vendor` is the one signal the others never report, so it is
 * checked first.
 */
export function detectEngine(): Engine {
  if (typeof navigator === 'undefined') return 'blink';
  if (navigator.vendor === 'Apple Computer, Inc.') return 'webkit';
  const ua = navigator.userAgent;
  // Edg/ desktop and Android, EdgA/ legacy Android. (EdgiOS is WebKit and has
  // already been caught above.)
  if (/\bEdgA?\//.test(ua)) return 'edge';
  if (/\bFirefox\//.test(ua)) return 'gecko';
  return 'blink';
}

export type ScrubProfile = {
  /**
   * Playhead drift, in seconds, below which a seek is not worth issuing.
   * Raising it trades sub-frame precision for a lower seek rate.
   */
  minSeek: number;
  /**
   * Drift at which a new seek is issued even though the decoder is still
   * working on the previous one. Low values keep the picture tight to the
   * scroll; high values refuse to pile work onto a decoder that is behind.
   */
  stackedSeek: number;
  /**
   * Use `HTMLMediaElement.fastSeek()` where available: it seeks to the
   * nearest keyframe instead of decoding to an exact frame.
   */
  fastSeek: boolean;
};

/**
 * Blink is the reference profile; Gecko matches it. The two exceptions:
 *
 * - **Edge** runs the same Blink compositor but a different media pipeline
 *   (hardware decode plus its video-enhancement stage on supported GPUs),
 *   which makes an individual seek dearer than it is in Chrome. Coarser
 *   coalescing roughly halves the seeks issued per second of scrolling; at
 *   these deltas the frames skipped are ones the eye does not resolve during
 *   a scroll anyway.
 * - **WebKit** is given `fastSeek`, which is the API Safari provides for
 *   exactly this job. Both films are encoded with a keyframe every four
 *   frames (`-g 4`, see CONTEXT.md), so seeking to the nearest keyframe
 *   costs at most a couple of frames of accuracy while skipping the exact
 *   decode that makes Safari stall. Its stacked threshold is the highest of
 *   the four because piling a seek onto a busy WebKit decoder is what turns
 *   a scrub into a freeze.
 */
export const SCRUB_PROFILES: Record<Engine, ScrubProfile> = {
  blink: { minSeek: 0.02, stackedSeek: 0.3, fastSeek: false },
  gecko: { minSeek: 0.02, stackedSeek: 0.3, fastSeek: false },
  edge: { minSeek: 0.05, stackedSeek: 0.45, fastSeek: false },
  webkit: { minSeek: 0.04, stackedSeek: 0.6, fastSeek: true },
};

/** The scrub tuning for the engine currently running. */
export function scrubProfile(): ScrubProfile {
  return SCRUB_PROFILES[detectEngine()];
}
