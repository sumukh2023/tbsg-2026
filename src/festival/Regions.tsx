import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TransitionPanel } from '@/components/motion/transition-panel';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { ArchFrame, Grain, MarbleVeins } from './materials';

type Region = {
  name: string;
  character: string;
  atFlash: string;
  field: string;
  fieldText: string;
  veined?: boolean;
  /** Optional token-based pattern layer: lagoon lines, pinstripes. */
  pattern?: string;
};

const regions: Region[] = [
  {
    name: 'Venezia',
    character: 'The lagoon city of masks and mirrors.',
    atFlash:
      'The art block becomes a canal-side mask workshop, ending in a mirrored hall of reflections.',
    field:
      'bg-[linear-gradient(180deg,hsl(var(--secondary)),hsl(var(--background)))]',
    fieldText: 'text-secondary-foreground',
    pattern:
      'bg-[repeating-linear-gradient(180deg,transparent,transparent_26px,hsl(var(--secondary-foreground)/0.08)_27px)]',
  },
  {
    name: 'Firenze',
    character: 'The renaissance in a single skyline.',
    atFlash:
      'The library courtyard hosts fresco painting, gilding tables and a live sketching studio.',
    field: 'bg-accent/15',
    fieldText: 'text-foreground',
    veined: true,
  },
  {
    name: 'Roma',
    character: 'The eternal city, seven hills deep.',
    atFlash:
      'The main field carries the forum: debates, trivia duels and a gladiatorial tug-of-war.',
    field: 'bg-muted',
    fieldText: 'text-foreground',
    veined: true,
  },
  {
    name: 'Milano',
    character: "Fashion's capital, cut with precision.",
    atFlash:
      'The auditorium foyer stages the runway, a design pop-up and a tailoring demonstration.',
    field: 'bg-foreground',
    fieldText: 'text-background',
    pattern:
      'bg-[repeating-linear-gradient(90deg,transparent,transparent_19px,hsl(var(--background)/0.07)_20px)]',
  },
  {
    name: 'Amalfi',
    character: 'Lemon groves stacked above the sea.',
    atFlash:
      'The junior wing pours granitas and limonata under striped awnings on the long verandah.',
    field:
      'bg-[radial-gradient(80%_80%_at_50%_0%,hsl(var(--accent)/0.25),hsl(var(--primary)/0.12))]',
    fieldText: 'text-foreground',
  },
  {
    name: 'Sicilia',
    character: 'An island of volcanoes and sweet things.',
    atFlash:
      'The canteen bakes cannoli all day and stages a traditional puppet theatre each hour.',
    field: 'bg-primary',
    fieldText: 'text-primary-foreground',
  },
];

export function Regions() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const dir =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!dir) return;
    event.preventDefault();
    const next = (active + dir + regions.length) % regions.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      id="regioni"
      className="border-y border-border/70 bg-card py-24 md:py-36"
      aria-labelledby="regioni-heading"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="max-w-2xl"
        >
          <h2
            id="regioni-heading"
            className="font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
          >
            Sei Regioni
          </h2>
          <p className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
            Six regions of Italy, each claiming a corner of the campus. Choose
            one.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-12 md:grid-cols-12 md:gap-8">
          {/* Region index */}
          <div
            role="tablist"
            aria-label="Regions of Italy at Flash"
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            className="flex flex-row gap-2 overflow-x-auto md:col-span-4 md:flex-col md:gap-0 md:overflow-visible"
          >
            {regions.map((r, i) => {
              const selected = i === active;
              return (
                <button
                  key={r.name}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`region-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="region-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'shrink-0 cursor-pointer whitespace-nowrap border-b border-border/60 px-2 py-3 text-left font-display text-2xl transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-full md:py-4 md:text-4xl',
                    selected
                      ? 'italic text-primary md:translate-x-2'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {r.name}
                </button>
              );
            })}
          </div>

          {/* Postcard */}
          <div
            id="region-panel"
            role="tabpanel"
            aria-labelledby={`region-tab-${active}`}
            className="md:col-span-8"
          >
            <TransitionPanel
              activeIndex={active}
              transition={{ duration: 0.55, ease: EASE.out }}
              variants={{
                enter: { opacity: 0, y: 24, scale: 0.985 },
                center: { opacity: 1, y: 0, scale: 1 },
                exit: { opacity: 0, y: -16, scale: 0.99 },
              }}
            >
              {regions.map((r) => (
                <div key={r.name} className="grid gap-8 sm:grid-cols-12">
                  <ArchFrame
                    className={cn(
                      'aspect-[3/4] max-h-[440px] w-full sm:col-span-6',
                      r.field
                    )}
                  >
                    {r.veined && <MarbleVeins className="opacity-20" />}
                    {r.pattern && (
                      <div
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute inset-0',
                          r.pattern
                        )}
                      />
                    )}
                    <Grain className="opacity-[0.07]" />
                    <div className="absolute inset-0 flex items-end justify-center pb-10">
                      <span
                        className={cn(
                          'font-display text-4xl font-medium italic leading-[1.1] md:text-5xl',
                          r.fieldText
                        )}
                      >
                        {r.name}
                      </span>
                    </div>
                  </ArchFrame>
                  <div className="flex flex-col justify-end sm:col-span-6">
                    <p className="font-display text-2xl italic leading-snug text-foreground md:text-3xl">
                      {r.character}
                    </p>
                    <div
                      aria-hidden="true"
                      className="mt-6 h-px w-12 bg-accent/70"
                    />
                    <p className="mt-6 font-body text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      At Flash
                    </p>
                    <p className="mt-3 max-w-sm font-body text-base leading-relaxed text-muted-foreground">
                      {r.atFlash}
                    </p>
                  </div>
                </div>
              ))}
            </TransitionPanel>
          </div>
        </div>
      </div>
    </section>
  );
}
