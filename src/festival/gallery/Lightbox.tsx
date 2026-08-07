import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { EASE } from '@/utils/motion';
import type { Photo } from './photos';

/**
 * A photograph, fullscreen, with the rest of the site out of the way.
 *
 * IT OPENS INSTANTLY because it shows the SAME `src` the plate on the page
 * already loaded: the browser serves it from cache and the first frame is
 * painted with the picture in it. Loading a larger file here would be a
 * spinner over a black screen, which is the one thing a lightbox must never
 * be.
 *
 * IT IS A PORTAL for the reason every overlay on this site is one. A fixed
 * element is positioned against its nearest ancestor with a transform,
 * filter or containment on it, and this page is full of them: every reveal is
 * a `motion.div` that animates `y`, and a transform on an ancestor makes it
 * the containing block. Rendering into `document.body` means the viewport is
 * the only thing this is ever measured against.
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: Photo[];
  /** Null when closed. The index into `photos`, not a photograph. */
  index: number | null;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const open = index !== null;
  const panel = useRef<HTMLDivElement>(null);
  /* Where focus was when this opened. Returning it on close is what keeps a
     keyboard reader from being dropped at the top of the document after
     looking at one photograph halfway down the wall. */
  const restoreTo = useRef<Element | null>(null);

  const go = useCallback(
    (step: number) => {
      if (index === null || photos.length === 0) return;
      // Wraps, because a deck that stops at both ends makes the reader
      // remember which end they are at.
      onNavigate((index + step + photos.length) % photos.length);
    },
    [index, onNavigate, photos.length]
  );

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement;
    panel.current?.focus();

    /* THE PAGE BEHIND MUST NOT SCROLL, and `overflow: hidden` alone does not
       do it on iOS. Fixing the body at its current offset does, and the
       offset is put back on close so the reader returns to the photograph
       they opened rather than to the top of the page. */
    const y = window.scrollY;
    const { style } = document.body;
    const previous = {
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow,
    };
    style.position = 'fixed';
    style.top = `-${y}px`;
    style.width = '100%';
    style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'Tab') {
        /* A one-panel focus trap. There are only ever three controls in here,
           so keeping Tab inside the overlay is a matter of finding them and
           wrapping, rather than of a general trap. */
        const focusable = panel.current?.querySelectorAll<HTMLElement>('button');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      style.overflow = previous.overflow;
      window.scrollTo(0, y);
      (restoreTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, go]);

  /* Both, so the JSX below has a non-null number to count with: narrowing
     `index` through `photo &&` is something TypeScript cannot follow. */
  const at = index ?? -1;
  const photo = index === null ? null : photos[index];

  return createPortal(
    <AnimatePresence>
      {photo && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={photo.caption}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE.out }}
          className="fixed inset-0 z-[120] flex flex-col bg-[hsl(205_40%_6%/0.97)] backdrop-blur-xl focus:outline-none"
          onClick={(event) => {
            // The ground closes; the picture and the controls do not.
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div className="flex flex-none items-center justify-between px-5 pt-5 md:px-8 md:pt-7">
            <p className="font-body text-xs uppercase tracking-[0.24em] text-white/55">
              <span className="tabular-nums text-white/90">
                {String(at + 1).padStart(2, '0')}
              </span>
              <span aria-hidden="true"> / </span>
              <span className="tabular-nums">
                {String(photos.length).padStart(2, '0')}
              </span>
            </p>
            <Control label="Close" onClick={onClose}>
              <X className="h-5 w-5" />
            </Control>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 md:px-20"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            {photos.length > 1 && (
              <div className="pointer-events-none absolute inset-x-3 top-1/2 z-10 flex -translate-y-1/2 justify-between md:inset-x-6">
                <Control label="Previous photograph" onClick={() => go(-1)}>
                  <ChevronLeft className="h-5 w-5" />
                </Control>
                <Control label="Next photograph" onClick={() => go(1)}>
                  <ChevronRight className="h-5 w-5" />
                </Control>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.img
                key={photo.id}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.3, ease: EASE.out }}
                // `max-h-full` with `object-contain` is what keeps a portrait
                // photograph inside the viewport instead of running the
                // overlay off the bottom of a phone.
                className="max-h-full max-w-full rounded-sm object-contain shadow-[0_40px_120px_-30px_rgb(0_0_0/0.8)]"
              />
            </AnimatePresence>
          </div>

          <motion.figcaption
            key={`${photo.id}-caption`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: EASE.out }}
            className="flex-none px-6 pb-7 pt-3 text-center md:pb-9"
          >
            <p className="font-display text-lg italic text-white/90 md:text-xl">
              {photo.caption}
            </p>
            <p className="mt-1.5 font-body text-xs uppercase tracking-[0.2em] text-white/45">
              {photo.categories.join(' · ')}
            </p>
          </motion.figcaption>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Control({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/80 backdrop-blur-md transition-colors duration-300 hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {children}
    </button>
  );
}
