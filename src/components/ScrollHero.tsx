import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motionValue, type MotionValue } from 'framer-motion';
import { cn } from '@/utils/cn';
import { detectEngine, scrubProfile } from '@/utils/engine';

export interface ScrollHeroProps {
  /** Video served from public/, e.g. "/hero.mp4". */
  src: string;
  /** Optional WebM fallback for browsers without H.264. */
  webmSrc?: string;
  /** Optional lower-resolution H.264 source served to phones. */
  mobileSrc?: string;
  /** Total scroll runway; the sticky viewport stays pinned through it. */
  heightVh?: number;
  /**
   * Overrides the engine profile's playhead lerp (0..1, higher = snappier).
   * Left unset, each engine gets the factor tuned for it.
   */
  smoothing?: number;
  /**
   * WebKit only: play and loop the film until the reader's first scroll, then
   * hand over to the scrubber from whatever frame is on screen. Blink and
   * Gecko ignore this and scrub from the first frame as they always have.
   */
  autoplayUntilScroll?: boolean;
  className?: string;
  /**
   * Sticky-viewport content layered over the video. Receives the smoothed
   * scrub progress (0..1) as a MotionValue for scroll-linked choreography.
   */
  children?: (progress: MotionValue<number>) => ReactNode;
}

/**
 * How much of the film the WebKit opening loops over, in seconds.
 *
 * This is the number that makes the handover invisible, and it is a
 * structural choice rather than a tuning knob. A film looping over its whole
 * length is, on average, half its duration away from frame 0 when the reader
 * first scrolls — and the timeline at the top of the runway wants frame 0, so
 * that whole distance had to be travelled somewhere and could be seen. An
 * opening bounded to its first couple of seconds is never more than that far
 * from where the timeline wants it, and a normal scroll gesture advances the
 * timeline faster than the remaining gap closes, so the film only ever
 * advances on screen.
 */
const OPENING_SECONDS = 1.8;

/**
 * Share of the reader's own forward scrolling spent on closing the handover
 * gap while they are descending. At 0.3 the film still advances at 70% of
 * the scroll rate — slightly slower than the timeline for a moment, never
 * backwards, which is the whole point.
 */
const CLOSE_SHARE = 0.3;

/**
 * Per-frame decay used only when the reader is still or scrolling UP. The
 * film is already travelling backwards in that direction, so closing the gap
 * there costs nothing visually and can be quick.
 */
const BLEND = 0.86;

/**
 * Apple-product-page scroll scrubber: a tall runway with a sticky,
 * viewport-filling video whose playhead is driven by scroll position.
 *
 * Performance contract (there can be several of these on one page):
 * - No scroll listeners at all: an IntersectionObserver arms a single rAF
 *   loop only while the runway is near the viewport, so an off-screen film
 *   costs nothing and two films never decode simultaneously.
 * - Position is read once per frame inside the loop (batched read), then
 *   written to the playhead — never inside a raw scroll handler.
 * - Seeks are coalesced: a new seek is never queued while the decoder is
 *   still busy with the previous one, unless the playhead has drifted far.
 * - The video preloads metadata only until its section approaches.
 * - Phones receive `mobileSrc` (lower resolution) when provided.
 *
 * Readiness contract (why this never waits on a single event):
 * - Duration, readyState and networkState are re-read from the element every
 *   frame. Nothing depends on a particular event having fired at a
 *   particular moment, so a `loadedmetadata` that arrived before the effect
 *   attached, a `loadeddata` iOS never sends, and a `suspend` that fires
 *   twice are all non-events. Media events are attached as accelerators and
 *   only ever re-check that same state.
 * - Consequence: mount order, hydration timing, a warm HTTP cache and a
 *   refresh part-way down the page all converge on the same state, because
 *   the loop asks the element what it has rather than remembering what it
 *   was told.
 *
 * WebKit-only opening (opt in with `autoplayUntilScroll`):
 * - Safari, iOS and iPadOS get a film that plays on load, looping over its
 *   first OPENING_SECONDS rather than its whole length. The reader's first
 *   scroll takes control immediately, from the frame then on screen, and the
 *   small remaining gap closes while the film continues to move FORWARDS —
 *   never backwards under a reader scrolling down, which is the reverse
 *   nudge that used to be visible. Blink and Gecko never enter this mode and
 *   scrub from the first frame exactly as before.
 * - It doubles as the sturdiest fix for the iPad: a video that has never
 *   played may hold no decoded frame and no buffered media, and so cannot
 *   serve a seek at all. One that is genuinely playing has both.
 * - If autoplay is refused (iOS Low Power Mode) the film falls back to the
 *   plain scrubber rather than neither playing nor scrubbing.
 *
 * Safari/iOS contract (scrub videos that are never play()ed):
 * - `playsInline` + legacy `webkit-playsinline`, muted, no remote playback.
 * - iOS won't paint a frame for a metadata-preloaded video: the playhead is
 *   nudged off zero (on loadedmetadata, and again from the loop while no
 *   frame exists), and the decoder is primed with a muted play()→pause()
 *   on every approach until a frame exists — allowed without a gesture for
 *   muted inline video, and retried because one rejected play() (iOS Low
 *   Power Mode) must not disable the film for the rest of the session.
 * - Safari will not resume a suspended fetch on a `preload` flip alone, so a
 *   video idling at HAVE_METADATA — which cannot serve a scrub at all — has
 *   its fetch restarted with an explicit load(). Capped, and latched off the
 *   moment a first frame exists: load() resets the playhead and drops the
 *   buffer, so it must never fire against a film that is already scrubbing.
 * - The element only fades in once the decoder actually holds a frame; if
 *   every source fails, the marble veil simply remains — no black box.
 *
 * Under prefers-reduced-motion the film holds its first frame as a still.
 */
