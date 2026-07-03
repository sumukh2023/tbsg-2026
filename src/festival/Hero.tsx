import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4';

const navLinks = [
  { label: 'La Piazza', href: '#piazza' },
  { label: 'Regioni', href: '#regioni' },
  { label: 'Programma', href: '#programma' },
  { label: 'Mercato', href: '#mercato' },
  { label: 'La Missione', href: '#missione' },
];

/** Fades children in after `delay` ms; duration is configurable. */
function FadeIn({
  children,
  delay = 0,
  duration = 1000,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-opacity ${visible ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Splits text by \n into lines, each line into characters. Every character
 * slides in from the left (translateX(-18px)) with a 30ms stagger.
 */
function AnimatedHeading({
  text,
  className,
  style,
  initialDelay = 200,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  initialDelay?: number;
}) {
  const [started, setStarted] = useState(false);
  const charDelay = 30;
  const lines = text.split('\n');

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), initialDelay);
    return () => clearTimeout(timer);
  }, [initialDelay]);

  let charsBefore = 0;
  return (
    <h1 className={className} style={style} aria-label={text.replace('\n', ' ')}>
      {lines.map((line, lineIndex) => {
        const lineStart = charsBefore;
        charsBefore += line.length;
        return (
          <span key={lineIndex} className="block" aria-hidden="true">
            {line.split('').map((char, charIndex) => (
              <span
                key={charIndex}
                className="inline-block"
                style={{
                  opacity: started ? 1 : 0,
                  transform: started ? 'translateX(0)' : 'translateX(-18px)',
                  transitionProperty: 'opacity, transform',
                  transitionDuration: '500ms',
                  transitionDelay: `${(lineStart + charIndex) * charDelay}ms`,
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </span>
        );
      })}
    </h1>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-black text-white"
    >
      {/* Raw background video: no overlay, no dimming (black bg is only the
          load/failure fallback underneath, never on top). */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 pt-6 md:px-12 lg:px-16">
        {/* Navbar */}
        <nav
          className="liquid-glass flex items-center justify-between rounded-xl px-4 py-2"
          aria-label="Main"
        >
          <a href="#top" className="text-2xl font-semibold tracking-tight">
            Flash @ Brigade
          </a>
          <ul className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm transition-colors hover:text-gray-300"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#finale"
            className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100"
          >
            Get passes
          </a>
        </nav>

        {/* Hero content, pushed to the bottom of the viewport */}
        <div className="flex flex-1 flex-col justify-end pb-12 lg:pb-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-end">
            {/* Left column */}
            <div>
              <FadeIn delay={200} duration={1000}>
                <p className="mb-4 text-xs uppercase tracking-[0.28em] text-gray-300 md:text-sm">
                  The Brigade School @ Malleswaram · 14 November 2026
                </p>
              </FadeIn>

              <AnimatedHeading
                text={'Namma Mia\nCarpisa'}
                className="mb-4 text-4xl font-normal md:text-5xl lg:text-6xl xl:text-7xl"
                style={{ letterSpacing: '-0.04em' }}
                initialDelay={200}
              />

              <FadeIn delay={800} duration={1000}>
                <p className="mb-5 text-base text-gray-300 md:text-lg">
                  Our campus becomes an Italian piazza for one day, raising
                  funds for children's education and healthcare.
                </p>
              </FadeIn>

              <FadeIn delay={1200} duration={1000}>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="#finale"
                    className="rounded-lg bg-white px-8 py-3 font-medium text-black transition-colors hover:bg-gray-100"
                  >
                    Get passes
                  </a>
                  <a
                    href="#piazza"
                    className="liquid-glass rounded-lg border border-white/20 px-8 py-3 font-medium text-white transition-colors hover:bg-white hover:text-black"
                  >
                    Explore Now
                  </a>
                </div>
              </FadeIn>
            </div>

            {/* Right column tag */}
            <div className="mt-8 flex items-end justify-start lg:mt-0 lg:justify-end">
              <FadeIn delay={1400} duration={1000}>
                <div className="liquid-glass rounded-xl border border-white/20 px-6 py-3">
                  <p className="text-lg font-light md:text-xl lg:text-2xl">
                    Musica. Cucina. Moda.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
