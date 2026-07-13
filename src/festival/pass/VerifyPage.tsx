import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';

/** Extract a verification token from QR content (URL or bare token). */
function parseScannedToken(text: string): string | null {
  const fromUrl = text.match(/verify-pass\/([A-Za-z0-9_-]{20,64})/);
  if (fromUrl) return fromUrl[1];
  const bare = text.trim();
  return /^[A-Za-z0-9_-]{20,64}$/.test(bare) ? bare : null;
}

type BarcodeDetectorCtor = new (options: { formats: string[] }) => {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

/**
 * In-tab QR scanner for continuous gate operation: native BarcodeDetector
 * where the browser has it, jsQR frame-decoding everywhere else. Decoded
 * passes load in this same tab.
 */
function QrScanner({
  onToken,
  onClose,
}: {
  onToken: (token: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();

        const Detector = (
          window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
        ).BarcodeDetector;
        const detector = Detector
          ? new Detector({ formats: ['qr_code'] })
          : null;
        const jsqr = detector ? null : (await import('jsqr')).default;

        const tick = async () => {
          if (stopped) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2) {
            let raw = '';
            if (detector) {
              const codes = await detector.detect(v).catch(() => []);
              raw = codes[0]?.rawValue ?? '';
            } else if (jsqr) {
              const canvas = canvasRef.current;
              if (canvas) {
                canvas.width = v.videoWidth;
                canvas.height = v.videoHeight;
                const context = canvas.getContext('2d', {
                  willReadFrequently: true,
                });
                if (context && canvas.width > 0) {
                  context.drawImage(v, 0, 0);
                  const image = context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                  );
                  raw =
                    jsqr(image.data, image.width, image.height)?.data ?? '';
                }
              }
            }
            const token = raw ? parseScannedToken(raw) : null;
            if (token) {
              stopped = true;
              onToken(token);
              return;
            }
          }
          timer = window.setTimeout(tick, 160);
        };
        void tick();
      } catch {
        setError(
          'Camera unavailable. Allow camera access, or scan with your phone camera app instead.'
        );
      }
    };
    void start();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onToken]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      role="dialog"
      aria-modal="true"
      aria-label="Scan the next guest's QR code"
      className="fixed inset-0 z-50 bg-black/95"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
        <div
          aria-hidden="true"
          className="h-60 w-60 rounded-xl border-2 border-accent/80"
        />
        <p className="max-w-xs text-center font-body text-sm leading-relaxed text-white/90">
          {error || "Point the camera at the guest's QR code."}
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close scanner"
        className="absolute right-5 top-5 grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/30 text-white transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" />
      </button>
    </motion.div>
  );
}

const CODE_KEY = 'flash-verifier-code';

type Guest = {
  name: string;
  visitor_type: string;
  number_of_passes: number;
};

type VerifyState =
  | { phase: 'code'; message?: string }
  | { phase: 'checking' }
  | {
      phase: 'result';
      result: 'valid' | 'checked_in' | 'already_checked_in' | 'cancelled' | 'invalid';
      reference?: string;
      guest?: Guest;
      checkedInAt?: string | null;
      checkedInBy?: string | null;
    }
  // The service answered but cannot verify (config/database unavailable).
  | { phase: 'service'; message: string }
  // The browser could not reach the service at all.
  | { phase: 'network' };

