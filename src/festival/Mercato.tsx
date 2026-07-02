import { motion } from 'framer-motion';
import { InfiniteSlider } from '@/components/motion/infinite-slider';
import { EASE } from '@/utils/motion';

const marqueeDishes = [
  'Cacio e Pepe',
  'Arancini',
  'Focaccia',
  'Gelato al Pistacchio',
  'Tiramisù',
  'Limonata',
  'Cannoli',
  'Affogato',
];

type Dish = { name: string; price: string; body: string };
type Course = { title: string; note: string; dishes: Dish[] };

const courses: Course[] = [
  {
    title: 'La Cucina',
    note: 'Hot, from the pans of the senior brigade',
    dishes: [
      { name: 'Cacio e Pepe', price: '₹180', body: 'Pecorino, cracked pepper, nothing else.' },
      { name: 'Arancini di Riso', price: '₹120', body: 'Saffron rice, fried to a shell.' },
      { name: 'Margherita al Forno', price: '₹160', body: 'Wood-fired, basil torn at the counter.' },
      { name: 'Polenta e Funghi', price: '₹140', body: 'Soft polenta under pan-dark mushrooms.' },
    ],
  },
  {
    title: 'Il Forno',
    note: 'Baked through the morning by Class X',
    dishes: [
      { name: 'Focaccia al Rosmarino', price: '₹90', body: 'Olive oil pooled in every dimple.' },
      { name: 'Grissini e Ricotta', price: '₹110', body: 'Hand-rolled sticks, whipped ricotta.' },
      { name: 'Cornetti alla Crema', price: '₹80', body: 'Custard-filled, dusted warm.' },
      { name: 'Pane e Pomodoro', price: '₹70', body: 'Grilled bread, crushed tomato, salt.' },
    ],
  },
  {
    title: 'La Gelateria',
    note: 'Churned in small batches all day',
    dishes: [
      { name: 'Gelato al Pistacchio', price: '₹100', body: 'The queue you will hear about.' },
      { name: 'Affogato', price: '₹120', body: 'Espresso poured over vanilla gelato.' },
      { name: 'Cannoli Siciliani', price: '₹110', body: 'Filled to order so the shell snaps.' },
      { name: 'Tiramisù', price: '₹130', body: 'Set overnight in the home-science lab.' },
    ],
  },
];

export function Mercato() {
  return (
    <section
      id="mercato"
      className="border-y border-border/70 bg-secondary/40 py-24 md:py-36"
      aria-labelledby="mercato-heading"
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
            id="mercato-heading"
            className="font-display text-5xl font-medium tracking-tight text-foreground md:text-7xl"
          >
            Il Mercato
          </h2>
          <p className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
            A food street of trattoria classics, priced for pocket money and
            cooked by students.
          </p>
        </motion.div>
      </div>

      {/* The one marquee on the page: the market calling out its wares. */}
      <div className="mask-fade-x mt-14 border-y border-border/60 py-6">
        <InfiniteSlider gap={0} speed={45} speedOnHover={18}>
          {marqueeDishes.map((dish) => (
            <span key={dish} className="flex items-center">
              <span className="whitespace-nowrap px-8 font-display text-3xl font-medium italic text-foreground/80 md:text-4xl">
                {dish}
              </span>
              <span aria-hidden="true" className="h-6 w-px bg-accent/50" />
            </span>
          ))}
        </InfiniteSlider>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl gap-14 px-6 md:grid-cols-3 md:gap-10 md:px-10">
        {courses.map((course, ci) => (
          <motion.div
            key={course.title}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.8, delay: ci * 0.12, ease: EASE.out }}
          >
            <h3 className="font-display text-3xl font-medium italic text-foreground">
              {course.title}
            </h3>
            <p className="mt-2 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {course.note}
            </p>
            <ul className="mt-8 space-y-7">
              {course.dishes.map((dish) => (
                <li key={dish.name} className="group">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-body text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                      {dish.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px min-w-4 flex-1 self-center bg-border transition-colors duration-300 group-hover:bg-accent/60"
                    />
                    <span className="font-body text-sm tabular-nums text-muted-foreground">
                      {dish.price}
                    </span>
                  </div>
                  <p className="mt-1.5 font-body text-sm leading-relaxed text-muted-foreground">
                    {dish.body}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
