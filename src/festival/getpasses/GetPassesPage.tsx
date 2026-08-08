import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';
import { PassDeck } from '../pass/PassDeck';
import {
  describeLine,
  quoteFor,
  type Quote,
  type VisitorType,
} from './pricing';
import { formatRupees } from '@/utils/money';
import { PromoField } from './PromoField';
import { describePromo, previewPromo, type PromoState } from './promo';
import { AttendeeFields } from './AttendeeFields';
import {
  attendeeNoun,
  emptyAttendee,
  type AttendeeDraft,
  type AttendeeErrors,
} from './attendee';
import {
  Consent,
  FloatingInput,
  FloatingTextarea,
  PassStepper,
  FloatingSelect,
  PassCountInput,
  RadioPills,
} from './fields';

const VISITOR_TYPES = [
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
] as const;

// Passes each visitor type may reserve; `null` is unrestricted. Mirrors
// PASS_LIMITS in api/_shared.ts; the server re-validates and never trusts
// this copy.
const PASS_LIMITS: Record<string, number> = {
  student: 1,
  parent: 2,
  other: 10,
};

/** Above this a stepper is the wrong control: typing beats ten taps. */
const STEPPER_MAX = 4;

const CLASSES = [
  'Nursery',
  'LKG',
  'UKG',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
] as const;

const SECTIONS = ['A', 'B', 'C', 'D'] as const;

const VISITOR_DETAILS = [
  'Guest',
  'Faculty',
  'Alumni',
  'Sponsor',
  'Vendor',
  'Media',
] as const;

/** Visitor types that supply school-roll details: their own, or their child's. */
const STEPS = ['Visitor', 'Booking', 'Details', 'Confirm'] as const;

type FormState = {
  /** One entry per ticket, and therefore one per pass. */
  attendees: AttendeeDraft[];
  fullName: string;
  email: string;
  phone: string;
  passes: string;
  visitorType: string;
  studentName: string;
  usn: string;
  studentClass: string;
  section: string;
  visitorDetail: string;
  organisation: string;
  accessibility: string;
  comments: string;
  termsAccepted: boolean;
  bookingEmails: boolean;
  marketingEmails: boolean;
};

type Errors = Partial<Record<keyof FormState, string>> & {
  /** Positional, so an error lands on the attendee it belongs to. */
  attendeeList?: AttendeeErrors[];
};

const initialForm: FormState = {
  attendees: [emptyAttendee()],
  fullName: '',
  email: '',
  phone: '',
  passes: '1',
  visitorType: '',
  studentName: '',
  usn: '',
  studentClass: '',
  section: '',
  visitorDetail: '',
  organisation: '',
  accessibility: '',
  comments: '',
  termsAccepted: false,
  // Operational mail about your own booking is on by default and recommended;
  // the festival newsletter is opt-in, off until asked for.
  bookingEmails: true,
  marketingEmails: false,
};

/**
 * Page masthead. Extracted and memoised because it depends on no state: left
 * inline it re-rendered — TextEffect included, which is one element per word —
 * on every keystroke and every category switch in the form below it.
 */
const PageHeader = memo(function PageHeader() {
  return (
    <header className="pb-10 pt-14 md:pb-14 md:pt-20">
      <TextEffect
        as="h1"
        per="word"
        preset="fade-in-blur"
        delay={0.2}
        className="font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl md:text-7xl"
      >
        Reserve Your Passes
      </TextEffect>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7, ease: EASE.out }}
        className="mt-5 max-w-lg font-body text-base leading-relaxed text-muted-foreground"
      >
        A minute of your time helps the student committee plan gates, seating
        and the mercato for the right crowd, so the day feels effortless for
        everyone.{' '}
        {/* IN THE PARAGRAPH, not under the form. Someone who already has a
            pass is here by mistake, and the place to catch them is before
            they start filling in a form they do not need. At the bottom it
            was only found by the people who had already done the work. */}
        Already registered?{' '}
        <Link
          to="/pass"
          className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retrieve your pass
        </Link>
      </motion.p>
    </header>
  );
});