export function ScrollHero({
  src,
  webmSrc,
  mobileSrc,
  heightVh = 300,
  smoothing,
  autoplayUntilScroll = false,
  className,
  children,
}: ScrollHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<MotionValue<number>>();
  if (!progressRef.current) progressRef.current = motionValue(0);
  const progress = progressRef.current;

  // Source choice is settled once at mount: swapping media mid-session
  // would force a full re-buffer for no visual gain.
  const [compact] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches
  );
  const activeSrc = compact && mobileSrc ? mobileSrc : src;

  // Fade in only once the decoder actually holds a frame; a source that
  // never loads leaves the veil/marble backdrop instead of a black box.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    video.pause();

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let current = 0;
    let frame = 0;
    let active = false;
    let revealed = false;
    let restarts = 0;

    // WebKit only: the film plays and loops until the reader's first scroll,
    // then hands over to the scrubber. This is also the sturdiest possible
    // answer to the iPad, where a video that has never played may hold no
    // decoded frame and no buffered media, and therefore cannot serve a seek
    // at all — a film that is genuinely playing has both by definition.
    const engine = detectEngine();
    const profile = scrubProfile();
    // fastSeek is Safari's own scrubbing API; guard on the method existing
    // as well as the profile asking for it.
    const useFastSeek =
      profile.fastSeek && typeof video.fastSeek === 'function';
    const lerp = smoothing ?? profile.smoothing;
    let mode: 'play' | 'scrub' =
      autoplayUntilScroll && engine === 'webkit' && !reduced ? 'play' : 'scrub';
    // Gap, in seconds, between where the opening left the playhead and where
    // the timeline wants it. Decays to zero over a few hundred milliseconds
    // and is then gone for good.
    let offset = 0;
    // Previous frame's timeline position, so the loop can tell which way the
    // reader is going and close the handover gap in the direction where it
    // cannot be seen.
    let lastTime = 0;

    // Readiness is READ FROM THE ELEMENT, never inferred from an event
    // having fired. iOS may never fire `loadeddata` for a video that is
    // preloaded as metadata and never played, and Safari does not re-fire it
    // for a fetch that was suspended and later resumed. Anything that waits
    // on one specific event to arrive is a race; polling the element inside
    // the loop that is already running is not.
    const hasFrame = () =>
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const reveal = () => {
      if (revealed || !hasFrame()) return;
      revealed = true;
      setReady(true);
    };

    const onLoadedMetadata = () => {
      // iOS Safari paints nothing at preload="metadata"; nudging the
      // playhead forces the first frame to decode and display.
      if (video.currentTime === 0) {
        try {
          video.currentTime = 0.001;
        } catch {
          // Seeking before metadata settles can throw on old WebKit; the
          // loop's own first-frame nudge still surfaces the frame.
        }
      }
    };

    // Muted inline play()→pause() is permitted without a gesture and is the
    // one reliable way to wake a lazy iOS decoder for a scrub-only video.
    // Retried on every approach until a frame actually exists, because a
    // single latched attempt is lost if that one play() was rejected (iOS
    // Low Power Mode) or if the element was reloaded underneath it.
    // Keep the film running in play mode. Re-attempted from the loop rather
    // than once at arming, because our own ensureLoading() calls load(), and
    // a load() rejects any play() still in flight with AbortError. Only a
    // NotAllowedError is a real refusal by the browser (iOS Low Power Mode),
    // and only that falls back to the plain scrubber; an abort we caused
    // ourselves simply gets picked up again on the next frame.
    let playPending = false;
    const keepPlaying = () => {
      if (mode !== 'play' || playPending || video.error || !video.paused) {
        return;
      }
      video.loop = true;
      playPending = true;
      const running = video.play();
      if (running && typeof running.then === 'function') {
        running
          .then(() => {
            playPending = false;
          })
          .catch((error: DOMException) => {
            playPending = false;
            if (error?.name === 'NotAllowedError') {
              mode = 'scrub';
              video.loop = false;
            }
          });
      } else {
        playPending = false;
      }
    };

    const prime = () => {
      if (video.error) return;
      // In play mode the film is meant to keep running, so this is a real
      // play() and not a wake-up nudge.
      if (mode === 'play') {
        keepPlaying();
        return;
      }
      // `shown`, not hasFrame(): readyState can dip back below HAVE_CURRENT_DATA
      // while re-buffering mid-scrub, and waking the decoder then would shove
      // the playhead. Once a frame has ever existed, initialisation is over.
      if (revealed) return;
      const played = video.play();
      if (played && typeof played.then === 'function') {
        played.then(() => video.pause()).catch(() => {});
      } else {
        video.pause();
      }
    };

    // A video parked at HAVE_METADATA cannot serve a scrub, and Safari will
    // not resume a suspended fetch on a `preload` flip alone — the element
    // sits at readyState 1 / networkState IDLE for ever and every seek lands
    // on data that was never fetched. Restart the fetch when the section
    // approaches and the element has gone idle short of usable data. Capped,
    // and never once real data exists, so a buffer is never thrown away.
    const ensureLoading = () => {
      if (video.preload !== 'auto') video.preload = 'auto';
      // Latched on `shown` for the same reason as prime(), and because load()
      // is destructive: it resets the playhead and discards the buffer. Before
      // the first frame there is nothing to lose; after it, never.
      if (video.error || revealed || restarts >= 3) return;
      const idle =
        video.networkState === HTMLMediaElement.NETWORK_EMPTY ||
        video.networkState === HTMLMediaElement.NETWORK_IDLE;
      if (!idle) return;
      // Parked means parked on *nothing*: a header and no media. If a second
      // of footage has already arrived the fetch is doing its job and a
      // restart would only throw that away and re-seek from zero.
      const buffered = video.buffered;
      const held = buffered.length ? buffered.end(buffered.length - 1) : 0;
      if (held >= 1) return;
      restarts += 1;
      try {
        video.load();
      } catch {
        // NETWORK_NO_SOURCE: the fade-in gate keeps the veil instead.
      }
    };

    const tick = () => {
      // One batched read per frame; all writes follow it.
      const rect = container.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      const target =
        runway > 0 ? Math.min(1, Math.max(0, -rect.top / runway)) : 0;

      current += (target - current) * lerp;
      if (Math.abs(target - current) < 0.0005) current = target;
      progress.set(current);

      // Duration is re-read every frame rather than captured when some event
      // fired, so a late, re-fired or missed `loadedmetadata` cannot leave
      // the scrubber holding a stale 0 and silently doing nothing.
      const duration = video.duration;
      if (
        duration > 0 &&
        Number.isFinite(duration) &&
        video.readyState >= HTMLMediaElement.HAVE_METADATA
      ) {
        // ONE TIMELINE. The film's position is the scroll position, always:
        // runway top is frame 0, runway end is the last frame, and there is
        // no second mapping anywhere. Scrolling up therefore runs the film
        // back to frame 0 like any other point on it, and scrolling down
        // finishes on the last frame.
        const time = current * duration;

        if (mode === 'play') {
          keepPlaying();
          // The opening loops over the film's first seconds rather than its
          // whole length, so the playhead is never far from where the
          // timeline wants it when the reader takes over. `loop` cannot
          // express a partial range, so the wrap is done here.
          if (video.currentTime >= OPENING_SECONDS) {
            video.currentTime = 0;
          }
          // The reader's FIRST scroll takes control, immediately. Waiting for
          // the scroll to catch the playhead left the film playing on,
          // ignoring the scroll for as long as it took to converge, which is
          // what made the transition read as unresponsive on Safari.
          if (current > 0.002) {
            mode = 'scrub';
            video.loop = false;
            video.pause();
            // Hand over from the frame that is on screen, not the one the
            // timeline wants. Carrying the difference as an OFFSET, rather
            // than easing the playhead toward a moving target, is what keeps
            // the film locked 1:1 to the scroll from the very first frame:
            // only the gap decays, never the tracking.
            offset = video.currentTime - time;
            lastTime = time;
          }
        }

        // The gap closes over a few hundred milliseconds instead of cutting
        // shut. Bounded in time rather than in scroll distance, and it ends
        // for good: from then on the film IS the timeline, in both
        // directions, which is what lets an upward scroll run back to frame 0
        // and a downward one finish on the last frame.
        let shown = time;
        if (offset !== 0) {
          // The gap is never closed by running the film BACKWARDS under a
          // reader scrolling forwards — that reverse nudge is exactly what
          // was visible. Descending, it is paid for out of their own forward
          // motion: the film keeps advancing, just a little slower than the
          // timeline, until the two meet. Ascending or standing still, the
          // film is already moving backwards (or not at all), so the gap can
          // simply be dropped there at no visual cost — which also means an
          // upward scroll has closed it long before frame 0.
          const advance = time - lastTime;
          if (advance > 0) {
            const close = Math.min(Math.abs(offset), advance * CLOSE_SHARE);
            offset -= Math.sign(offset) * close;
          } else {
            offset *= BLEND;
          }
          if (Math.abs(offset) < 0.03) offset = 0;
          else shown = Math.max(0, Math.min(duration, time + offset));
        }
        lastTime = time;
        // At the very top of the runway the target time is 0 — exactly where
        // the playhead already sits — so nothing would ever ask the decoder
        // for a frame and iOS would show an empty box until the first scroll.
        const seekTo = !revealed && shown < 0.001 ? 0.001 : shown;
        const drift = Math.abs(video.currentTime - seekTo);
        // Skip sub-frame micro-seeks, and never stack a new seek on a
        // decoder that is still seeking unless we have fallen well behind.
        // Both thresholds come from the engine profile (src/utils/engine.ts).
        // The `paused` guard covers the frames just after a WebKit handoff:
        // the element has been told to pause but has not stopped yet, and
        // seeking a still-playing decoder is what made that transition
        // stutter.
        if (
          mode === 'scrub' &&
          drift > profile.minSeek &&
          video.paused &&
          (!video.seeking || drift > profile.stackedSeek)
        ) {
          if (useFastSeek) {
            video.fastSeek(seekTo);
          } else {
            video.currentTime = seekTo;
          }
        }
      }

      reveal();
      frame = requestAnimationFrame(tick);
    };

    // The observer is the only "listener": it arms the loop when the film
    // approaches and disarms it (and any pending seek work) when it leaves.
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry.isIntersecting;
        if (near && !active) {
          active = true;
          ensureLoading();
          prime();
          // Reduced motion still loads and paints the still first frame —
          // it just never scrubs.
          if (!reduced) frame = requestAnimationFrame(tick);
        } else if (!near && active) {
          active = false;
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: '50% 0px 50% 0px' }
    );

    // Events are accelerators, not the contract: each one only re-checks the
    // element's own state, so a missing event costs nothing and a duplicate
    // event does nothing. `stalled`/`suspend` are where Safari parks a fetch
    // it has decided not to finish.
    const recheck = () => {
      reveal();
      if (active) ensureLoading();
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('loadeddata', reveal);
    video.addEventListener('canplay', reveal);
    video.addEventListener('seeked', reveal);
    video.addEventListener('stalled', recheck);
    video.addEventListener('suspend', recheck);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) onLoadedMetadata();
    reveal();
    observer.observe(container);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('loadeddata', reveal);
      video.removeEventListener('canplay', reveal);
      video.removeEventListener('seeked', reveal);
      video.removeEventListener('stalled', recheck);
      video.removeEventListener('suspend', recheck);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [autoplayUntilScroll, progress, smoothing]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ height: `${heightVh}vh` }}
    >
      {/* translateZ(0): pre-promote the pinned viewport to its own
          compositor layer so Safari never re-rasterises it mid-scroll. */}
      <div className="sticky top-0 h-[100dvh] overflow-hidden [transform:translateZ(0)]">
        <video
          ref={videoRef}
          muted
          playsInline
          preload="metadata"
          disableRemotePlayback
          aria-hidden="true"
          // Legacy WebKit inline hint (pre-iOS 10 attribute name; some iOS
          // WebViews still honour only this spelling).
          {...{ 'webkit-playsinline': '' }}
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            ready ? 'opacity-100' : 'opacity-0'
          )}
        >
          {/* Phones get the lower-resolution H.264; the WebM stays as the
              universal fallback for browsers without H.264 decoders. */}
          <source src={activeSrc} type="video/mp4" />
          {webmSrc && <source src={webmSrc} type="video/webm" />}
        </video>
        {children?.(progress)}
      </div>
    </div>
  );
}
