import { ArrowRight } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { AnimatedGroup } from '@/components/motion/animated-group';
import { InfiniteSlider } from '@/components/motion/infinite-slider';
import { Magnetic } from '@/components/motion/magnetic';

const WORDS = ['Pizza', 'Gelato', 'Giochi', 'Musica', 'Arte', 'Famiglia', 'Festa', 'Dolci'];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b-2 border-foreground pt-32">
      <div aria-hidden className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rotate-12 rounded-3xl bg-sun/90" />
      <div aria-hidden className="pointer-events-none absolute -left-20 bottom-28 h-56 w-56 rounded-full bg-accent/20" />

      <div className="relative mx-auto max-w-6xl px-6">
        <AnimatedGroup preset="blur-slide" className="max-w-3xl">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-primary">
            Lincoln High · Saturday, October 17
          </p>
        </AnimatedGroup>

        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.15}
          className="mt-5 max-w-4xl font-display text-6xl font-bold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl"
        >
          A whole day of Italy, on the school quad.
        </TextEffect>

        <AnimatedGroup preset="blur-slide" className="mt-6 max-w-xl">
          <p className="text-lg leading-relaxed text-foreground/70">
            Street food, carnival games, fresh gelato, live music and an art
            piazza. One Saturday, the quad becomes a festival. Tutti benvenuti.
          </p>
        </AnimatedGroup>

        <AnimatedGroup preset="scale" className="mt-9 flex flex-wrap items-center gap-3 pb-16">
          <Magnetic intensity={0.35} range={120}>
            <a href="#tickets" className="group inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-primary px-7 py-3 font-display text-base font-bold text-primary-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5">
              Get tickets <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Magnetic>
          <a href="#schedule" className="inline-flex items-center rounded-full border-2 border-foreground bg-background px-7 py-3 font-display text-base font-bold transition-transform hover:-translate-y-0.5">
            See the schedule
          </a>
        </AnimatedGroup>
      </div>

      <div className="border-t-2 border-foreground bg-primary py-3 text-primary-foreground">
        <InfiniteSlider gap={48} speed={40} className="font-display text-xl font-bold uppercase tracking-wide">
          {WORDS.map((w) => (
            <span key={w} className="flex items-center gap-4">
              {w} <span className="text-sun">✶</span>
            </span>
          ))}
        </InfiniteSlider>
      </div>
    </section>
  );
}
