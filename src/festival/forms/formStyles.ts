import { useEffect, useRef } from 'react';

/**
 * The two button shapes and the ground trick every transactional page on this
 * site shares.
 *
 * Kept out of `FormShell.tsx` deliberately: a module that exports both
 * components and plain values breaks React Fast Refresh, which then reloads
 * the whole page on every edit instead of swapping the component.
 */

export const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

export const ghostButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

/**
 * Paints the page's own ground onto `body` for as long as the page is
 * mounted.
 *
 * These pages are dark while the document stays marble, and any moment the
 * root is shorter than the visual viewport — rubber-band overscroll, the
 * address bar collapsing on a phone — shows that marble as a pale band under
 * the design. Returns the ref to attach to the element whose colour should be
 * borrowed.
 */
export function useOwnGround() {
  const ground = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ground.current;
    if (!el) return;
    const { body } = document;
    const previous = body.style.backgroundColor;
    body.style.backgroundColor = getComputedStyle(el).backgroundColor;
    return () => {
      body.style.backgroundColor = previous;
    };
  }, []);
  return ground;
}
