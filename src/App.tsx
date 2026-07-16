import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { RootLayout } from '@/layouts/RootLayout';
import { SiteNav } from './festival/SiteNav';
import { Hero } from './festival/Hero';
import { Overture } from './festival/Overture';
import { PiazzaBento } from './festival/PiazzaBento';
import { Regions } from './festival/Regions';
import { Programme } from './festival/Programme';
import { Mercato } from './festival/Mercato';
import { Voci } from './festival/Voci';
import { Giorno } from './festival/Giorno';
import { Domande } from './festival/Domande';
import { GroundFilm } from './festival/GroundFilm';
import { Missione } from './festival/Missione';
import { Finale } from './festival/Finale';
import { SiteFooter } from './festival/SiteFooter';
import { LiveUpdates } from './festival/live/LiveUpdates';

// Secondary experiences load on demand: they never weigh down the landing page.
const GetPassesPage = lazy(() => import('./festival/getpasses/GetPassesPage'));
const PassPage = lazy(() => import('./festival/pass/PassPage'));
const VerifyPage = lazy(() => import('./festival/pass/VerifyPage'));

/**
 * The pass experiences are evening-dark pages while the document root keeps
 * the marble day tokens. During rubber-band overscroll Safari and Chrome
 * paint the canvas (html) background beyond the page edges — on a dark page
 * that reads as a white strip. Match the canvas to the route's chapter so
 * overscroll always reveals the page's own colour.
 */
const DARK_ROUTES = /^\/(get-passes|pass|verify-pass)(\/|$)/;

function CanvasBackground() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    // The evening chapter's --background token (see globals.css .dark).
    root.style.backgroundColor = DARK_ROUTES.test(pathname)
      ? 'hsl(160 22% 8%)'
      : '';
    return () => {
      root.style.backgroundColor = '';
    };
  }, [pathname]);
  return null;
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
      <Overture />
      <PiazzaBento />
      <Regions />
      <Programme />
      <Mercato />
      <Voci />
      <Giorno />
      <Domande />
      {/* The ground itself, scrubbed by scroll: the last daylight passage. */}
      <GroundFilm />
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
            <Route
              path="/verify-pass/:token"
              element={
                <Suspense fallback={<PageFallback />}>
                  <VerifyPage />
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
