import { motion } from 'framer-motion';
import { BorderTrail } from '@/components/motion/border-trail';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { Grain, MarbleVeins } from './materials';

type Cell = {
  title: string;
  body: string;
  span: string;
  surface: 'terracotta' | 'olive' | 'marble' | 'ink' | 'gold' | 'plaster';
  featured?: boolean;
};

const cells: Cell[] = [
  {
    title: 'La Passerella',
    body: 'A student-designed runway of Italian fashion, from Milanese tailoring to Sicilian colour.',
    span: 'md:col-span-7',
    surface: 'terracotta',
  },
  {
    title: "L'Orchestra",
    body: 'Strings, choirs and street musicians score the day from balconies and corners.',
    span: 'md:col-span-5',
    surface: 'olive',
  },
  {
    title: 'Le Botteghe',
    body: 'Artisan stalls of student craft: paper, leather, ceramics and Venetian masks.',
    span: 'md:col-span-5',
    surface: 'marble',
  },
  {
    title: 'La Cucina',
    body: 'A food street of trattoria classics cooked and served by student brigades.',
    span: 'md:col-span-7',
    surface: 'ink',
  },
  {
    title: 'Il Palco',
    body: 'The main stage: theatre, opera medleys and the evening finale under the lights.',
    span: 'md:col-span-8',
    surface: 'gold',
    featured: true,
  },
  {
    title: 'I Giochi',
    body: 'Carnival games in the little courtyard, from bocce lanes to a masked treasure hunt.',
    span: 'md:col-span-4',
    surface: 'plaster',
  },
];

const surfaceClasses: Record<Cell['surface'], string> = {
  terracotta: 'bg-primary text-primary-foreground',
  olive: 'bg-secondary text-secondary-foreground',
  marble: 'bg-card text-card-foreground',
  ink: 'bg-foreground text-background',
  gold: 'border border-accent/40 bg-accent/10 text-foreground',
  plaster: 'bg-muted text-foreground',
};

function BentoCell({ cell, index }: { cell: Cell; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.8, delay: (index % 2) * 0.12, ease: EASE.out }}
      className={cn(
        'group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-lg p-8 transition-transform duration-500 ease-out hover:-translate-y-1 md:min-h-[340px] md:p-10',
        cell.span,
        surfaceClasses[cell.surface]
      )}
    >
      {cell.featured && (
        <BorderTrail
          className="bg-accent/80 blur-[2px]"
          size={80}
          transition={{ repeat: Infinity, duration: 9, ease: 'linear' }}
        />
      )}
      {(cell.surface === 'marble' || cell.surface === 'terracotta') && (
        <MarbleVeins className="opacity-[0.12] transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
      )}
      <Grain />

      <h3 className="relative font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
        {cell.title}
      </h3>
      <p
        className={cn(
          'relative mt-4 max-w-md font-body text-sm leading-relaxed',
          cell.surface === 'terracotta' || cell.surface === 'ink'
            ? 'opacity-80'
            : 'text-muted-foreground'
        )}
      >
        {cell.body}
      </p>
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
    </motion.article>
  );
}

export function PiazzaBento() {
  return (
    <section id="piazza" className="py-24 md:py-36" aria-labelledby="piazza-heading">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="max-w-2xl"
        >
          <h2
            id="piazza-heading"
            className="font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
          >
            La Piazza
          </h2>
          <p className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
            Six worlds inside one campus, each built and staffed by a student
            guild.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
          {cells.map((cell, i) => (
            <BentoCell key={cell.title} cell={cell} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
