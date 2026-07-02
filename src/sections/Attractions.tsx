import { Pizza, IceCream2, Music4, Palette, Trophy, Ticket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { BorderTrail } from '@/components/motion/border-trail';
import { cn } from '@/utils/cn';

interface Block {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: 'primary' | 'accent' | 'sun' | 'paper';
  wide?: boolean;
  featured?: boolean;
}

const BLOCKS: Block[] = [
  { icon: Pizza, title: 'Street food from every region', body: 'Wood-fired pizza, arancini, focaccia and porchetta panini, cooked on-site by the culinary club and visiting nonni.', tone: 'primary', wide: true, featured: true },
  { icon: IceCream2, title: 'The gelato lab', body: 'Twelve flavours churned fresh all day.', tone: 'sun' },
  { icon: Trophy, title: 'Carnival games', body: 'Gondola ring toss, bocce and the Colosseum bounce arena.', tone: 'accent' },
  { icon: Music4, title: 'Live music & tarantella', body: 'Main-stage band plus a noon dance lesson for everyone.', tone: 'paper' },
  { icon: Palette, title: 'Art & mosaic piazza', body: 'Paint a Venetian mask, add a tile to the giant mosaic.', tone: 'accent' },
  { icon: Ticket, title: 'All for a good cause', body: 'Every dollar funds the school arts and exchange trips.', tone: 'sun' },
];

const TONE: Record<Block['tone'], string> = {
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-accent text-accent-foreground',
  sun: 'bg-sun text-sun-foreground',
  paper: 'bg-card text-foreground',
};

export function Attractions() {
  return (
    <section id="attractions" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        One day. All of Italy.
      </h2>
      <AnimatedGroup preset="blur-slide" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BLOCKS.map((b) => (
          <article
            key={b.title}
            className={cn(
              'relative overflow-hidden rounded-2xl border-2 border-foreground p-7 shadow-[5px_5px_0_0_hsl(var(--foreground))]',
              TONE[b.tone],
              b.wide && 'sm:col-span-2 lg:row-span-2 flex flex-col justify-between'
            )}
          >
            {b.featured && <BorderTrail className="bg-sun" size={90} />}
            <b.icon className={cn(b.wide ? 'h-12 w-12' : 'h-9 w-9')} strokeWidth={2.2} />
            <div className={cn(b.wide && 'mt-auto pt-10')}>
              <h3 className={cn('mt-5 font-display font-bold leading-tight', b.wide ? 'text-3xl' : 'text-xl')}>
                {b.title}
              </h3>
              <p className={cn('mt-2 leading-relaxed', b.tone === 'paper' ? 'text-foreground/70' : 'opacity-90', b.wide ? 'max-w-md text-base' : 'text-sm')}>
                {b.body}
              </p>
            </div>
          </article>
        ))}
      </AnimatedGroup>
    </section>
  );
}
