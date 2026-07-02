import { RootLayout } from '@/layouts/RootLayout';
import { SiteNav, SiteFooter } from '@/sections/SiteChrome';
import { Hero } from '@/sections/Hero';
import { Attractions } from '@/sections/Attractions';
import { Stats } from '@/sections/Stats';
import { Schedule } from '@/sections/Schedule';
import { Food } from '@/sections/Food';
import { Tickets } from '@/sections/Tickets';
import { Closing } from '@/sections/Closing';

export default function App() {
  return (
    <RootLayout chrome={false}>
      <SiteNav />
      <main>
        <Hero />
        <Attractions />
        <Stats />
        <Schedule />
        <Food />
        <Tickets />
        <Closing />
      </main>
      <SiteFooter />
    </RootLayout>
  );
}
