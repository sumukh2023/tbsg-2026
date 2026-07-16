/**
 * Tiny cross-component store: full-viewport film moments (the ground film's
 * caption passage) ask the floating Live Updates chrome to recede, then hand
 * the corner back the moment the scrub completes. Subscribed with
 * useSyncExternalStore, so it costs nothing while nothing changes.
 */
type Listener = () => void;

let receded = false;
const listeners = new Set<Listener>();

export function setLiveChromeReceded(next: boolean) {
  if (next === receded) return;
  receded = next;
  for (const listener of listeners) listener();
}

export function subscribeLiveChrome(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveChromeReceded(): boolean {
  return receded;
}
