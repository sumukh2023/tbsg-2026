/**
 * The site's districts.
 *
 * One record per page: the route, the label the navigation shows, the
 * `data-chapter` key that swaps the colour tokens (see globals.css), and the
 * canvas colour the browser paints beyond the page edges during rubber-band
 * overscroll. That last one is why this list is data rather than five
 * hard-coded components — the canvas has to know a route's colour BEFORE the
 * page mounts, or the overscroll flashes marble on a page that is not marble.
 *
 * Kept free of JSX so it can be imported by the router without pulling a page
 * chunk in with it.
 */
export type Chapter = {
  path: string;
  label: string;
  /** Matches a `[data-chapter='…']` block in globals.css. */
  key: 'mission' | 'stalls' | 'partners' | 'gallery' | 'enquiry';
  /** The chapter's `--background`, as a ready-to-use CSS colour. */
  canvas: string;
};

/** Navigation order, exactly as it appears in the bar. */
export const CHAPTERS: Chapter[] = [
  {
    path: '/mission',
    label: 'Our Mission',
    key: 'mission',
    canvas: 'hsl(34 44% 95%)',
  },
  { path: '/stalls', label: 'Stalls', key: 'stalls', canvas: 'hsl(68 26% 93%)' },
  {
    path: '/partners',
    label: 'Partners',
    key: 'partners',
    canvas: 'hsl(30 24% 94%)',
  },
  {
    path: '/gallery',
    label: 'Gallery',
    key: 'gallery',
    canvas: 'hsl(34 40% 95%)',
  },
  {
    path: '/enquiry',
    label: 'Enquiry',
    key: 'enquiry',
    canvas: 'hsl(40 32% 95%)',
  },
];

export function chapterFor(pathname: string): Chapter | undefined {
  return CHAPTERS.find(
    (c) => pathname === c.path || pathname.startsWith(`${c.path}/`)
  );
}

/**
 * Where "Support Us" points until donations exist. A single constant so the
 * day that page is built, every button moves at once — and so nothing ships
 * a dead `#` that looks like a working control.
 */
export const SUPPORT_PATH = '/enquiry';
