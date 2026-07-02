import { InfiniteSlider } from '@/components/motion/infinite-slider';

const A = ['Margherita pizza · $6', 'Arancini · $4', 'Focaccia · $3', 'Porchetta panino · $7', 'Espresso · $3'];
const B = ['Gelato, 2 scoops · $5', 'Cannoli siciliani · $4', 'Tiramisù cup · $4', 'Blood-orange sorbetto · $4', 'Italian soda · $3'];

function Pill({ text }: { text: string }) {
  return (
    <span className="whitespace-nowrap rounded-full border-2 border-foreground bg-card px-5 py-2 font-display text-lg font-semibold">
      {text}
    </span>
  );
}

export function Food() {
  return (
    <section id="food" className="border-y-2 border-foreground bg-sun py-20 text-sun-foreground">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Eat your way across Italy</h2>
        <p className="mt-3 max-w-xl text-lg font-semibold">
          Cooked on-site by the culinary club, families and a few visiting nonni. Tap your wristband to pay, no cash needed.
        </p>
      </div>
      <div className="mt-10 space-y-4">
        <InfiniteSlider gap={16} speed={30}>{A.map((t) => <Pill key={t} text={t} />)}</InfiniteSlider>
        <InfiniteSlider gap={16} speed={30} reverse>{B.map((t) => <Pill key={t} text={t} />)}</InfiniteSlider>
      </div>
    </section>
  );
}
