import { useLocation } from 'react-router-dom';

/**
 * Where the volunteer portal lives, and what the pages under it are called.
 *
 * TWO BASES, ONE PER AUDIENCE. `/volunteers` is the gate; `/admin` is the
 * desk. The same route tree is mounted under both, so an administrator who
 * needs to scan a pass goes to `/admin/verify-pass` without leaving the
 * address they know, and a volunteer never sees `/admin` in their URL bar.
 *
 * The PAGE NAMES say what the pages are. They used to be positional — the
 * portal root was the scanner and the dashboard was called `admin`, which
 * gave an administrator the address `/admin/admin`. Naming them fixes that:
 * `/admin/dashboard` and `/volunteers/verify-pass` are both readable out
 * loud, which matters for something a volunteer is told over a phone.
 *
 * `/verify-pass` is kept alive and cannot be dropped: it is printed, as a QR
 * code, on every pass already issued. `/volunteer` (singular) is kept for the
 * same reason on a smaller scale, having briefly been the live address.
 */
export const PORTAL_BASES = ['/volunteers', '/admin'] as const;

/** The pages under a base. */
export const PORTAL_PAGES = {
  login: 'login',
  /** Administrators only: accounts, and the gate activity log. */
  dashboard: 'dashboard',
  profile: 'profile',
  /** The scanner, and the parent of a scanned token. */
  verify: 'verify-pass',
} as const;

/** Where a QR code points. It has no router to ask, so it must be absolute. */
export const PORTAL_CANONICAL = `/volunteers/${PORTAL_PAGES.verify}`;

/** Prefixes that are no longer linked to but must keep resolving. */
export const PORTAL_LEGACY = ['/verify-pass', '/volunteer'] as const;

/** Every prefix the portal answers on. */
const PREFIXES = [...PORTAL_BASES, ...PORTAL_LEGACY];

/**
 * The base a path sits under, or null if it is not in the portal.
 * Matched on a segment boundary, so `/administration` is not read as `/admin`
 * and `/volunteers` is not read as `/volunteer`.
 */
export function portalBaseOf(pathname: string): string | null {
  return (
    PREFIXES.find(
      (base) => pathname === base || pathname.startsWith(`${base}/`)
    ) ?? null
  );
}

/**
 * WHERE SIGNING IN LANDS YOU, decided by ROLE rather than by the address you
 * signed in at. An administrator's home is the desk and a volunteer's is the
 * scanner; those are different jobs, not different URLs for the same one, so
 * a volunteer who was handed the `/admin` link still ends up somewhere that
 * makes sense to them. A deep link asked for explicitly (a scanned pass) still
 * wins over both.
 */
export function homeFor(role: string): string {
  return role === 'admin'
    ? `/admin/${PORTAL_PAGES.dashboard}`
    : `/volunteers/${PORTAL_PAGES.verify}`;
}

/**
 * The base the caller is currently under, for links that keep someone on the
 * address they arrived at. Falls back to `/volunteers` so a component rendered
 * outside the portal still produces a working link.
 */
export function usePortalBase(): string {
  const { pathname } = useLocation();
  const base = portalBaseOf(pathname);
  return base && !PORTAL_LEGACY.includes(base as (typeof PORTAL_LEGACY)[number])
    ? base
    : '/volunteers';
}

/**
 * An address from before the rename, mapped to where that page lives now.
 *
 * The token case is the one that matters: a pass printed months ago encodes
 * `/verify-pass/<token>`, and a volunteer scanning it at the gate cannot know
 * anything changed. Everything unrecognised is treated as a token, which is
 * the safe default here because the named pages are all enumerated above it.
 */
export function legacyTarget(pathname: string): string {
  const base = PORTAL_LEGACY.find(
    (b) => pathname === b || pathname.startsWith(`${b}/`)
  );
  if (!base) return PORTAL_CANONICAL;
  const rest = pathname.slice(base.length).replace(/^\//, '');
  if (!rest) return PORTAL_CANONICAL;
  if (rest === 'login') return `/volunteers/${PORTAL_PAGES.login}`;
  if (rest === 'profile') return `/volunteers/${PORTAL_PAGES.profile}`;
  // `admin` was the old name of the dashboard.
  if (rest === 'admin') return `/admin/${PORTAL_PAGES.dashboard}`;
  // `/volunteer/verify-pass` — the shape the singular base briefly used.
  if (rest === PORTAL_PAGES.verify || rest.startsWith(`${PORTAL_PAGES.verify}/`)) {
    return `/volunteers/${rest}`;
  }
  return `${PORTAL_CANONICAL}/${rest}`;
}
