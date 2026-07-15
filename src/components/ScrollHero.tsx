import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motionValue, type MotionValue } from 'framer-motion';
import { cn } from '@/utils/cn';

export interface ScrollHeroProps {
  /** Video served from public/, e.g. "/hero.mp4". */
  src: string;
  /** Optional WebM fallback for browsers without H.264. */
  webmSrc?: string;
  /** Optional lower-resolution H.264 source served to phones. */
  mobileSrc?: string;
  /** Total scroll runway; the sticky viewport stays pinned through it. */
  heightVh?: number;
  /** Smoothing factor for the playhead lerp (0..1, higher = snappier). */
  smoothing?: number;
  className?: string;
  /**
   * Sticky-viewport content layered over the video. Receives the smoothed
   * scrub progress (0..1) as a MotionValue for scroll-linked choreography.
   */
  children?: (progress: MotionValue<number>) => ReactNode;
}

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
 * Under prefers-reduced-motion the film collapses to a still first frame.
 */
export function ScrollHero({
  src,
  webmSrc,
  mobileSrc,
  heightVh = 300,
  smoothing = 0.22,
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

  // Fade the video in over the first 200ms so it never pops in cold.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    video.pause();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // hold the first frame as a still backdrop
    }

    let current = 0;
    let duration = Number.isFinite(video.duration) ? video.duration : 0;
    let frame = 0;
    let active = false;

    const onLoadedMetadata = () => {
      duration = video.duration;
    };

    const tick = () => {
      // One batched read per frame; all writes follow it.
      const rect = container.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      const target =
        runway > 0 ? Math.min(1, Math.max(0, -rect.top / runway)) : 0;

      current += (target - current) * smoothing;
      if (Math.abs(target - current) < 0.0005) current = target;
      progress.set(current);

      if (duration > 0 && video.readyState >= 1) {
        const time = current * duration;
        const drift = Math.abs(video.currentTime - time);
        // Skip sub-frame micro-seeks, and never stack a new seek on a
        // decoder that is still seeking unless we have fallen well behind.
        if (drift > 0.02 && (!video.seeking || drift > 0.3)) {
          video.currentTime = time;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    // The observer is the only "listener": it arms the loop when the film
    // approaches and disarms it (and any pending seek work) when it leaves.
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry.isIntersecting;
        if (near && !active) {
          active = true;
          if (video.preload !== 'auto') video.preload = 'auto';
          frame = requestAnimationFrame(tick);
        } else if (!near && active) {
          active = false;
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: '50% 0px 50% 0px' }
    );

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    observer.observe(container);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [progress, smoothing]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ height: `${heightVh}vh` }}
    >
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
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
