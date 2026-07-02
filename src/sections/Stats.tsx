import { AnimatedNumber } from '@/components/motion/animated-number';
import { InView } from '@/components/motion/in-view';

const STATS = [
  { value: 30, suffix: '+', label: 'Food & game stalls' },
  { value: 12, suffix: '', label: 'Gelato flavours' },
  { value: 10, suffix: 'h', label: 'Of non-stop festa' },
  { value: 500, suffix: '+', label: 'Neighbours last year' },
];

export function Stats() {
  return (
    <section className="border-y-2 border-foreground bg-accent text-accent-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-6 py-16 md:grid-cols-4">
        {STATS.map((s) => (
          <InView key={s.label} once>
            <div className="text-center">
              <p className="flex items-baseline justify-center font-display text-5xl font-bold sm:text-6xl">
                <AnimatedNumber value={s.value} />
                <span>{s.suffix}</span>
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide opacity-80">
                {s.label}
              </p>
            </div>
          </InView>
        ))}
      </div>
    </section>
  );
}
