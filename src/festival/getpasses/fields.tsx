import { type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Shared premium form primitives for the Get Passes flow: floating labels,
 * animated focus states, glass-friendly surfaces. Pure CSS floating labels
 * (placeholder-shown trick) so they work without JS state per field.
 */

function FieldShell({
  error,
  hint,
  errorId,
  children,
}: {
  error?: string;
  hint?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div>
      {children}
      <div className="min-h-5 pt-1.5">
        {error ? (
          <p id={errorId} className="font-body text-xs text-destructive">
            {error}
          </p>
        ) : hint ? (
          <p className="font-body text-xs text-muted-foreground/70">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

const inputBase =
  'peer w-full rounded-lg border bg-background/40 px-4 pb-2.5 pt-6 font-body text-base text-foreground outline-none transition-[border-color,box-shadow] duration-300 placeholder-transparent focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]';

const labelBase =
  'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-body text-base text-muted-foreground transition-all duration-300 ' +
  'peer-focus:top-3.5 peer-focus:text-xs peer-focus:tracking-wide peer-focus:text-primary ' +
  'peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:tracking-wide';

export function FloatingInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  autoComplete?: string;
  maxLength?: number;
}) {
  const errorId = `${id}-error`;
  return (
    <FieldShell error={error} hint={hint} errorId={errorId}>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            inputBase,
            error ? 'border-destructive/70' : 'border-border'
          )}
        />
        <label htmlFor={id} className={labelBase}>
          {label}
        </label>
      </div>
    </FieldShell>
  );
}

export function FloatingTextarea({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  rows = 3,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
}) {
  const errorId = `${id}-error`;
  return (
    <FieldShell error={error} hint={hint} errorId={errorId}>
      <div className="relative">
        <textarea
          id={id}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            inputBase,
            'resize-none',
            error ? 'border-destructive/70' : 'border-border'
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            labelBase,
            'top-7 peer-focus:top-3.5 peer-[:not(:placeholder-shown)]:top-3.5'
          )}
        >
          {label}
        </label>
      </div>
    </FieldShell>
  );
}

export function RadioPills({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="font-body text-sm font-medium text-foreground">
        {legend}
      </legend>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'block rounded-lg border px-3 py-3 text-center font-body text-sm transition-all duration-300',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                value === option.value
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
      <div className="min-h-5 pt-1.5">
        {error && (
          <p id={errorId} className="font-body text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  );
}

export function PassStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div>
      <p id="passes-label" className="font-body text-sm font-medium text-foreground">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-6">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label="One pass fewer"
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          role="spinbutton"
          tabIndex={0}
          aria-labelledby="passes-label"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              event.preventDefault();
              onChange(clamp(value + 1));
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              event.preventDefault();
              onChange(clamp(value - 1));
            }
          }}
          className="min-w-16 rounded-lg text-center font-display text-5xl font-medium tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label="One pass more"
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 font-body text-xs text-muted-foreground/70">
        Up to {max} passes per registration
      </p>
    </div>
  );
}
