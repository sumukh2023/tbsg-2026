import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { formatRupees, PRESETS } from './amounts';

/**
 * The donation amount: five preset plates and a custom field.
 *
 * `value` is the chosen amount in whole rupees, or null when nothing is
 * chosen yet. `custom` is the raw text of the custom field, kept separate so
 * a half-typed "1" does not read as a ₹1 donation and so clearing the field
 * does not silently fall back to a preset.
 *
 * Only positive integers are accepted, and that is enforced at the KEYSTROKE:
 * every non-digit is dropped as it is typed, so there is no state in which
 * the field holds "12.5" or "-4" or "1e9" and no error message is needed for
 * something the reader was never able to enter.
 */
export function AmountField({
  value,
  custom,
  onSelect,
  onCustom,
  error,
}: {
  value: number | null;
  custom: string;
  onSelect: (amount: number) => void;
  onCustom: (raw: string) => void;
  error?: string;
}) {
  const customRef = useRef<HTMLInputElement>(null);
  const errorId = 'donation-amount-error';
  const usingCustom = custom !== '';

  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="font-body text-sm font-medium text-foreground">
        Donation amount
      </legend>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PRESETS.map((amount, i) => {
          const selected = !usingCustom && value === amount;
          return (
            <motion.button
              key={amount}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: EASE.out }}
              onClick={() => {
                onCustom('');
                onSelect(amount);
              }}
              aria-pressed={selected}
              className={cn(
                'group relative overflow-hidden rounded-xl border px-4 py-5 text-left transition-[border-color,background-color,transform] duration-300 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'active:scale-[0.98]',
                selected
                  ? 'border-primary bg-primary/15'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
              )}
            >
              <span
                className={cn(
                  'block font-display text-2xl font-medium tracking-tight transition-colors duration-300 sm:text-3xl',
                  selected ? 'text-primary' : 'text-foreground'
                )}
              >
                {formatRupees(amount)}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full transition-all duration-300',
                  selected
                    ? 'scale-100 bg-primary text-primary-foreground opacity-100'
                    : 'scale-75 opacity-0'
                )}
              >
                <Check className="h-3 w-3" />
              </span>
            </motion.button>
          );
        })}

        {/* Sixth cell: the custom amount, sized and shaped like the plates so
            the row reads as one set of six rather than five and an oddity. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: PRESETS.length * 0.04, ease: EASE.out }}
          onClick={() => customRef.current?.focus()}
          className={cn(
            'relative overflow-hidden rounded-xl border px-4 py-5 transition-[border-color,background-color] duration-300',
            usingCustom
              ? 'border-primary bg-primary/15'
              : 'border-border focus-within:border-primary/60 hover:border-primary/50'
          )}
        >
          <label
            htmlFor="donation-custom"
            className="block font-body text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Custom amount
          </label>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              aria-hidden="true"
              className={cn(
                'font-display text-2xl font-medium transition-colors duration-300 sm:text-3xl',
                usingCustom ? 'text-primary' : 'text-muted-foreground/60'
              )}
            >
              ₹
            </span>
            <input
              ref={customRef}
              id="donation-custom"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={custom}
              onChange={(event) => {
                // Digits only, and never a leading zero, so the field can
                // only ever hold a positive integer.
                const digits = event.target.value
                  .replace(/\D/g, '')
                  .replace(/^0+/, '');
                onCustom(digits);
                if (digits) onSelect(Number(digits));
              }}
              placeholder="Other"
              aria-label="Custom donation amount in rupees"
              className={cn(
                'w-full min-w-0 bg-transparent font-display text-2xl font-medium tracking-tight outline-none transition-colors duration-300 placeholder:font-body placeholder:text-base placeholder:tracking-normal placeholder:text-muted-foreground/60 sm:text-3xl',
                usingCustom ? 'text-primary' : 'text-foreground'
              )}
            />
          </div>
        </motion.div>
      </div>

      <div className="min-h-5 pt-2">
        {error && (
          <p id={errorId} role="alert" className="font-body text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  );
}
