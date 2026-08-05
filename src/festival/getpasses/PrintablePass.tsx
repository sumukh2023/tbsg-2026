import { Printer } from 'lucide-react';
import { PassCard, type PassData } from './PassCard';

/**
 * The pass, plus the button that puts it on paper.
 *
 * Both surfaces that show a pass use this rather than `PassCard` directly —
 * the confirmation at the end of Get Passes, and `/pass/:token` after a
 * retrieval — so the print behaviour cannot exist on one and not the other.
 *
 * `data-print="pass"` is the whole mechanism. `window.print()` on its own
 * would send the ENTIRE page to the printer: the navigation, the footer, the
 * Live Updates capsule, and on `/pass` a near-black evening background that
 * would arrive as a sheet of wet ink with a QR code somewhere in it. The
 * print rules in globals.css hang off that attribute and reduce the page to
 * this card, on white.
 *
 * Deliberately NOT inside `PassCard`: a button that appears on the printed
 * ticket is the thing everyone forgets to hide.
 */
export function PrintablePass({
  pass,
  className,
}: {
  pass: PassData;
  className?: string;
}) {
  return (
    <div className={className}>
      <div data-print="pass">
        <PassCard pass={pass} />
      </div>

      <div className="mt-5 flex justify-center print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 font-body text-sm font-medium text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Printer aria-hidden="true" className="h-4 w-4" />
          Print pass
        </button>
      </div>
    </div>
  );
}
