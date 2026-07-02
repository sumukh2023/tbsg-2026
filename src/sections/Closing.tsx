import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { Spotlight } from '@/components/motion/spotlight';
import { Magnetic } from '@/components/motion/magnetic';

export function Closing() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-120px' });
  return (
    <section ref={ref} className="group relative overflow-hidden border-t-2 border-foreground bg-primary text-primary-foreground">
      <Spotlight className="from-sun/40 via-sun/10 to-transparent" size={420} />
      <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
        <TextEffect as="h2" per="word" preset="fade-in-blur" trigger={inView} className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
          Andiamo. Save your spot.
        </TextEffect>
        <p className="mx-auto mt-5 max-w-lg text-lg text-primary-foreground/85">
          One day, all of Italy, right here at Lincoln High. Grab a wristband and skip the line on October 17.
        </p>
        <div className="mt-9 flex justify-center">
          <Magnetic intensity={0.4} range={140}>
            <a href="#tickets" className="group/btn inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-sun px-8 py-4 font-display text-lg font-bold text-sun-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5">
              Get tickets <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
            </a>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
