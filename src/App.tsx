import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import {
  RequireVolunteer,
  VolunteerSessionProvider,
} from './festival/pass/session';
import { useVolunteerSession } from './festival/pass/session-context';
import {
  homeFor,
  legacyTarget,
  PORTAL_BASES,
  PORTAL_LEGACY,
  PORTAL_PAGES,
} from './festival/pass/routes';
import { chapterFor } from './festival/pages/chapters';
import { Telemetry } from './festival/telemetry';
import { RootLayout } from '@/layouts/RootLayout';
import { SiteNav } from './festival/SiteNav';
import { Hero } from './festival/Hero';
import { Overture } from './festival/Overture';
import { PiazzaBento } from './festival/PiazzaBento';
import { Regions } from './festival/Regions';
import { Programme } from './festival/Programme';
import { Italia } from './festival/italia/Italia';
import { Voci } from './festival/Voci';
import { Giorno } from './festival/Giorno';
import { Domande } from './festival/Domande';
import { Missione } from './festival/Missione';
import { Finale } from './festival/Finale';
import { SiteFooter } from './festival/SiteFooter';
import { LiveUpdates } from './festival/live/LiveUpdates';

// Secondary experiences load on demand: they never weigh down the landing page.
const GetPassesPage = lazy(() => import('./festival/getpasses/GetPassesPage'));
const PassPage = lazy(() => import('./festival/pass/PassPage'));
const VerifyPage = lazy(() => import('./festival/pass/VerifyPage'));
const LoginPage = lazy(() => import('./festival/pass/LoginPage'));
const ProfilePage = lazy(() => import('./festival/pass/ProfilePage'));
const AdminPage = lazy(() => import('./festival/pass/AdminPage'));
const MissionPage = lazy(() => import('./festival/pages/MissionPage'));
const StallsPage = lazy(() => import('./festival/pages/StallsPage'));
const PartnersPage = lazy(() => import('./festival/pages/PartnersPage'));
const GalleryPage = lazy(() => import('./festival/pages/GalleryPage'));
const EnquiryPage = lazy(() => import('./festival/pages/EnquiryPage'));
const DonatePage = lazy(() => import('./festival/pages/DonatePage'));
const PartnerInterestPage = lazy(
  () => import('./festival/pages/PartnerInterestPage')
);
const TermsPage = lazy(() => import('./festival/legal/TermsPage'));
const PrivacyPage = lazy(() => import('./festival/legal/PrivacyPage'));

/**
 * The pass experiences are evening-dark pages while the document root keeps
 * the marble day tokens. During rubber-band overscroll Safari and Chrome
 * paint the canvas (html) background beyond the page edges — on a dark page
 * that reads as a white strip. Match the canvas to the route's chapter so
 * overscroll always reveals the page's own colour.
 */
const DARK_ROUTES =
  /^\/(get-passes|pass|verify-pass|volunteers?|admin|terms|privacy|donate)(\/|$)/;

/** Route -> page for the five districts. Order follows the navigation. */
const DISTRICTS = [
  { path: '/mission', Page: MissionPage },
  { path: '/stalls', Page: StallsPage },
  { path: '/partners', Page: PartnersPage },
  { path: '/gallery', Page: GalleryPage },
  { path: '/enquiry', Page: EnquiryPage },
];

function CanvasBackground() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    // Three cases, in order: the evening pass routes, a coloured district
    // (Mission, Stalls, …), and the marble default. The canvas has to be set
    // from the ROUTE rather than read off the page, because it is painted
    // during overscroll and on the way in — before the page has mounted.
    // Getting this wrong is what shows a white flash between pages.
    const chapter = chapterFor(pathname);
    root.style.backgroundColor = DARK_ROUTES.test(pathname)
      ? 'hsl(160 22% 8%)'
      : (chapter?.canvas ?? '');
    return () => {
      root.style.backgroundColor = '';
    };
  }, [pathname]);
  return null;
}