function validateStep(step: number, form: FormState): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (!VISITOR_TYPES.some((t) => t.value === form.visitorType)) {
      errors.visitorType = 'Choose the option that fits you best.';
    }
    if (form.fullName.trim().length < 2) {
      errors.fullName = 'Please tell us your full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      errors.email = 'That email address does not look right yet.';
    }
    if (!/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))) {
      errors.phone = 'Please enter a 10-digit Indian mobile number.';
    }
  }
  if (step === 1) {
    const limit = PASS_LIMITS[form.visitorType] ?? 1;
    const count = Number(form.passes);
    if (!form.passes.trim() || !Number.isInteger(count) || count < 1) {
      // Only a value ABOVE the ceiling earns the ceiling message; an empty or
      // nonsensical entry gets its own.
      errors.passes = 'Please enter the number of tickets.';
    } else if (count > limit) {
      errors.passes =
        limit > STEPPER_MAX
          ? `A maximum of ${limit} tickets may be reserved in a single booking.`
          : `A ${form.visitorType} registration includes ${limit} ${limit === 1 ? 'pass' : 'passes'}.`;
    }
    /* The child the booking is for, asked once. A student's own roll is
       asked per attendee below instead, because three student tickets are
       three different pupils. Mirrors api/register.ts. */
    if (form.visitorType === 'parent') {
      if (form.studentName.trim().length < 2) {
        errors.studentName = "Please enter the student's name.";
      }
      if (!form.usn.trim()) errors.usn = 'Please enter the student USN.';
      if (!CLASSES.includes(form.studentClass as (typeof CLASSES)[number])) {
        errors.studentClass = 'Choose the class.';
      }
      if (!SECTIONS.includes(form.section as (typeof SECTIONS)[number])) {
        errors.section = 'Choose the section.';
      }
    } else if (form.visitorType === 'other') {
      /* CHECKED ONLY FOR "OTHER", and the `else if` matters.
         When the roll block above became parent-only, a STUDENT fell into
         this branch and was required to choose a visitor detail their form
         never renders. Continue then did nothing at all: an error was
         raised, but on a field with nothing on screen to attach it to, so
         there was no message and no red outline to explain the dead button.
         Naming the category is what keeps the two branches from covering
         someone neither was written for. */
      if (
        !VISITOR_DETAILS.includes(
          form.visitorDetail as (typeof VISITOR_DETAILS)[number]
        )
      ) {
        errors.visitorDetail = 'Choose the option that describes you best.';
      }
    }

    /* One name per ticket. Errors are POSITIONAL so each lands on the block
       it belongs to: a single "please fill in the names" under a list of ten
       tells nobody which one they missed. */
    const noun = attendeeNoun(form.visitorType);
    const list: AttendeeErrors[] = form.attendees.map((attendee) => {
      const found: AttendeeErrors = {};
      if (attendee.name.trim().length < 2) {
        found.name = `Please enter this ${noun.toLowerCase()}'s name.`;
      }
      if (form.visitorType === 'student') {
        if (!attendee.usn.trim()) found.usn = 'Please enter the USN.';
        if (!CLASSES.includes(attendee.studentClass as (typeof CLASSES)[number])) {
          found.studentClass = 'Choose the class.';
        }
        if (!SECTIONS.includes(attendee.section as (typeof SECTIONS)[number])) {
          found.section = 'Choose the section.';
        }
      }
      return found;
    });
    if (list.some((e) => Object.keys(e).length > 0)) errors.attendeeList = list;

    // Two tickets on one USN is a duplicated row, not two children.
    const rolls = form.attendees
      .map((a) => a.usn.trim())
      .filter(Boolean);
    if (new Set(rolls).size !== rolls.length) {
      errors.usn = 'Each student needs their own USN. One is repeated.';
    }
  }
  if (step === 3 && !form.termsAccepted) {
    errors.termsAccepted =
      'Please accept the Terms of Service and Privacy Policy to continue.';
  }
  if (step === 2) {
    if (form.accessibility.length > 500) {
      errors.accessibility = 'Please keep this under 500 characters.';
    }
    if (form.comments.length > 500) {
      errors.comments = 'Please keep this under 500 characters.';
    }
  }
  return errors;
}

type MintedPass = {
  token: string;
  reference: string;
  issued_at: string;
  attendee_name?: string;
  attendee_category?: string;
  sequence?: number;
};

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string }
  /** Every pass the booking minted, in booking order, and what it cost. */
  | { phase: 'success'; passes: MintedPass[]; pricing: BookingPricing | null };

/**
 * What the SERVER charged, as the server reported it.
 *
 * Displayed rather than recomputed: this is the receipt, and the whole point
 * of a receipt is that it says what actually happened. Recomputing it here
 * would be the browser marking its own homework, and would quietly disagree
 * the moment a promotion ran out between applying a code and booking with it.
 */
type BookingPricing = {
  subtotal: number;
  discount_amount: number;
  promo_code: string | null;
  convenience_fee: number;
  total_amount: number;
};

/** Slow lantern glow: the page breathing, nothing more. */
function EveningBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.16),transparent_70%)]"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(55%_40%_at_85%_100%,hsl(var(--primary)/0.08),transparent_70%)]" />
      <Grain className="opacity-[0.04]" />
    </div>
  );
}

function ProgressRail({ step }: { step: number }) {
  return (
    <div>
      {/* Below sm the rail stays on ONE line: fluid type (clamped to the
          viewport) shrinks the four labels just enough to seat them in the
          form's inner width (224px at a 320px viewport), and the counter
          goes screen-reader only. Desktop keeps its original rail. */}
      <div className="flex items-baseline justify-between gap-3">
        <ol
          className="flex flex-nowrap gap-x-1.5 sm:gap-x-5"
          aria-label="Registration steps"
        >
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={
                'whitespace-nowrap font-body text-[clamp(0.5rem,2.8vw,0.6875rem)] uppercase tracking-[0.06em] transition-colors duration-300 sm:text-xs sm:tracking-[0.18em] ' +
                (i === step
                  ? 'text-primary'
                  : i < step
                    ? 'text-foreground/70'
                    : 'text-muted-foreground/50')
              }
            >
              {label}
            </li>
          ))}
        </ol>
        <p
          className="font-body text-xs tabular-nums text-muted-foreground max-sm:sr-only"
          aria-live="polite"
        >
          {step + 1} / {STEPS.length}
        </p>
      </div>
      <div className="mt-3 h-px w-full bg-border">
        <motion.div
          className="h-px bg-primary"
          initial={false}
          animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE.out }}
        />
      </div>
    </div>
  );
}

