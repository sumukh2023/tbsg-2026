import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Tag, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { describePromo, type PromoState } from './promo';

/**
 * The promo code field on the order summary.
 *
 * ONE REQUEST PER PRESS, and none per keystroke. There is no "as you type"
 * validation here on purpose: a code is eight characters, every partial
 * spelling of it is invalid, and checking each one would be seven requests
 * telling the visitor they were wrong while they were still typing.
 *
 * APPLYING THE SAME CODE TWICE IS NOT POSSIBLE, and it is prevented by the
 * field rather than by an error: once a code is applied the input is gone,
 * replaced by the applied row and a Remove control. There is nothing to press
 * Apply on, so there is no second application to refuse.
 *
 * NO HOVER-ONLY BEHAVIOUR. Remove is a real button with a visible label, not
 * something that appears under a cursor: on a phone there is no cursor, and a
 * control that only exists on hover does not exist at all.
 */
export function PromoField({
  state,
  value,
  onChange,
  onApply,
  onRemove,
}: {
  state: PromoState;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const busy = state.phase === 'checking';
  const applied = state.phase === 'applied' ? state.promo : null;

  return (
    <div className="mt-5 border-t border-border/60 pt-5">
      <AnimatePresence mode="wait" initial={false}>
        {applied ? (
          <motion.div
            key="applied"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE.out }}
            className="flex items-center justify-between gap-3 rounded-xl border border-accent/45 bg-accent/[0.07] px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {/* The tick draws itself in. One transform and one opacity, so
                  it is a compositor animation on every engine. */}
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.05, ease: EASE.out }}
                className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-accent-foreground"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              </motion.span>
              <span className="min-w-0 truncate font-body text-sm font-medium text-foreground">
                {describePromo(applied)}
              </span>
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="flex-none rounded-full px-3 py-1.5 font-body text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-1.5">
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                Remove
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="entry"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE.out }}
          >
            <label
              htmlFor={id}
              className="flex items-center gap-2 font-body text-xs uppercase tracking-[0.14em] text-muted-foreground"
            >
              <Tag aria-hidden="true" className="h-3.5 w-3.5" />
              Promo code
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id={id}
                type="text"
                value={value}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
                aria-invalid={state.phase === 'error'}
                aria-describedby={state.phase === 'error' ? `${id}-error` : undefined}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  /* Enter applies the code and does NOT submit the booking.
                     This field sits inside the booking form, so without this
                     a visitor pressing Enter after typing a code would
                     confirm the whole reservation. */
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (value.trim() && !busy) onApply();
                  }
                }}
                placeholder="FLASH26"
                className={cn(
                  'min-w-0 flex-1 rounded-xl border bg-background/70 px-4 py-3 font-body text-sm uppercase tracking-[0.08em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:outline-none',
                  state.phase === 'error'
                    ? 'border-destructive/70'
                    : focused
                      ? 'border-accent'
                      : 'border-border'
                )}
              />
              <button
                type="button"
                onClick={onApply}
                disabled={busy || !value.trim()}
                className="inline-flex min-h-[2.875rem] flex-none items-center gap-2 rounded-xl border border-border bg-secondary/60 px-5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy && (
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground/25 border-t-foreground"
                  />
                )}
                {busy ? 'Checking' : 'Apply'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {state.phase === 'error' && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            className="overflow-hidden font-body text-xs leading-relaxed text-destructive"
          >
            <span className="mt-2.5 block">{state.message}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
