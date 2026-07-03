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
 * The playhead glides via requestAnimationFrame lerp instead of snapping,
 * and the whole thing collapses to a still first frame under
 * prefers-reduced-motion.
 */
export function ScrollHero({
  src,
  webmSrc,
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

    let target = 0;
    let current = 0;
    let duration = Number.isFinite(video.duration) ? video.duration : 0;
    let frame = 0;

    const onLoadedMetadata = () => {
      duration = video.duration;
    };

    // The listener only measures; all writes happen inside the rAF loop.
    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      target = runway > 0 ? Math.min(1, Math.max(0, -rect.top / runway)) : 0;
    };

    const tick = () => {
      current += (target - current) * smoothing;
      if (Math.abs(target - current) < 0.0005) current = target;
      progress.set(current);
      if (duration > 0 && video.readyState >= 1) {
        const time = current * duration;
        if (Math.abs(video.currentTime - time) > 0.001) {
          video.currentTime = time;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    frame = requestAnimationFrame(tick);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
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
          preload="auto"
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            ready ? 'opacity-100' : 'opacity-0'
          )}
        >
          <source src={src} type="video/mp4" />
          {webmSrc && <source src={webmSrc} type="video/webm" />}
        </video>
        {children?.(progress)}
      </div>
    </div>
  );
}
