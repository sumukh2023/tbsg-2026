import { Magnetic } from '@/components/motion/magnetic';

const NAV = [
  { label: 'Attractions', href: '#attractions' },
  { label: 'Schedule', href: '#schedule' },
  { label: 'Food', href: '#food' },
  { label: 'Tickets', href: '#tickets' },
];

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4">
      <nav className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-full border-2 border-foreground bg-background/90 px-5 py-2.5 backdrop-blur">
        <a href="#top" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">F</span>
          Festa Italiana
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="rounded-full px-3 py-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <Magnetic intensity={0.4} range={90}>
          <a href="#tickets" className="rounded-full border-2 border-foreground bg-sun px-4 py-1.5 text-sm font-bold text-sun-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5">
            Get tickets
          </a>
        </Magnetic>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-foreground bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm font-semibold sm:flex-row">
        <p>Festa Italiana · Lincoln High School PTA</p>
        <p className="text-foreground/60">Saturday, October 17 · 10am to 8pm · School Quad</p>
      </div>
    </footer>
  );
}
