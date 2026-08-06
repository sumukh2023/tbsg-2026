import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Tilt } from '@/components/motion/tilt';
import { cn } from '@/utils/cn';
import { CarnivalMark } from '../CarnivalMark';
import { PORTAL_CANONICAL } from '../pass/routes';

export type PassData = {
  token: string;
  reference: string;
  status?: 'valid' | 'checked_in' | 'cancelled';
  guestName: string;
  visitorType: string;
  numberOfPasses: number;
  /** School roll, present on student passes only. */
  usn?: string | null;
  studentClass?: string | null;
  section?: string | null;
};

const visitorLabels: Record<string, string> = {
  student: 'Student',
  parent: 'Parent',
  other: 'Visitor',
};

/**
 * The digital event pass. The QR encodes only the verification URL with
 * the opaque token; it sits on a pure-white field with a full quiet zone
 * and nothing layered over it, so it scans reliably in gate light.
 */
export function PassCard({ pass }: { pass: PassData }) {
  const [qr, setQr] = useState<string>('');

  useEffect(() => {
    const url = `${window.location.origin}${PORTAL_CANONICAL}/${pass.token}`;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [pass.token]);

  const cancelled = pass.status === 'cancelled';
  const checkedIn = pass.status === 'checked_in';

  return (
    <Tilt rotationFactor={3} springOptions={{ stiffness: 120, damping: 18 }}>
      <article
        aria-label={`Event pass ${pass.reference}`}
        className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-elevated"
      >
        {/* Gold thread along the top edge: the ticket's trim. */}
        <div aria-hidden="true" className="h-px w-full bg-accent/70" />

        <div className="px-7 pb-6 pt-6">
          <div className="flex items-center justify-between">
            <CarnivalMark className="h-6 w-auto text-foreground" />
            <p className="font-body text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Flash <span className="text-primary">@</span> Brigade
            </p>
          </div>

          <p className="mt-6 font-display text-3xl font-medium italic leading-tight text-foreground">
            Namma Mia Carpisa
          </p>
          <p className="mt-1.5 font-body text-xs text-muted-foreground">
            14 November 2026 · The Brigade School @ Malleswaram
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-2">
              <dt className="font-body text-2xs uppercase tracking-[0.16em] text-muted-foreground">
                Guest
              </dt>
              <dd className="mt-1 font-display text-2xl font-medium leading-tight text-foreground">
                {pass.guestName}
              </dd>
            </div>
            <div>
              <dt className="font-body text-2xs uppercase tracking-[0.16em] text-muted-foreground">
                Visitor type
              </dt>
              <dd className="mt-1 font-body text-sm text-foreground">
                {visitorLabels[pass.visitorType] ?? pass.visitorType}
              </dd>
            </div>
            <div>
              <dt className="font-body text-2xs uppercase tracking-[0.16em] text-muted-foreground">
                Passes
              </dt>
              <dd className="mt-1 font-body text-sm tabular-nums text-foreground">
                {pass.numberOfPasses}
              </dd>
            </div>
            {/* Students only. A PARENT's pass carries their child's roll in
                the record, but the ticket belongs to the parent and printing
                the child's USN on it says nothing about who is at the gate. */}
            {pass.visitorType === 'student' && pass.usn && (
              <div>
                <dt className="font-body text-2xs uppercase tracking-[0.16em] text-muted-foreground">
                  USN
                </dt>
                <dd className="mt-1 font-body text-sm tabular-nums text-foreground">
                  {pass.usn}
                </dd>
              </div>
            )}
            {pass.visitorType === 'student' &&
              (pass.studentClass || pass.section) && (
                <div>
                  <dt className="font-body text-2xs uppercase tracking-[0.16em] text-muted-foreground">
                    Class
                  </dt>
                  <dd className="mt-1 font-body text-sm text-foreground">
                    {[pass.studentClass, pass.section]
                      .filter(Boolean)
                      .join(' ')}
                  </dd>
                </div>
              )}
          </dl>
        </div>

        {/* Perforation */}
        <div className="relative" aria-hidden="true">
          <div className="border-t border-dashed border-border" />
          <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-border bg-background" />
          <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-border bg-background" />
        </div>

        <div className="flex flex-col items-center px-7 pb-7 pt-6">
          <div
            className={cn(
              'rounded-lg bg-white p-3',
              (cancelled || checkedIn) && 'opacity-30'
            )}
          >
            {qr ? (
              <img
                src={qr}
                alt={`QR code for pass ${pass.reference}`}
                className="h-44 w-44 md:h-48 md:w-48"
                draggable={false}
              />
            ) : (
              <div className="h-44 w-44 md:h-48 md:w-48" />
            )}
          </div>
          <p className="mt-4 font-body text-sm font-semibold tracking-[0.18em] text-foreground">
            {pass.reference}
          </p>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            Present this code at the gate
          </p>

          {(cancelled || checkedIn) && (
            <p
              className={cn(
                'mt-4 rounded-full border px-4 py-1.5 font-body text-xs font-semibold uppercase tracking-[0.16em]',
                cancelled
                  ? 'border-destructive/60 text-destructive'
                  : 'border-accent/60 text-accent'
              )}
            >
              {cancelled ? 'Cancelled' : 'Checked in'}
            </p>
          )}
        </div>
      </article>
    </Tilt>
  );
}