/**
 * Layout route for the volunteer portal: provides the session once for every
 * page beneath it, and carries the Suspense boundary for their lazy chunks.
 */
function VolunteerPortal() {
  return (
    <VolunteerSessionProvider>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </VolunteerSessionProvider>
  );
}

/**
 * An address from before the portal was renamed, sent where that page lives
 * now with the rest of the path intact.
 *
 * The rest of the path is the whole point. Every pass already issued carries
 * a QR code containing `/verify-pass/<token>`, and a volunteer scanning one
 * at the gate cannot know the address changed. Dropping the token here would
 * turn every printed pass into a link to a sign-in page with nothing behind
 * it, which is the failure this route exists to prevent.
 */
function LegacyPortalPath() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${legacyTarget(pathname)}${search}`} replace />;
}

/**
 * The bare `/volunteers` or `/admin`, which is not a page.
 *
 * A signed-in visitor goes to whichever home fits their role; anyone else is
 * sent to sign in, and comes back here afterwards. Rendered inside the portal
 * layout, so the session is already loaded by the time this runs.
 */
function PortalHome() {
  const { state } = useVolunteerSession();
  if (state.phase === 'loading') return <PageFallback />;
  if (state.phase === 'signed-in') {
    return <Navigate to={homeFor(state.volunteer.role)} replace />;
  }
  return (
    <RequireVolunteer>
      <VerifyPage />
    </RequireVolunteer>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Cross-page anchors (e.g. /#contact): wait a beat for sections to
      // mount, then let the browser's smooth scroll take over.
      const timer = setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView();
      }, 120);
      return () => clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

function PageFallback() {
  return (
    <div className="dark grid min-h-[100dvh] place-items-center bg-background">
      <p className="animate-pulse font-body text-xs font-semibold uppercase tracking-[0.22em] text-foreground">
        Flash <span className="text-primary">@</span> Brigade
      </p>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <a
        href="#piazza"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteNav />
      <Hero />
      {/* THE ITALIAN WASH, for the daylight half of the landing page.
          The districts get theirs from `Band`, which this page does not use:
          its sections are individual components in a row. One layer behind
          all of them does the same job with one element.

          It stops at the dusk block below, which is a different chapter and
          has its own dark ground. `-z-10` puts it behind the content and
          `pointer-events-none` keeps it out of the way of everything; it is
          `absolute` within a `relative` wrapper rather than `fixed`, so it
          scrolls with the page and cannot bleed into the evening. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'radial-gradient(48% 32% at 6% 12%, hsl(var(--wash-one) / 0.5), transparent 68%), radial-gradient(42% 26% at 96% 46%, hsl(var(--wash-two) / 0.42), transparent 66%), radial-gradient(52% 30% at 30% 86%, hsl(var(--wash-one) / 0.36), transparent 70%)',
          }}
        />
        <Overture />
        <PiazzaBento />
        <Regions />
        <Programme />
        <Italia />
        <Voci />
        <Giorno />
        <Domande />
      </div>
      {/* "Il campo diventa la piazza" stood here: a second scroll-scrubbed
          film. Retired 4 Aug 2026 along with the hero scrub; both are
          preserved in retired/scrub/ and `npm run scrub:restore` puts them
          back. This section has no replacement. */}
      {/* Dusk falls once: the page's single, deliberate theme shift. */}
      <div id="sera" className="dark bg-background text-foreground">
        <Missione />
        <Finale />
        <SiteFooter />
      </div>
      <LiveUpdates />
    </>
  );
}

/**
 * Flash @ Brigade 2026 · "Namma Mia Carpisa".
 * One continuous story: the landing page plus the Get Passes reservation
 * flow, sharing one design language. Decisions recorded in .design/brief.md.
 */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Telemetry />
        <RootLayout chrome={false}>
          <CanvasBackground />
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/get-passes"
              element={
                <Suspense fallback={<PageFallback />}>
                  <GetPassesPage />
                </Suspense>
              }
            />
            <Route
              path="/pass/:token?"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PassPage />
                </Suspense>
              }
            />
            {/* The volunteer portal, under one layout route so the session
                lookup happens for these pages and NOT for every public
                visitor loading the landing page.

                Sign-in is the only page here reachable without a session;
                the rest are wrapped in <RequireVolunteer>, which bounces to
                the login page carrying where you were headed, so a scanned
                QR link survives the detour. That guard is a convenience —
                /api/verify checks the session itself on every call, so the
                server is the real boundary. */}
            {/* MOUNTED TWICE, at /volunteers and at /admin, with the pages
                NAMED rather than positional. The desk is `dashboard` and the
                scanner is `verify-pass` under both, so an administrator who
                needs to scan reaches /admin/verify-pass without leaving the
                address they know. See festival/pass/routes.ts. */}
            {PORTAL_BASES.map((base) => (
              <Route key={base} path={base} element={<VolunteerPortal />}>
                {/* The bare base is not a page. Where it goes depends on who
                    is asking, and only the session knows that. */}
                <Route index element={<PortalHome />} />
                <Route path={PORTAL_PAGES.login} element={<LoginPage />} />
                <Route
                  path={PORTAL_PAGES.dashboard}
                  element={
                    <RequireVolunteer role="admin">
                      <AdminPage />
                    </RequireVolunteer>
                  }
                />
                <Route
                  path={PORTAL_PAGES.profile}
                  element={
                    <RequireVolunteer>
                      <ProfilePage />
                    </RequireVolunteer>
                  }
                />
                <Route
                  path={PORTAL_PAGES.verify}
                  element={
                    <RequireVolunteer>
                      <VerifyPage />
                    </RequireVolunteer>
                  }
                />
                {/* A scanned pass. Nested under the scanner rather than at
                    the base, so a token can never be confused with a page
                    name however the pages are renamed later. */}
                <Route
                  path={`${PORTAL_PAGES.verify}/:token`}
                  element={
                    <RequireVolunteer>
                      <VerifyPage />
                    </RequireVolunteer>
                  }
                />
              </Route>
            ))}
            {/* The portal's old addresses. THESE CANNOT BE DELETED: the first
                is printed, as a QR code, on every pass already issued, and a
                volunteer scanning one at the gate has no way to know the URL
                changed. Each subtree redirects, token and all. */}
            {PORTAL_LEGACY.map((base) => (
              <Route key={base}>
                <Route path={base} element={<LegacyPortalPath />} />
                <Route path={`${base}/*`} element={<LegacyPortalPath />} />
              </Route>
            ))}
            {/* The districts. Each is its own route with its own colour
                identity; see festival/pages/chapters.ts. Only Our Mission
                carries full content so far — the rest are premium
                placeholders that will be replaced one at a time. */}
            {DISTRICTS.map(({ path, Page }) => (
              <Route
                key={path}
                path={path}
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Page />
                  </Suspense>
                }
              />
            ))}
            {/* Where every "Support Us" button leads (SUPPORT_PATH). An
                evening page like the pass flow, not a district. */}
            <Route
              path="/donate"
              element={
                <Suspense fallback={<PageFallback />}>
                  <DonatePage />
                </Suspense>
              }
            />
            {/* Where the Partners page's "Partner With Us" leads. An evening
                page like Donate and the pass flow, not a district: it is a
                task, so it gets the transactional shell rather than the
                marble one. */}
            <Route
              path="/partner-interest"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PartnerInterestPage />
                </Suspense>
              }
            />
            {/* Reachable from the footer and from the booking consent, but
                deliberately not in the main navigation. */}
            <Route
              path="/terms"
              element={
                <Suspense fallback={<PageFallback />}>
                  <TermsPage />
                </Suspense>
              }
            />
            <Route
              path="/privacy"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PrivacyPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RootLayout>
      </BrowserRouter>
    </MotionConfig>
  );
}
