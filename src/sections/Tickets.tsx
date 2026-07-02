import { Check } from 'lucide-react';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { Magnetic } from '@/components/motion/magnetic';
import { cn } from '@/utils/cn';

const TIERS = [
  { name: 'Passeggiata', price: 'Free', cadence: 'entry', perks: ['Entry to the whole quad', 'Live music & main stage', 'Free for under-12s', 'Tap-to-pay at any stall'], cta: 'Reserve a spot', featured: false },
  { name: 'Festa wristband', price: '$15', cadence: 'per person', perks: ['Everything in Passeggiata', '$20 of food & game credit', 'One free gelato', 'Skip-the-line lane'], cta: 'Get a wristband', featured: true },
  { name: 'Famiglia pass', price: '$40', cadence: 'up to 4', perks: ['Four wristbands', '$60 of food & game credit', 'Reserved piazza table', 'A festa tote to take home'], cta: 'Bring the famiglia', featured: false },
];

export function Tickets() {
  return (
    <section id="tickets" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Choose your festa</h2>
      <p className="mt-3 max-w-xl text-lg text-foreground/70">Every wristband funds the school arts and exchange-trip programme.</p>
      <AnimatedGroup preset="blur-slide" className="mt-12 grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={cn(
              'flex flex-col rounded-2xl border-2 border-foreground p-7 shadow-[5px_5px_0_0_hsl(var(--foreground))]',
              t.featured ? 'bg-primary text-primary-foreground lg:-mt-4 lg:pb-10' : 'bg-card text-foreground'
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">{t.name}</h3>
              {t.featured && <span className="rounded-full bg-sun px-3 py-1 text-xs font-bold text-sun-foreground">Most popular</span>}
            </div>
            <p className="mt-4 font-display text-5xl font-bold">{t.price}<span className="ml-2 align-baseline text-base font-semibold opacity-70">{t.cadence}</span></p>
            <ul className="mt-6 space-y-3">
              {t.perks.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm font-medium">
                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', t.featured ? 'text-sun' : 'text-accent')} />
                  {p}
                </li>
              ))}
            </ul>
            <Magnetic intensity={0.3} range={100}>
              <button className={cn(
                'mt-8 w-full rounded-full border-2 border-foreground px-5 py-3 font-display font-bold transition-transform hover:-translate-y-0.5',
                t.featured ? 'bg-sun text-sun-foreground' : 'bg-foreground text-background'
              )}>
                {t.cta}
              </button>
            </Magnetic>
          </div>
        ))}
      </AnimatedGroup>
    </section>
  );
}
