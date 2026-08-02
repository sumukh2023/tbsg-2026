import { useEffect, useRef, useState } from 'react';

/**
 * A looping, muted, full-bleed background film.
 *
 * NOT the scroll-scrub engine. That one seeks a playhead from scroll position
 * and is deliberately fragile about readiness; this simply plays and loops,
 * which is a far easier contract — so it gets its own small component rather
 * than another mode bolted onto ScrollHero.
 *
 * Cross-browser notes, all of them earned earlier in this project:
 * - `muted` + `playsInline` (+ the legacy `webkit-playsinline` spelling) is
 *   what makes autoplay permissible on iOS and iPadOS at all. Without them
 *   Safari either refuses or takes the video fullscreen.
 * - `autoPlay` alone is not enough: Safari can decline and never retry. The
 *   effect calls play() explicitly, and again on the reader's first gesture,
 *   because a site set to "Never Auto-Play" only relents after one.
 * - A refused play() is not an error state. The poster layer underneath stays
 *   visible and the page reads as designed — a still frame, not a black box.
 * - `onCanPlay` gates the fade-in, so a slow connection shows the material
 *   backdrop rather than a flash of empty video element.
 *
 * If the file is missing the element simply never fires `canplay`, `ready`
 * stays false, and the backdrop remains. That is the intended fallback while
 * `public/carnival.mp4` is not in the repo.
 */
export function HeroFilm({
  src,
  webmSrc,
  poster,
  className,
}: {
  src: string;
  /**
   * Optional VP9/WebM alongside the H.264. Every browser this site targets
   * decodes H.264, so this is not needed for them — but a source set costs
   * nothing, and it is what lets the film be verified in environments
   * without the patent-encumbered decoder (this repo's sandbox Chromium
   * among them; see gotcha 3 in CONTEXT.md).
   */
  webmSrc?: string;
  /** Rendered beneath the film: shown before it loads, and if it never does. */
  poster?: React.ReactNode;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  /**
   * How much to fetch before playing. A 1080p hero film is the heaviest asset
   * on a page, and pulling all of it up front on a phone is a real cost in
   * data and in Lighthouse. `metadata` on touch devices lets playback start
   * from the beginning of the file and stream the rest — which works because
   * these files are muxed faststart (moov before mdat). Desktop keeps `auto`.
   */
  const [preload] = useState<'auto' | 'metadata'>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches
      ? 'metadata'
      : 'auto'
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reduced motion: hold the first frame rather than looping under someone
    // who asked for stillness. The film still paints, so the hero is not
    // suddenly empty for them.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches;
    if (reduced) {
      video.autoplay = false;
      video.loop = false;
      return;
    }

    let cancelled = false;
    const attempt = () => {
      if (cancelled) return;
      const playing = video.play();
      // Older Safari returns undefined rather than a promise.
      playing?.catch(() => {
        /* Declined. The gesture listener below is the retry. */
      });
    };

    attempt();

    // One retry on the reader's first real interaction. Scrolling does not
    // count for this purpose; a tap or a key does.
    const onGesture = () => {
      attempt();
      detach();
    };
    const detach = () => {
      for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
        document.removeEventListener(type, onGesture);
      }
    };
    for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
      document.addEventListener(type, onGesture, { passive: true });
    }

    return () => {
      cancelled = true;
      detach();
    };
  }, [src]);

  return (
    <div className={className}>
      {poster}
      <video
        ref={videoRef}
        muted
        loop
        autoPlay
        playsInline
        preload={preload}
        disableRemotePlayback
        aria-hidden="true"
        tabIndex={-1}
        onCanPlay={() => setReady(true)}
        // Legacy WebKit inline hint; some iOS WebViews honour only this one.
        {...{ 'webkit-playsinline': '' }}
        className={
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ' +
          (ready ? 'opacity-100' : 'opacity-0')
        }
      >
        <source src={src} type="video/mp4" />
        {webmSrc && <source src={webmSrc} type="video/webm" />}
      </video>
    </div>
  );
}
