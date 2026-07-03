import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import { Missione } from './festival/Missione';
import { Finale } from './festival/Finale';
import { SiteFooter } from './festival/SiteFooter';

// The registration flow loads on demand: it never weighs down the landing page.
const GetPassesPage = lazy(() => import('./festival/getpasses/GetPassesPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
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
      {/* Dusk falls once: the page's single, deliberate theme shift. */}
      <div id="sera" className="dark bg-background text-foreground">
        <Missione />
        <Finale />
        <SiteFooter />
      </div>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RootLayout>
      </BrowserRouter>
    </MotionConfig>
  );
}
