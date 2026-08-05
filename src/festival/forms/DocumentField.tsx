import { useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Paperclip, X } from 'lucide-react';
import { EASE } from '@/utils/motion';
import { ACCEPTED_EXTENSIONS, checkDocument, humanSize } from './documentRules';

/**
 * One optional supporting document on the sponsor Expression of Interest.
 *
 * THE FILE IS NOT SENT WHEN IT IS CHOSEN. It goes up as part of submitting
 * the form, which is why there is no progress bar in here: by the time bytes
 * are moving this control has been replaced by the sending screen, and a
 * progress bar nobody can see is worse than none. Choosing a document and
 * then thinking better of the whole approach leaves nothing in the bucket.
 */
export function DocumentField({
  file,
  onChange,
  error,
  onError,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  onError: (message: string | null) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (chosen: File | null) => {
    if (!chosen) return;
    const problem = checkDocument(chosen);
    if (problem) {
      onError(problem);
      onChange(null);
      return;
    }
    onError(null);
    onChange(chosen);
  };

  const clear = () => {
    onChange(null);
    onError(null);
    // Without this, choosing the same file again after removing it fires no
    // change event at all and the control appears to be broken.
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
        onChange={(event) => take(event.target.files?.[0] ?? null)}
        className="sr-only"
      />

      <AnimatePresence mode="wait" initial={false}>
        {file ? (
          <motion.div
            key="chosen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-4"
          >
            <FileText
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-medium text-foreground">
                {file.name}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {humanSize(file.size)} · sent when you submit the form
              </p>
            </div>
            <button
              type="button"
              onClick={clear}
              aria-label={`Remove ${file.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground/70 transition-colors hover:bg-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.label
            key="empty"
            htmlFor={inputId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE.out }}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              take(event.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed p-6 text-center transition-colors duration-200 focus-within:ring-2 focus-within:ring-ring ${
              over
                ? 'border-accent bg-accent/[0.06]'
                : 'border-border/70 bg-background/30 hover:border-accent/60'
            }`}
          >
            <Paperclip aria-hidden="true" className="h-5 w-5 text-accent" />
            <span className="mt-3 font-body text-sm font-medium text-foreground">
              Attach a document
            </span>
            <span className="mt-1.5 font-body text-xs leading-relaxed text-muted-foreground">
              PDF, Word or PowerPoint, up to 10 MB. Drag one here or click to
              choose.
            </span>
          </motion.label>
        )}
      </AnimatePresence>

      {error && (
        <p
          role="alert"
          className="mt-2.5 font-body text-xs leading-relaxed text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
