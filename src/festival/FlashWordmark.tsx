import { cn } from '@/utils/cn';

/**
 * The stylised FLASH @ BRIGADE lockup — letter-spaced small caps with the
 * ampersand-in-terracotta that has always sat under the seagull in the
 * footer.
 *
 * Extracted so the footer and the page heroes render the SAME mark rather
 * than two hand-typed copies that drift apart. `@` takes the primary colour,
 * which means it re-tints itself per district without this component knowing
 * districts exist.
 */
export function FlashWordmark({
  className,
  year,
}: {
  className?: string;
  /** Appended in the muted tone, for pages that want the edition. */
  year?: string;
}) {
  return (
    <p
      className={cn(
        'font-body text-xs font-semibold uppercase tracking-[0.22em]',
        className
      )}
    >
      Flash <span className="text-primary">@</span> Brigade
      {year && <span className="text-muted-foreground"> {year}</span>}
    </p>
  );
}
