import { useMemo, type ReactNode } from 'react';
import { useLenis } from '@/hooks';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollProgress } from '@/components/ScrollProgress';
import { CursorGlow } from '@/components/CursorGlow';

export interface RootLayoutProps {
  children: ReactNode;
  /** Toggle the global chrome (nav, footer, progress bar, cursor glow). */
  chrome?: boolean;
}

/**
 * App shell: smooth scrolling + global chrome. Drop your page content as
 * children. Designed to be the single wrapper for any competition build.
 */
export function RootLayout({ children, chrome = true }: RootLayoutProps) {
  // Safari (macOS): Lenis's JS-driven wheel smoothing forces every scroll
  // frame through the main thread, which is exactly why Safari lagged while
  // iPhone — where touch scrolling stays native — felt smooth. Safari gets
  // its fast native scroll path; Chromium/Gecko keep the Lenis glide.
  // ("Version/… Safari" appears only in true Safari UAs, never Chrome/Edge.)
  const isSafari = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Version\/[\d.]+.*Safari/.test(navigator.userAgent),
    []
  );
  useLenis({ enabled: !isSafari });

  return (
    <div className="relative min-h-screen">
      {chrome && (
        <>
          <ScrollProgress />
          <CursorGlow />
          <Navbar />
        </>
      )}
      <main>{children}</main>
      {chrome && <Footer />}
    </div>
  );
}
