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
 */
const scrubAnalyticsEvent = <T extends { url: string }>(event: T): T => ({
  ...event,
  url: scrubUrl(event.url),
});

export function Telemetry() {
  const { pathname } = useLocation();
  return (
    <>
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
