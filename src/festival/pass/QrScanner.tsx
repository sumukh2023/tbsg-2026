import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Extract a verification token from QR content (URL or bare token).
 *
 * ALL THREE PORTAL PREFIXES, and the old one is not optional: passes printed
 * before the portal was renamed carry `/verify-pass/<token>` in their QR
 * code, and those are the passes a volunteer will be scanning at the gate.
 * A scanner that only understood the new address would reject them.
 */
function parseScannedToken(text: string): string | null {
  const fromUrl = text.match(
    /(?:verify-pass|volunteers?|admin)\/([A-Za-z0-9_-]{20,64})/
  );
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
  const [status, setStatus] = useState<
    'starting' | 'active' | 'denied' | 'unsupported' | 'error'
  >('starting');
  // Bumping this re-runs the effect: the retry path after a camera failure.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('starting');

    const start = async () => {
      try {
        // Permission is requested here, only once the volunteer has chosen
        // to scan; the rear camera is preferred for gate work.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || stopped) {
          stream?.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (!stopped) setStatus('active');

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
                  raw = jsqr(image.data, image.width, image.height)?.data ?? '';
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
      } catch (cause) {
        if (stopped) return;
        const name = (cause as { name?: string } | null)?.name;
        setStatus(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : 'error'
        );
      }
    };
    void start();

    // Closing or navigating away always releases the camera: the cleanup
    // stops every track so no light stays on in the background.
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onToken, attempt]);

  const failed =
    status === 'denied' || status === 'unsupported' || status === 'error';
  const failureMessage =
    status === 'unsupported'
      ? 'This browser cannot open the camera. Use Safari or Chrome, or scan the QR code with your phone camera app.'
      : status === 'denied'
        ? 'Camera permission was declined. Allow camera access for this site, then retry.'
        : 'The camera could not start. Close other apps using the camera, then retry.';

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
        {!failed && (
          <div
            aria-hidden="true"
            className="h-60 w-60 max-w-[70vw] rounded-xl border-2 border-accent/80"
          />
        )}
        <p
          aria-live="polite"
          className="max-w-xs text-center font-body text-sm leading-relaxed text-white/90"
        >
          {failed
            ? failureMessage
            : status === 'starting'
              ? 'Starting camera…'
              : "Point the camera at the guest's QR code."}
        </p>
        {failed && status !== 'unsupported' && (
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-8 py-3 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
          >
            Retry camera
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Close scanner"
        className="absolute right-[max(1.25rem,env(safe-area-inset-right))] top-[max(1.25rem,env(safe-area-inset-top))] grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/30 text-white transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" />
      </button>
    </motion.div>
  );
}

export { QrScanner };
