import { InView } from '@/components/motion/in-view';

const ITEMS = [
  { time: '10:00', title: 'Gates open, buongiorno!', body: 'Espresso and cornetti, live accordion, ribbon-cutting in the main piazza.' },
  { time: '12:00', title: 'Tarantella dance lesson', body: 'Everyone welcome on the main stage. Pizza alley fires its first margheritas.' },
  { time: '15:00', title: 'The great bake-off', body: 'Families go head to head in the cannoli and tiramisù contest, public tasting after.' },
  { time: '17:00', title: 'Prize draw & gelato hour', body: 'Cash in your game tickets, then cool down. All twelve flavours, half price.' },
  { time: '19:30', title: 'Lantern walk & finale', body: 'The band plays out the night as the quad fills with paper lanterns.' },
];

export function Schedule() {
  return (
    <section id="schedule" className="mx-auto max-w-4xl px-6 py-24">
      <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">The day, hour by hour</h2>
      <div className="mt-12 space-y-4">
        {ITEMS.map((it, i) => (
          <InView key={it.time} once variants={{ hidden: { opacity: 0, x: -24 }, visible: { opacity: 1, x: 0 } }}>
            <div className="flex items-start gap-6 rounded-2xl border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
              <span className="shrink-0 rounded-full bg-foreground px-3 py-1 font-display text-sm font-bold text-background">{it.time}</span>
              <div>
                <h3 className="font-display text-xl font-bold">{it.title}</h3>
                <p className="mt-1 leading-relaxed text-foreground/70">{it.body}</p>
              </div>
              <span className="ml-auto hidden font-display text-3xl font-bold text-muted-foreground/40 sm:block">{i + 1}</span>
            </div>
          </InView>
        ))}
      </div>
    </section>
  );
}
