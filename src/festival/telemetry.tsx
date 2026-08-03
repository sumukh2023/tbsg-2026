import { useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { anonymisePath, scrubUrl } from './telemetry-path';

/**
 * Vercel Web Analytics and Speed Insights, wired up ONCE and inside the
 * router, because both of them need to know which route they are on.
 *
 * Neither is inert by default, and the default is wrong for this site: see
 * `telemetry-path.ts` for what is redacted and why. The anonymised path
 * doubles as Speed Insights' `route`, so the two can never disagree and
 * there is no second copy of the route table to drift from the router.
 */

/**
 * Module scope, so the identity is stable. Both components re-register their
 * hook whenever `beforeSend` changes, and an inline arrow would hand them a
 * new function on every render.
 *
 * TOTAL on purpose. Whatever this returns is what gets reported, and anything
 * it THROWS takes the measurement with it: a hook that raises inside the
 * vendor's send path loses that event, and a beforeSend that threw on the
 * first vital would look exactly like an integration that was never installed.
 * So it never assumes a shape. An event without a usable `url` is passed
 * through untouched rather than dropped, because a slightly over-shared URL is
 * a smaller problem than silently reporting nothing at all.
 */
const scrubAnalyticsEvent = <T extends { url?: unknown }>(event: T): T => {
  try {
    if (!event || typeof event.url !== 'string') return event;
    return { ...event, url: scrubUrl(event.url) };
  } catch {
    return event;
  }
};

export function Telemetry() {
  const { pathname } = useLocation();
  return (
    <>
      {/* NEVER pass `route` to Analytics. Doing so flips it to
          `disableAutoTrack`, and it then only records a pageview when BOTH
          `route` and `path` are given — so `route` alone silently reports
          nothing. Speed Insights has no such coupling; there `route` is
          purely the grouping key. */}
      <Analytics beforeSend={scrubAnalyticsEvent} />
      {/* `route` is what groups the Speed Insights dashboard by page. Without
          it every pass link is its own row and the numbers mean nothing. */}
      <SpeedInsights
        route={anonymisePath(pathname)}
        beforeSend={scrubAnalyticsEvent}
      />
    </>
  );
}
