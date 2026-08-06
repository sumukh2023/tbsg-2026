/**
 * URL anonymisation for Vercel Analytics and Speed Insights.
 *
 * Kept apart from the component so it is a plain module: importable by a
 * test, and free of the fast-refresh rule that a file mixing components with
 * exported helpers trips.
 *
 * A pass token IS the credential. It travels in the URL (`/pass/:token`,
 * `/verify-pass/:token`), the server stores only its SHA-256, and anyone
 * holding it can display a valid pass. Both telemetry products report the
 * page URL, so without this they would ship live pass tokens into a
 * third-party pipeline and fill the dashboard with one row per token instead
 * of one row per page.
 */

/**
 * The portal answers on four prefixes (see festival/pass/routes.ts) and a
 * token can appear under any of them, so all four are masked. Written without
 * the leading slash because this compares path SEGMENTS.
 */
const PORTAL_HEADS = new Set(['verify-pass', 'volunteer', 'volunteers', 'admin']);

/** Static children of a portal prefix. Everything else there is a token. */
const NAMED_VERIFY_PAGES = new Set([
  'login',
  'admin',
  'dashboard',
  'profile',
  'verify-pass',
]);

/**
 * A pathname with any pass token replaced.
 *
 * Deliberately a denylist of the two routes that carry a secret rather than
 * an allowlist of every route: a new page added tomorrow should be reported
 * normally without anyone remembering to register it, whereas a new
 * token-bearing route is a deliberate act that lands next to this comment.
 */
export function anonymisePath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 2) {
    const [head, tail] = segments;
    if (head === 'pass') return '/pass/[token]';
    // The shape the OLD portal used: a token directly under the prefix.
    if (PORTAL_HEADS.has(head) && !NAMED_VERIFY_PAGES.has(tail)) {
      return `/${head}/[token]`;
    }
  }
  // The shape it uses now: `<base>/verify-pass/<token>`.
  if (segments.length === 3) {
    const [head, page] = segments;
    if (PORTAL_HEADS.has(head) && page === 'verify-pass') {
      return `/${head}/verify-pass/[token]`;
    }
  }
  return pathname;
}

/** The same treatment applied to a full URL, for the `beforeSend` hooks. */
export function scrubUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.pathname = anonymisePath(url.pathname);
    // Query and hash are dropped wholesale. Nothing on this site needs them
    // for analytics, and `/pass?token=…` would be the same leak by another
    // route.
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

