import { MotionConfig } from 'framer-motion';
import { RootLayout } from '@/layouts/RootLayout';
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

/**
 * Flash @ Brigade 2026 · "Namma Mia Carpisa".
 * One continuous story: a marble day in the piazza that ends, deliberately,
 * in one evening chapter (the `.dark` wrapper) where the fundraising mission
 * and the goodbye live. Design decisions are recorded in .design/brief.md.
 */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RootLayout chrome={false}>
        <a
          href="#piazza"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
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
      </RootLayout>
    </MotionConfig>
  );
}