function SuccessView({
  passes,
  form,
  pricing,
}: {
  passes: MintedPass[];
  form: FormState;
  pricing: BookingPricing | null;
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <svg viewBox="0 0 96 96" className="h-24 w-24" aria-hidden="true">
        <motion.circle
          cx="48"
          cy="48"
          r="44"
          fill="none"
          strokeWidth="1.5"
          className="stroke-primary"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: EASE.inOut }}
        />
        <motion.path
          d="M32 49.5 L43.5 61 L64 38"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.8, ease: EASE.out }}
        />
      </svg>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.1, ease: EASE.out }}
        className="mt-8 font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl"
      >
        Your registration has been received.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.3, ease: EASE.out }}
        className="mt-4 max-w-md font-body text-base leading-relaxed text-muted-foreground"
      >
        {passes.length === 0
          ? 'Your passes will be waiting at the main gate on 14 November. The organising committee will write to you only if anything about your booking needs attention.'
          : passes.length === 1
            ? 'Your digital pass is below. Show its code at the gate on 14 November; the organising committee will write only if anything needs attention.'
            : `All ${passes.length} passes are below, one for each person. Each has its own code, so everyone can arrive separately.`}
      </motion.p>

      {passes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.6, ease: EASE.out }}
          className="mt-10 w-full"
        >
          {/* EVERY PASS, not the first one. A family of four leaves this
              screen with four codes, and showing one of them would have sent
              three people to the gate with nothing. */}
          <PassDeck
            passes={passes.map((minted, i) => ({
              token: minted.token,
              reference: minted.reference,
              status: 'valid' as const,
              // The name on the PASS, which for every attendee after the
              // first is not the purchaser's.
              guestName:
                minted.attendee_name ??
                form.attendees[i]?.name.trim() ??
                form.fullName.trim(),
              visitorType: minted.attendee_category ?? form.visitorType,
              numberOfPasses: passes.length,
              sequence: minted.sequence ?? i + 1,
              usn:
                form.visitorType === 'student'
                  ? (form.attendees[i]?.usn.trim() ?? null)
                  : form.visitorType === 'parent'
                    ? form.usn.trim()
                    : null,
              studentClass:
                form.visitorType === 'student'
                  ? (form.attendees[i]?.studentClass ?? null)
                  : form.visitorType === 'parent'
                    ? form.studentClass
                    : null,
              section:
                form.visitorType === 'student'
                  ? (form.attendees[i]?.section ?? null)
                  : form.visitorType === 'parent'
                    ? form.section
                    : null,
            }))}
            checkedInAt={{}}
          />
          <p className="mx-auto mt-5 max-w-sm font-body text-xs leading-relaxed text-muted-foreground">
            Print them now or keep this page. If you lose them, you can
            retrieve every pass in the booking at any time with your email,
            mobile number and name.
          </p>
        </motion.div>
      )}

      {/* THE RECEIPT, from the server. A visitor who applied a code needs to
          see that it was honoured, and the only trustworthy place that can
          come from is the reply that created the booking. */}
      {pricing && (
        <motion.dl
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: passes.length ? 1.85 : 1.4,
            ease: EASE.out,
          }}
          className="mx-auto mt-10 w-full max-w-sm space-y-2.5 rounded-2xl border border-border/60 bg-card/60 p-5 text-left"
        >
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-body text-sm text-muted-foreground">Tickets</dt>
            <dd className="font-body text-sm tabular-nums text-foreground">
              {pricing.discount_amount > 0 ? (
                <span className="text-muted-foreground/70 line-through">
                  {formatRupees(pricing.subtotal)}
                </span>
              ) : (
                formatRupees(pricing.subtotal)
              )}
            </dd>
          </div>
          {pricing.discount_amount > 0 && (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0 truncate font-body text-sm text-accent">
                  {pricing.promo_code} applied
                </dt>
                <dd className="font-body text-sm tabular-nums text-accent">
                  &minus;{formatRupees(pricing.discount_amount)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-body text-sm text-muted-foreground">
                  Discounted tickets
                </dt>
                <dd className="font-body text-sm tabular-nums text-foreground">
                  {formatRupees(pricing.subtotal - pricing.discount_amount)}
                </dd>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-body text-sm text-muted-foreground">
              Convenience fee
            </dt>
            <dd className="font-body text-sm tabular-nums text-foreground">
              {formatRupees(pricing.convenience_fee)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border/60 pt-3">
            <dt className="font-body text-sm font-medium text-foreground">
              Payable at the gate
            </dt>
            <dd className="font-display text-xl font-medium tabular-nums text-foreground">
              {formatRupees(pricing.total_amount)}
            </dd>
          </div>
        </motion.dl>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: passes.length ? 2.0 : 1.5, ease: EASE.out }}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
      >
        {passes.length > 0 && (
          /* THE WHOLE BOOKING, not `/pass/<first token>`. That address is one
             pass, so a family of four followed this button to a screen with
             three of their passes missing. The tokens travel in router state
             instead of the URL, for the same reason retrieval keeps them out
             of it: a token is the credential, and the address bar is history,
             the back button and anything that syncs either. */
          <Link
            to="/pass"
            state={{ tokens: passes.map((minted) => minted.token) }}
            className="inline-flex items-center rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {passes.length === 1 ? 'View QR Pass' : 'View all QR passes'}
          </Link>
        )}
        <Link
          to="/"
          className="inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        >
          Return Home
        </Link>
      </motion.div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3.5 last:border-b-0">
      <dt className="w-28 shrink-0 font-body text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="flex-1 font-body text-sm text-foreground">{value}</dd>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="font-body text-xs text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Edit
        </button>
      )}
    </div>
  );
}

