import { cn } from '@/utils/cn';
import { Grain } from '../materials';
import type { Photo } from './photos';

/**
 * One photograph in a frame, or the frame on its own.
 *
 * NO LAYOUT SHIFT, EVER. The frame reserves the photograph's exact aspect
 * ratio from the catalogue before the file is requested, and the image is
 * absolutely positioned inside it. Nothing moves when a picture decodes,
 * which is what makes a wall of forty of them safe to scroll while they are
 * still arriving.
 *
 * LAZY BY DEFAULT, EAGER BY EXCEPTION. Everything below the fold waits;
 * `priority` is for the one or two plates that are the first thing on screen,
 * where lazy loading is a visible pop rather than a saving.
 *
 * A PLATE WITH NO FILE IS NOT A BROKEN IMAGE. It renders the same material
 * frame the rest of the site uses while it waits for a photograph, so a
 * section can be laid out correctly before the archive is digitised. The
 * caption still reads, so the frame says what it is waiting for.
 */
export function Plate({
  photo,
  onOpen,
  priority = false,
  className,
  sizes,
  /** Shown over the photograph on hover. Off in dense grids. */
  caption = true,
}: {
  photo: Photo;
  /** Absent makes the plate inert: no button, no pointer, no hover lift. */
  onOpen?: () => void;
  priority?: boolean;
  className?: string;
  sizes?: string;
  caption?: boolean;
}) {
  const inner = (
    <>
      {photo.src ? (
        <img
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={priority ? 'eager' : 'lazy'}
          // `async` keeps a large decode off the main thread, which is the
          // difference between a wall that scrolls at 60fps while images
          // arrive and one that hitches on each.
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          sizes={sizes}
          /* The duration names its CSS property outright rather than going
             through Tailwind's `duration` scale with an arbitrary value. That
             scale covers transition-duration and animation-duration both, so
             an arbitrary value on it is ambiguous and warns on every build.

             The warning is also why this comment describes the old class
             instead of quoting it: Tailwind scans source files as content, so
             a comment containing the ambiguous class warns exactly as loudly
             as the class did. */
          className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:900ms] ease-out will-change-transform group-hover:scale-[1.045]"
        />
      ) : (
        <div
          role="img"
          aria-label={photo.alt}
          className="absolute inset-0 bg-secondary/70"
        >
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_30%,hsl(var(--accent)/0.16),transparent_75%)]" />
          <Grain className="opacity-[0.07]" />
          <div className="absolute inset-0 grid place-items-center px-6">
            <p className="text-center font-body text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Being digitised
            </p>
          </div>
        </div>
      )}

      {/* The wash and the caption ride in together on hover, so a photograph
          is a photograph until you ask it what it is. */}
      {caption && photo.src && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(205_40%_8%/0.78)] via-[hsl(205_40%_8%/0.12)] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <p className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 p-4 text-left font-body text-xs leading-snug text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 md:p-5 md:text-sm">
            {photo.caption}
          </p>
        </>
      )}
    </>
  );

  const frame = cn(
    'group relative block w-full overflow-hidden rounded-lg border border-border bg-secondary/40',
    onOpen &&
      'cursor-zoom-in transition-shadow duration-500 hover:shadow-[0_30px_70px_-45px_hsl(var(--foreground)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    className
  );

  // The ratio is inline rather than a Tailwind class because it comes from
  // data: an arbitrary pair of numbers cannot be a compiled utility.
  const ratio = { aspectRatio: `${photo.width} / ${photo.height}` };

  if (!onOpen) {
    return (
      <div className={frame} style={ratio}>
        {inner}
      </div>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={frame} style={ratio}>
      {inner}
      <span className="sr-only">Open {photo.caption} full screen</span>
    </button>
  );
}
