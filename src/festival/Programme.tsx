import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { Grain, MarbleVeins } from './materials';

type Act = {
  time: string;
  title: string;
  body: string;
  surface: string;
  text: string;
  veined?: boolean;
};

const acts: Act[] = [
  {
    time: '10:00',
    title: 'Parata delle Regioni',
    body: 'Six regional troupes open the day with a costumed parade through the arcades.',
    surface: 'bg-secondary',
    text: 'text-secondary-foreground',
  },
  {
    time: '11:30',
    title: 'La Passerella',
    body: 'The senior batch walks a runway of Italian houses, styled and stitched in-house.',
    surface: 'bg-foreground',
    text: 'text-background',
  },
  {
    time: '13:00',
    title: 'Opera in Cortile',
    body: 'The chamber choir reworks Verdi and Puccini for a courtyard audience.',
    surface: 'bg-card',
    text: 'text-foreground',
    veined: true,
  },
  {
    time: '15:00',
    title: 'Tarantella',
    body: 'The troupe that made Ghoomar unforgettable at the first Flash learns the fastest dance in the south.',
    surface: 'bg-primary',
    text: 'text-primary-foreground',
  },
  {
    time: '16:30',
    title: 'Teatro di Strada',
    body: 'Living statues, commedia masks and street theatre roam between the stalls.',
    surface: 'bg-accent/15',
    text: 'text-foreground',
    veined: true,
  },
  {
    time: '18:00',
    title: 'Notte Italiana',
    body: 'The closing set: strings, lights and one last song over the piazza.',
    surface: 'bg-muted',
    text: 'text-foreground',
  },
];

export function Programme() {
  const track = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('article');
    const amount = card ? card.clientWidth + 20 : 360;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <section id="programma" className="py-24 md:py-36" aria-labelledby="programma-heading">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div className="max-w-2xl">
            <h2
              id="programma-heading"
              className="font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
            >
              Il Programma
            </h2>
            <p className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
              Student performances run all day. These are the six you plan
              around.
            </p>
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              onClick={() => scrollByCard(-1)}
              aria-label="Previous performances"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollByCard(1)}
              aria-label="Next performances"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>

      <div
        ref={track}
        className="mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))]"
      >
        {acts.map((act, i) => (
          <motion.article
            key={act.title}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px -5% 0px 0px' }}
            transition={{ duration: 0.7, delay: (i % 3) * 0.08, ease: EASE.out }}
            className={cn(
              'group relative flex h-[420px] w-[300px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-lg p-8 transition-transform duration-500 ease-out hover:-translate-y-1 md:h-[460px] md:w-[340px]',
              act.surface,
              act.text
            )}
          >
            {act.veined && (
              <MarbleVeins className="opacity-[0.14] transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
            )}
            <Grain />
            <p className="relative font-body text-sm font-medium tabular-nums tracking-[0.18em] opacity-70">
              {act.time}
            </p>
            <div className="relative">
              <h3 className="font-display text-4xl font-medium leading-[1.05] tracking-tight">
                {act.title}
              </h3>
              <p className="mt-4 font-body text-sm leading-relaxed opacity-80">
                {act.body}
              </p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