/**
 * What the booking costs, itemised. One row per category actually booked,
 * each showing the arithmetic rather than just its answer, and a grand total
 * under a rule.
 *
 * Every number here comes from `quoteFor`. Nothing in this component
 * multiplies anything, so a change to the rate card in `pricing.ts` moves the
 * lines and the total together and cannot leave them disagreeing.
 */
function PriceSummary({
  quote,
  promo,
  promoInput,
  onPromoInput,
  onApplyPromo,
  onRemovePromo,
}: {
  quote: Quote;
  promo: PromoState;
  promoInput: string;
  onPromoInput: (value: string) => void;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}) {
  if (quote.lines.length === 0) return null;
  /* THE DISCOUNT SHOWN IS THE ONE THE SERVER QUOTED, and it is only shown
     while it still describes THIS order. Going back and adding a ticket
     changes the subtotal, so a discount quoted against the old one would be
     arithmetic nobody can check; the page re-applies the code instead. */
  const applied = promo.phase === 'applied' ? promo.promo : null;
  const discount =
    applied && applied.subtotal === quote.ticketsTotal ? applied.discountAmount : 0;
  const payable = quote.ticketsTotal - discount + quote.convenienceFee;
  return (
    <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-5">
      <h3 className="font-body text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Amount payable
      </h3>
      <dl className="mt-4 space-y-3">
        {quote.lines.map((line) => (
          <div
            key={line.type}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="font-body text-sm text-foreground">{line.label}</dt>
            <dd className="font-body text-sm tabular-nums text-muted-foreground">
              <span aria-hidden="true">{describeLine(line)}</span>
              <span className="sr-only">
                {line.quantity} at {formatRupees(line.unitPrice)} each, {}
                {formatRupees(line.subtotal)}
              </span>
            </dd>
          </div>
        ))}

        {/* Tickets, then the fee, then the rule, then what is payable: the
            order every ticketing site uses, because it is the order the
            arithmetic happens in. */}
        <div className="flex items-baseline justify-between gap-4 border-t border-border/60 pt-3">
          <dt className="font-body text-sm text-foreground">Tickets</dt>
          <dd className="font-body text-sm tabular-nums text-muted-foreground">
            {/* Struck through once a discount lands, so the reader can see
                what changed rather than only what it became. */}
            {discount > 0 ? (
              <span className="text-muted-foreground/70 line-through">
                {formatRupees(quote.ticketsTotal)}
              </span>
            ) : (
              formatRupees(quote.ticketsTotal)
            )}
          </dd>
        </div>

        <AnimatePresence initial={false}>
          {discount > 0 && applied && (
            <motion.div
              key="discount"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: EASE.out }}
              className="overflow-hidden"
            >
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0 truncate font-body text-sm text-accent">
                  {describePromo(applied)}
                </dt>
                <dd className="font-body text-sm tabular-nums text-accent">
                  &minus;{formatRupees(discount)}
                </dd>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-4">
                <dt className="font-body text-sm text-foreground">
                  Discounted tickets
                </dt>
                <dd className="font-body text-sm font-medium tabular-nums text-foreground">
                  {formatRupees(quote.ticketsTotal - discount)}
                </dd>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-body text-sm text-foreground">
            Convenience fee
          </dt>
          <dd className="font-body text-sm tabular-nums text-muted-foreground">
            {/* NEVER DISCOUNTED. The promotion is off the tickets, so this
                line reads the same before and after a code is applied. */}
            {formatRupees(quote.convenienceFee)}
          </dd>
        </div>
      </dl>

      <PromoField
        state={promo}
        value={promoInput}
        onChange={onPromoInput}
        onApply={onApplyPromo}
        onRemove={onRemovePromo}
      />
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border/60 pt-4">
        <span className="font-body text-sm font-medium text-foreground">
          Total
        </span>
        <span className="font-display text-2xl font-medium tabular-nums text-foreground">
          {formatRupees(payable)}
        </span>
      </div>
      <p className="mt-3 font-body text-xs leading-relaxed text-muted-foreground">
        Payable at the gate on the day. Reserving passes here does not charge
        you anything now.
      </p>
    </div>
  );
}

