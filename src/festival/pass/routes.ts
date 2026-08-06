import { useLocation } from 'react-router-dom';

/**
 * Where the volunteer portal lives.
 *
 * It used to live at one path, `/verify-pass`. It now answers at TWO, because
 * the people who use it think of it as two different things: a volunteer opens
 * it to scan passes at a gate, an administrator opens it to run the desk.
 * Giving each the address they would guess costs one route tree mounted twice.
 *
 * NEITHER IS A REDIRECT TO THE OTHER. `/admin` and `/volunteer` are the same
 * portal with the same sequence, and whichever one you arrive at is the one
 * you stay under: sign in at `/admin` and the dashboard is `/admin/admin`,
 * sign in at `/volunteer` and it is `/volunteer/admin`. That is what
 * `portalBase` is for. Bouncing everyone to a single canonical prefix would
 * have been less code and would have meant one of the two addresses was a
 * polite fiction.
 *
 * `/verify-pass` is kept alive as a redirect and cannot be dropped: it is
 * printed, as a QR code, on every pass already issued.
 */
export const PORTAL_BASES = ['/volunteer', '/admin'] as const;

/** The one baked into new QR codes, which have no router to ask. */
export const PORTAL_CANONICAL = '/volunteer';

/** The original path. Still on printed passes, so still routed. */
export const PORTAL_LEGACY = '/verify-pass';

/** Every prefix the portal answers on, newest first. */
export const PORTAL_PREFIXES = [...PORTAL_BASES, PORTAL_LEGACY];

/** The static children of a portal base. Anything else there is a token. */
export const PORTAL_PAGES = new Set(['login', 'admin', 'profile']);

/**
 * The base a path sits under, or null if it is not in the portal at all.
 * Matched on a segment boundary so `/administration` is not read as `/admin`.
 */
export function portalBaseOf(pathname: string): string | null {
  return (
    PORTAL_PREFIXES.find(
      (base) => pathname === base || pathname.startsWith(`${base}/`)
    ) ?? null
  );
}

/**
 * The base the caller is currently under, for building links that keep
 * someone on the address they arrived at. Falls back to the canonical one so
 * a component rendered outside the portal still produces a working link.
 */
export function usePortalBase(): string {
  const { pathname } = useLocation();
  const base = portalBaseOf(pathname);
  // The legacy prefix is routed, but nothing should LINK to it any more.
  return base && base !== PORTAL_LEGACY ? base : PORTAL_CANONICAL;
}
