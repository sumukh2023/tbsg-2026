import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';

/** One booking as retrieval describes it: the receipt, plus its deck. */
export type Booking = {
  reference: string | null;
  booked_at: string | null;
  passes: number;
  total_amount: number | null;
  payment_status: string | null;
  status: 'active' | 'partly_checked_in' | 'checked_in' | 'cancelled';
  tokens: string[];
};

const STATUS_LABELS: Record<Booking['status'], string> = {
  active: 'Active',
  partly_checked_in: 'Partly checked in',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
};

/**
 * Every booking held on one email and mobile number, newest first.
 *
 * WHY A LIST AND NOT ONE LONG DECK. A household that books twice holds two
 * receipts, two references and two totals, and flattening them into a single
 * run of passes loses all three: the visitor cannot tell which pass belongs
 * to which booking, and cannot quote a reference at the desk. So the bookings
 * are the first thing, and a deck is what you get after choosing one.
 *
 * A SINGLE BOOKING NEVER SEES THIS. One booking means there is nothing to
 * choose between, and a list of one is a step that exists only to be clicked
 * through. PassPage opens straight into the deck in that case.
 */
export function BookingList({
  bookings,
  onOpen,
}: {
  bookings: Booking[];
  onOpen: (booking: Booking) => void;
}) {
  return (
    <ul className="mb-16 space-y-3">
      {bookings.map((booking, i) => (
        <motion.li
          key={booking.reference ?? booking.tokens[0]}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: Math.min(i * 0.07, 0.35),
            ease: EASE.out,
          }}
        >
          <button
            type="button"
            onClick={() => onOpen(booking)}
            className="group liquid-glass block w-full rounded-xl border border-white/10 p-5 text-left transition-colors duration-300 hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-body text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
                  Booking
                </p>
                <p className="mt-1.5 truncate font-body text-lg font-medium tracking-[0.12em] text-foreground">
                  {booking.reference ?? 'Reference pending'}
                </p>
                {booking.booked_at && (
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    {formatBookedAt(booking.booked_at)}
                  </p>
                )}
              </div>
              <div className="flex flex-none items-center gap-3">
                <StatusPip status={booking.status} />
                <ChevronRight
                  aria-hidden="true"
                  className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </div>
            </div>

            <dl className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-white/10 pt-4">
              <Fact
                label={booking.passes === 1 ? 'Pass' : 'Passes'}
                value={String(booking.passes)}
              />
              {booking.total_amount !== null && (
                <Fact
                  label="Total paid"
                  value={`₹${booking.total_amount.toLocaleString('en-IN')}`}
                />
              )}
            </dl>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-body text-base tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

/**
 * The same colour language as the deck's own chip, so a booking that reads
 * "Checked in" here and a pass that reads it there look like one system.
 */
function StatusPip({ status }: { status: Booking['status'] }) {
  const cancelled = status === 'cancelled';
  const used = status === 'checked_in';
  const partial = status === 'partly_checked_in';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-body text-xs',
        cancelled
          ? 'bg-destructive/10 text-destructive'
          : used
            ? 'bg-foreground/[0.07] text-muted-foreground'
            : partial
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          cancelled
            ? 'bg-destructive'
            : used
              ? 'bg-muted-foreground'
              : partial
                ? 'bg-amber-500'
                : 'bg-emerald-500'
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** "12 August 2026, 4:10 pm", in the timezone the visitor is standing in. */
function formatBookedAt(value: string): string {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