export default function GetPassesPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });
  const [promo, setPromo] = useState<PromoState>({ phase: 'idle' });
  const [promoInput, setPromoInput] = useState('');

  // Bring the pass fully into view once it is minted.
  useEffect(() => {
    if (submit.phase === 'success') window.scrollTo({ top: 0 });
  }, [submit.phase]);

  // Stable across renders so the memoised field components below are not
  // invalidated by a new callback identity on every keystroke.
  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => (f[key] === value ? f : { ...f, [key]: value }));
      setErrors((e) => (e[key] === undefined ? e : { ...e, [key]: undefined }));
    },
    []
  );

  // Ticket control follows the ceiling: a stepper for one or two, a typed
  // integer once tapping "+" fifty times would be the alternative.
  const ticketLimit = PASS_LIMITS[form.visitorType] ?? 1;
  const ticketsAsField = ticketLimit > STEPPER_MAX;
  /* The booking-level roll is the CHILD a parent is here for. A student's
     own roll is per attendee now, so this no longer covers them. */
  const needsRoll = form.visitorType === 'parent';
  const ticketCount = Math.min(
    Math.max(Number(form.passes) || 0, 0),
    ticketLimit
  );

  /**
   * The attendee list follows the ticket count.
   *
   * GROWING KEEPS WHAT IS ALREADY TYPED, and shrinking drops from the end.
   * Rebuilding the array on every change would wipe four names because
   * somebody corrected the count from 5 to 4, which is the sort of thing
   * that makes a person start the form again.
   */
  useEffect(() => {
    setForm((current) => {
      if (current.attendees.length === ticketCount) return current;
      const next = current.attendees.slice(0, ticketCount);
      while (next.length < ticketCount) next.push(emptyAttendee());
      return { ...current, attendees: next };
    });
  }, [ticketCount]);

  const setAttendee = useCallback(
    (index: number, patch: Partial<AttendeeDraft>) => {
      setForm((current) => {
        const attendees = current.attendees.map((a, i) =>
          i === index ? { ...a, ...patch } : a
        );
        return { ...current, attendees };
      });
      // Clear only the fields just corrected, so the other blocks keep theirs.
      setErrors((current) => {
        if (!current.attendeeList) return current;
        const list = current.attendeeList.map((e, i) => {
          if (i !== index) return e;
          const next = { ...e };
          for (const key of Object.keys(patch) as (keyof AttendeeDraft)[]) {
            delete next[key];
          }
          return next;
        });
        return { ...current, attendeeList: list };
      });
    },
    []
  );

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const advance = () => {
    const stepErrors = validateStep(step, form);
    setErrors(stepErrors);
    if (Object.values(stepErrors).some(Boolean)) return;
    goTo(step + 1);
  };

  /**
   * Priced from the booking as it actually stands. A booking is one category
   * today, so this is a map with one entry — but it is a MAP, so the day the
   * form lets someone book two categories at once, the confirmation page
   * itemises both without being touched.
   */
  const quote = useMemo(() => {
    // Built into a TYPED variable rather than passed as an object literal
    // with a computed key: a computed key widens the literal to
    // `{ [x: string]: … }`, which slips past the parameter's type and let the
    // form's `passes` — a STRING, because it is bound to a text input — reach
    // a function expecting a number. It priced the booking at nothing.
    const counts: Partial<Record<VisitorType, number>> = {};
    counts[form.visitorType as VisitorType] = Number(form.passes);
    return quoteFor(counts);
  }, [form.visitorType, form.passes]);

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromo({ phase: 'checking' });
    const result = await previewPromo({
      code,
      visitorType: form.visitorType,
      tickets: Number(form.passes),
    });
    setPromo(
      result.ok
        ? { phase: 'applied', promo: result.promo }
        : { phase: 'error', message: result.message }
    );
  }, [promoInput, form.visitorType, form.passes]);

  const removePromo = useCallback(() => {
    setPromo({ phase: 'idle' });
    setPromoInput('');
  }, []);

  /* AN APPLIED CODE IS RE-QUOTED WHEN THE ORDER CHANGES.
     The discount is a proportion of the ticket subtotal, so going back and
     adding a ticket makes the quoted amount wrong. Showing a stale one is
     arithmetic the reader cannot check, and silently dropping the code is
     worse: they applied it, and would arrive at the total wondering where it
     went. One request per order change, and order changes require navigating
     back a step, so this is not a per-keystroke cost. */
  const appliedCode = promo.phase === 'applied' ? promo.promo.code : null;
  const appliedFor = promo.phase === 'applied' ? promo.promo.subtotal : null;
  useEffect(() => {
    if (!appliedCode || appliedFor === null) return;
    if (appliedFor === quote.ticketsTotal) return;
    let cancelled = false;
    void previewPromo({
      code: appliedCode,
      visitorType: form.visitorType,
      tickets: Number(form.passes),
    }).then((result) => {
      if (cancelled) return;
      setPromo(
        result.ok
          ? { phase: 'applied', promo: result.promo }
          : { phase: 'error', message: result.message }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [appliedCode, appliedFor, quote.ticketsTotal, form.visitorType, form.passes]);

  const visitorLabel = useMemo(
    () => VISITOR_TYPES.find((t) => t.value === form.visitorType)?.label ?? '',
    [form.visitorType]
  );

  const submitRegistration = async () => {
    setSubmit({ phase: 'submitting' });

    // Only a failed fetch is a connectivity problem; any response from the
    // server carries its own, more specific message.
    let response: Response;
    try {
      response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/\s/g, ''),
          visitor_type: form.visitorType,
          number_of_passes: Number(form.passes) || 1,
          /* THE CODE, AND NOTHING ELSE ABOUT IT. No discount, no subtotal,
             no total: the server reserves the code at this moment and prices
             the booking itself, so what this page believes it is worth is
             never consulted. Sending the amount would be sending a number
             anybody could edit. */
          promo_code: promo.phase === 'applied' ? promo.promo.code : null,
          /* ONE ENTRY PER TICKET. The server mints a pass from each, so the
             list is what turns a count into named, separately checkable
             passes. Roll fields go only on student attendees; the server
             refuses them on anyone else. */
          attendees: form.attendees.map((attendee) => ({
            attendee_name: attendee.name.trim(),
            ...(form.visitorType === 'student'
              ? {
                  usn: attendee.usn.trim(),
                  class: attendee.studentClass,
                  section: attendee.section,
                }
              : {}),
          })),
          // The child a PARENT booking is for, named once and copied onto
          // each parent's pass by the server.
          student_name:
            form.visitorType === 'parent' ? form.studentName.trim() : null,
          usn: form.visitorType === 'parent' ? form.usn.trim() : null,
          class: form.visitorType === 'parent' ? form.studentClass : null,
          section: form.visitorType === 'parent'
            ? form.section
            : null,
          visitor_detail:
            form.visitorType === 'other' ? form.visitorDetail : null,
          organisation:
            form.visitorType === 'other'
              ? form.organisation.trim() || null
              : null,
          terms_accepted: form.termsAccepted,
          booking_email_opt_in: form.bookingEmails,
          marketing_email_opt_in: form.marketingEmails,
          accessibility_requirements: form.accessibility.trim() || null,
          comments: form.comments.trim() || null,
          website: '', // honeypot, stays empty for humans
        }),
      });
    } catch {
      setSubmit({
        phase: 'error',
        message:
          'We could not reach the registration desk. Check your connection and try again.',
      });
      return;
    }

    const data = await response.json().catch(() => null);

    /* NO 409 BRANCH. Booking twice on one email address is allowed now, so
       there is no duplicate to report and nothing to lock the form for. The
       branch that used to live here also DISABLED the submit button for the
       rest of the session, which made an unexpected 409 from any layer in
       front of the function an unrecoverable page. */
    if (!response.ok) {
      // 422 says what to fix, 502 asks to retry, 503 says the desk is not
      // configured; fall back by class only when the body carried nothing.
      setSubmit({
        phase: 'error',
        message:
          data?.error ??
          (response.status >= 500
            ? 'The registration service is unavailable right now. Please try again shortly.'
            : 'The registration could not be processed. Please review your details and retry.'),
      });
      /* A REFUSAL THAT NAMES A FIELD GOES BACK TO THAT FIELD.
         The identity check refuses when an email address arrives with a
         different mobile number from the one it booked under before, and
         both of those live on step ONE. Leaving the message on the
         confirmation step would be telling somebody to correct something
         they cannot see, four steps away, with no indication of where. */
      if (data?.field === 'email' || data?.field === 'phone') {
        setErrors((current) => ({ ...current, [data.field]: data.error }));
        goTo(0);
      }
      return;
    }
    setSubmit({
      phase: 'success',
      // The array is the shape now; `pass` is the old single-pass field and
      // is only read if a response predates the change.
      passes: data?.passes ?? (data?.pass ? [data.pass] : []),
      pricing: data?.pricing ?? null,
    });
  };

  const panelVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
  };

  return (
    <div className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <EveningBackdrop />

      {/* Chrome: the same bar as the homepage nav, carried into the evening. */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE.out }}
        className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl md:px-10"
        aria-label="Registration"
      >
        <Link
          to="/"
          aria-label="Flash @ Brigade home"
          className="text-foreground transition-colors duration-300 hover:text-primary"
        >
          <CarnivalMark className="h-7 w-auto md:h-8" />
        </Link>
        <Link
          to="/"
          className="group inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back to the piazza
        </Link>
      </motion.nav>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-6 pb-[env(safe-area-inset-bottom)] pt-16 md:px-8">
        <PageHeader />

        {/* Form panel */}
        <motion.section
          aria-label="Pass registration form"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE.out }}
          className="liquid-glass mb-16 rounded-xl border border-white/10 p-6 md:p-10"
        >
          {submit.phase === 'success' ? (
            <SuccessView
              passes={submit.passes}
              form={form}
              pricing={submit.pricing}
            />
          ) : (
            <>
              <ProgressRail step={step} />

              <form
                className="mt-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (step < 3) advance();
                  else if (
                    submit.phase === 'idle' ||
                    submit.phase === 'error'
                  ) {
                    // The last step validates too: consent is a precondition,
                    // so an unticked box has to stop the booking here rather
                    // than travel to the server only to come back a 422.
                    const stepErrors = validateStep(3, form);
                    setErrors(stepErrors);
                    if (Object.values(stepErrors).some(Boolean)) return;
                    void submitRegistration();
                  }
                }}
                noValidate
              >
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={panelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.4, ease: EASE.out }}
                  >
                    {step === 0 && (
                      <div className="space-y-1">
                        <h2 className="mb-5 font-display text-2xl font-medium text-foreground">
                          Visitor details
                        </h2>
                        <FloatingInput
                          id="fullName"
                          label="Full name"
                          value={form.fullName}
                          onChange={(v) => set('fullName', v)}
                          error={errors.fullName}
                          autoComplete="name"
                          maxLength={120}
                        />
                        <FloatingInput
                          id="email"
                          label="Email address"
                          type="email"
                          inputMode="email"
                          value={form.email}
                          onChange={(v) => set('email', v)}
                          error={errors.email}
                          autoComplete="email"
                          maxLength={160}
                        />
                        <FloatingInput
                          id="phone"
                          label="Mobile number"
                          type="tel"
                          inputMode="tel"
                          value={form.phone}
                          onChange={(v) => set('phone', v)}
                          error={errors.phone}
                          hint="We only call if something changes on the day."
                          autoComplete="tel"
                          maxLength={16}
                        />
                        {/* The category selector lives at the END of step 1.
                            Step 2 then renders one form, chosen once, instead
                            of swapping sections in and out under the reader
                            while they are looking at them. */}
                        <div className="pt-4">
                          <RadioPills
                            legend="I am a"
                            name="visitorType"
                            options={VISITOR_TYPES}
                            value={form.visitorType}
                            onChange={(v) => {
                              set('visitorType', v);
                              const limit = PASS_LIMITS[v] ?? 1;
                              if (Number(form.passes) > limit) {
                                set('passes', String(limit));
                              }
                            }}
                            error={errors.visitorType}
                          />
                        </div>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="space-y-8">
                        <h2 className="font-display text-2xl font-medium text-foreground">
                          Booking details
                        </h2>

                        {ticketsAsField ? (
                          <PassCountInput
                            label="Number of tickets"
                            value={form.passes}
                            onChange={(v) => set('passes', v)}
                            max={ticketLimit}
                            error={errors.passes}
                          />
                        ) : (
                          <PassStepper
                            label="Number of passes"
                            value={Number(form.passes) || 1}
                            onChange={(v) => set('passes', String(v))}
                            max={ticketLimit}
                          />
                        )}

                        <AttendeeFields
                          visitorType={form.visitorType}
                          attendees={form.attendees}
                          errors={errors.attendeeList ?? []}
                          onChange={setAttendee}
                          classes={CLASSES}
                          sections={SECTIONS}
                        />

                        {needsRoll && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-display text-xl font-medium text-foreground">
                                Student details
                              </h3>
                              {form.visitorType === 'parent' && (
                                <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
                                  Please enter the details of your child
                                  studying at The Brigade School.
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              {form.visitorType === 'parent' && (
                                <FloatingInput
                                  id="studentName"
                                  label="Student name"
                                  value={form.studentName}
                                  onChange={(v) => set('studentName', v)}
                                  error={errors.studentName}
                                  maxLength={120}
                                  autoComplete="off"
                                />
                              )}
                              {/* A USN is A-Z and 0-9 and nothing else, so
                                  the field simply cannot hold anything else:
                                  lowercase is upper-cased as it is typed and
                                  spaces and punctuation are dropped. Correcting
                                  the input beats an error message for a rule
                                  the reader cannot usefully break. */}
                              <FloatingInput
                                id="usn"
                                label="USN"
                                value={form.usn}
                                onChange={(v) =>
                                  set(
                                    'usn',
                                    v.toUpperCase().replace(/[^A-Z0-9]/g, '')
                                  )
                                }
                                error={errors.usn}
                                maxLength={20}
                                autoComplete="off"
                                inputMode="text"
                              />
                              <div className="grid gap-2 sm:grid-cols-2">
                                <FloatingSelect
                                  id="studentClass"
                                  label="Class"
                                  value={form.studentClass}
                                  onChange={(v) => set('studentClass', v)}
                                  error={errors.studentClass}
                                  options={CLASSES}
                                />
                                <FloatingSelect
                                  id="section"
                                  label="Section"
                                  value={form.section}
                                  onChange={(v) => set('section', v)}
                                  error={errors.section}
                                  options={SECTIONS}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {form.visitorType === 'other' && (
                          <div className="space-y-2">
                            <FloatingSelect
                              id="visitorDetail"
                              label="Visitor details"
                              value={form.visitorDetail}
                              onChange={(v) => set('visitorDetail', v)}
                              error={errors.visitorDetail}
                              options={VISITOR_DETAILS}
                            />
                            <FloatingInput
                              id="organisation"
                              label="Organisation / company (optional)"
                              value={form.organisation}
                              onChange={(v) => set('organisation', v)}
                              error={errors.organisation}
                              maxLength={160}
                              autoComplete="organization"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-1">
                        <h2 className="mb-5 font-display text-2xl font-medium text-foreground">
                          Anything we should know?
                        </h2>
                        <FloatingTextarea
                          id="accessibility"
                          label="Accessibility requirements (optional)"
                          value={form.accessibility}
                          onChange={(v) => set('accessibility', v)}
                          error={errors.accessibility}
                          maxLength={500}
                        />
                        <FloatingTextarea
                          id="comments"
                          label="Comments (optional)"
                          value={form.comments}
                          onChange={(v) => set('comments', v)}
                          error={errors.comments}
                          maxLength={500}
                        />
                      </div>
                    )}

                    {step === 3 && (
                      <div>
                        <h2 className="font-display text-2xl font-medium text-foreground">
                          One last look
                        </h2>
                        <dl className="mt-5">
                          <SummaryRow
                            label="Name"
                            value={form.fullName.trim()}
                            onEdit={() => goTo(0)}
                          />
                          <SummaryRow label="Email" value={form.email.trim()} />
                          <SummaryRow
                            label="Mobile"
                            value={form.phone.trim()}
                          />
                          <SummaryRow
                            label="Passes"
                            value={`${form.passes} · ${visitorLabel}`}
                            onEdit={() => goTo(1)}
                          />
                          {needsRoll && (
                            <SummaryRow
                              label="Student"
                              value={[
                                form.visitorType === 'parent'
                                  ? form.studentName.trim()
                                  : null,
                                form.usn.trim(),
                                `${form.studentClass} ${form.section}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              onEdit={() => goTo(1)}
                            />
                          )}
                          {form.visitorType === 'other' &&
                            form.visitorDetail && (
                              <SummaryRow
                                label="Visitor"
                                value={[
                                  form.visitorDetail,
                                  form.organisation.trim(),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                                onEdit={() => goTo(1)}
                              />
                            )}
                          {form.accessibility.trim() && (
                            <SummaryRow
                              label="Access"
                              value={form.accessibility.trim()}
                              onEdit={() => goTo(2)}
                            />
                          )}
                          {form.comments.trim() && (
                            <SummaryRow
                              label="Comments"
                              value={form.comments.trim()}
                              onEdit={() => goTo(2)}
                            />
                          )}
                        </dl>

                        <PriceSummary
                          quote={quote}
                          promo={promo}
                          promoInput={promoInput}
                          onPromoInput={setPromoInput}
                          onApplyPromo={applyPromo}
                          onRemovePromo={removePromo}
                        />

                        {/* Consent sits immediately above Confirm booking, so
                            it is the last thing read before the commitment. */}
                        <fieldset className="mt-8 space-y-3">
                          <legend className="sr-only">
                            Consent and email preferences
                          </legend>
                          <Consent
                            id="terms"
                            checked={form.termsAccepted}
                            onChange={(v) => set('termsAccepted', v)}
                            error={errors.termsAccepted}
                          >
                            I have read and agreed to the{' '}
                            <Link
                              to="/terms"
                              target="_blank"
                              className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary"
                            >
                              Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link
                              to="/privacy"
                              target="_blank"
                              className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary"
                            >
                              Privacy Policy
                            </Link>
                            .
                          </Consent>
                          <Consent
                            id="booking-emails"
                            checked={form.bookingEmails}
                            onChange={(v) => set('bookingEmails', v)}
                          >
                            Send me important updates regarding my booking.{' '}
                            <span className="text-muted-foreground/70">
                              (Recommended)
                            </span>
                          </Consent>
                          <Consent
                            id="marketing-emails"
                            checked={form.marketingEmails}
                            onChange={(v) => set('marketingEmails', v)}
                          >
                            Keep me informed about news related to Flash @
                            Brigade.
                          </Consent>
                        </fieldset>

                        {submit.phase === 'error' && (
                          <div
                            role="alert"
                            className="mt-6 rounded-lg border border-destructive/60 px-4 py-3 font-body text-sm text-foreground"
                          >
                            {submit.message}
                            <span className="block pt-1 text-muted-foreground">
                              Nothing was lost. You can try again below.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Step controls */}
                <div className="mt-10 flex items-center justify-between">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => goTo(step - 1)}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-3 font-body text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                  ) : (
                    <span />
                  )}

                  {step < 3 ? (
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submit.phase === 'submitting'}
                      className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submit.phase === 'submitting' && (
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                        />
                      )}
                      {submit.phase === 'submitting'
                        ? 'Reserving'
                        : submit.phase === 'error'
                          ? 'Try again'
                          : 'Confirm reservation'}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </motion.section>

      </div>
    </div>
  );
}