const visitorLabels: Record<string, string> = {
  student: 'Student',
  parent: 'Parent',
  guest: 'Guest',
  alumni: 'Alumni',
  faculty: 'Faculty',
  other: 'Visitor',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Event-day verifier for gate volunteers. Every decision comes from the
 * server (/api/verify); this page only renders the result. A shared
 * access code (set server-side as VERIFIER_ACCESS_CODE) gates all actions
 * and is kept in sessionStorage for rapid repeated scanning.
 */
export default function VerifyPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState(() => {
    try {
      return sessionStorage.getItem(CODE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [codeInput, setCodeInput] = useState('');
  const [state, setState] = useState<VerifyState>(
    code ? { phase: 'checking' } : { phase: 'code' }
  );

  const call = useCallback(
    async (action: 'verify' | 'checkin', accessCode: string) => {
      setState({ phase: 'checking' });

      // Only a failed fetch is a network problem; everything else is an
      // answer from the service and gets its own state.
      let response: Response;
      try {
        response = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action, access_code: accessCode }),
        });
      } catch {
        setState({ phase: 'network' });
        return;
      }

      if (response.status === 401 || response.status === 403) {
        try {
          sessionStorage.removeItem(CODE_KEY);
        } catch {
          /* ignore */
        }
        setCode('');
        setState({ phase: 'code', message: 'Access code incorrect.' });
        return;
      }

      const data = await response.json().catch(() => null);

      // 200 valid/checked_in · 404 invalid · 409 already checked in ·
      // 410 cancelled: all carry a `result` the volunteer can act on.
      if (data?.result) {
        setState({
          phase: 'result',
          result: data.result,
          reference: data.pass?.reference,
          guest: data.pass?.guest,
          checkedInAt: data.pass?.checked_in_at,
          checkedInBy: data.pass?.checked_in_by,
        });
        return;
      }

      setState({
        phase: 'service',
        message:
          data?.error ??
          (response.status === 503
            ? 'Verification service unavailable.'
            : 'Unexpected server error.'),
      });
    },
    [token]
  );

  useEffect(() => {
    if (code) void call('verify', code);
  }, [code, call]);

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    const value = codeInput.trim();
    if (!value) return;
    try {
      sessionStorage.setItem(CODE_KEY, value);
    } catch {
      /* ignore */
    }
    setCode(value);
  };

  return (
    <div className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.12),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-8">
        <div className="flex items-center gap-3">
          <CarnivalMark className="h-6 w-auto text-foreground" />
          <p className="font-body text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Gate verification
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          {state.phase === 'code' && (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE.out }}
              onSubmit={submitCode}
              className="liquid-glass rounded-xl border border-white/10 p-6"
            >
              <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
                Volunteer access
              </h1>
              <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
                Enter the event-day access code to verify passes.
              </p>
              <input
                type="password"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                autoComplete="off"
                aria-label="Access code"
                className="mt-5 w-full rounded-lg border border-border bg-background/40 px-4 py-3.5 font-body text-base text-foreground outline-none transition-[border-color,box-shadow] duration-300 focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              />
              {state.message && (
                <p role="alert" className="mt-2 font-body text-sm text-destructive">
                  {state.message}
                </p>
              )}
              <button
                type="submit"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              >
                Continue
              </button>
            </motion.form>
          )}

          {state.phase === 'checking' && (
            <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
              />
              <p className="font-body text-sm text-muted-foreground">
                Verifying pass
              </p>
            </div>
          )}

          {(state.phase === 'network' || state.phase === 'service') && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Unable to verify
              </p>
              <p className="mt-3 font-display text-3xl font-medium text-foreground">
                {state.phase === 'network'
                  ? 'Network unavailable'
                  : 'Service unavailable'}
              </p>
              <p className="mx-auto mt-3 max-w-xs font-body text-sm leading-relaxed text-muted-foreground">
                {state.phase === 'network'
                  ? 'Your device could not reach the verification service. This is not a verdict on the pass; reconnect and try again.'
                  : `${state.message} This is not a verdict on the pass; alert the festival desk if it persists.`}
              </p>
              <button
                onClick={() => code && void call('verify', code)}
                className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
            </div>
          )}

          {state.phase === 'result' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE.out }}
              className={cn(
                'rounded-xl border p-6',
                state.result === 'valid' || state.result === 'checked_in'
                  ? 'border-accent/60 bg-card'
                  : state.result === 'already_checked_in'
                    ? 'border-border bg-card'
                    : 'border-destructive/60 bg-card'
              )}
              aria-live="polite"
            >
              <p
                className={cn(
                  'font-body text-xs font-semibold uppercase tracking-[0.18em]',
                  state.result === 'valid' || state.result === 'checked_in'
                    ? 'text-accent'
                    : state.result === 'already_checked_in'
                      ? 'text-muted-foreground'
                      : 'text-destructive'
                )}
              >
                {state.result === 'valid'
                  ? 'Valid pass'
                  : state.result === 'checked_in'
                    ? 'Checked in'
                    : state.result === 'already_checked_in'
                      ? 'Already checked in'
                      : 'Cancelled / invalid pass'}
              </p>

              {state.guest ? (
                <>
                  <p className="mt-4 font-display text-4xl font-medium leading-tight text-foreground">
                    {state.guest.name}
                  </p>
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border/60 pt-5">
                    <div>
                      <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                        Type
                      </dt>
                      <dd className="mt-1 font-body text-sm text-foreground">
                        {visitorLabels[state.guest.visitor_type] ??
                          state.guest.visitor_type}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                        Passes
                      </dt>
                      <dd className="mt-1 font-display text-2xl font-medium leading-none text-foreground">
                        {state.guest.number_of_passes}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-body text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                        Reference
                      </dt>
                      <dd className="mt-1 font-body text-sm tracking-wide text-foreground">
                        {state.reference}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
                  This code does not match any pass. Direct the guest to the
                  festival desk at the main gate.
                </p>
              )}

              {(state.result === 'already_checked_in' ||
                state.result === 'checked_in') &&
                state.checkedInAt && (
                  <p className="mt-4 rounded-lg border border-border/60 px-4 py-3 font-body text-sm text-muted-foreground">
                    {state.result === 'already_checked_in'
                      ? `First checked in at ${formatTime(state.checkedInAt)}`
                      : `Checked in at ${formatTime(state.checkedInAt)}`}
                    {state.checkedInBy ? ` by ${state.checkedInBy}` : ''}
                  </p>
                )}

              <div className="mt-6 flex flex-col gap-3">
                {state.result === 'valid' && (
                  <button
                    onClick={() => code && void call('checkin', code)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-4 font-body text-base font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    Check in {state.guest?.number_of_passes ?? ''}{' '}
                    {state.guest && state.guest.number_of_passes === 1
                      ? 'guest'
                      : 'guests'}
                  </button>
                )}
                <button
                  onClick={() => code && void call('verify', code)}
                  className="inline-flex w-full items-center justify-center rounded-full border border-border px-8 py-3 font-body text-sm text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Re-check this pass
                </button>
                {state.result === 'checked_in' && (
                  <button
                    onClick={() => setScanning(true)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-4 font-body text-base font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    Scan Next Guest
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {scanning && (
          <QrScanner
            onClose={() => setScanning(false)}
            onToken={(next) => {
              setScanning(false);
              if (next === token) {
                // Same code scanned again: re-check so the volunteer sees
                // the duplicate state immediately.
                if (code) void call('verify', code);
              } else {
                navigate(`/verify-pass/${next}`);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
