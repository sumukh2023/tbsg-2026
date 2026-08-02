import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Heart } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { cn } from '@/utils/cn';
import { EASE } from '@/utils/motion';
import { GoldRule, Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';
import { Consent, FloatingInput, RadioPills } from '../getpasses/fields';
import { AmountField } from '../donate/AmountField';
import { formatRupees, MIN_DONATION } from '../donate/amounts';
import {
  PAYMENTS_LIVE,
  settleDonation,
  type DonationIntent,
  type DonationOutcome,
} from '../donate/payment';

/**
 * /donate — the donation workflow.
 *
 * Four screens on one route: form, review, processing, thank you. They are a
 * state machine rather than four routes, because a half-filled donation is
 * not something anyone should be able to land on from a bookmark or a back
 * button, and because the form state has to survive Back from the review.
 *
 * The page knows NOTHING about payments. It calls `settleDonation` once,
 * between review and thank-you, and renders the outcome; whether that call
 * records an intent or takes an actual payment is entirely inside
 * `festival/donate/payment.ts`. See the note at the top of that file for
 * where a gateway is inserted.
 *
 * Built from the Get Passes primitives (`FloatingInput`, `RadioPills`,
 * `Consent`) on the Your Pass shell, so it is the same evening ground, the
 * same liquid glass and the same typography as the rest of the transactional
 * side of the site.
 */

type Step = 'form' | 'review' | 'processing' | 'done';

const DONOR_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'parent', label: 'Parent' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'corporate', label: 'Corporate' },
] as const;

const RECOGNITION = [
  { value: 'public', label: 'Public acknowledgement' },
  { value: 'anonymous', label: 'Anonymous donation' },
] as const;

type Form = {
  amount: number | null;
  custom: string;
  donorType: (typeof DONOR_TYPES)[number]['value'];
  fullName: string;
  email: string;
  phone: string;
  organisation: string;
  recognition: (typeof RECOGNITION)[number]['value'];
  marketingOptIn: boolean;
  termsAccepted: boolean;
};

const EMPTY: Form = {
  amount: null,
  custom: '',
  donorType: 'individual',
  fullName: '',
  email: '',
  phone: '',
  organisation: '',
  recognition: 'public',
  marketingOptIn: false,
  termsAccepted: false,
};

type Errors = Partial<Record<keyof Form, string>>;

/**
 * The same rules the API enforces, stated once here so the reader is told
 * before a round trip. The server is still the authority: it revalidates
 * everything and this function is never trusted.
 */
function validate(form: Form): Errors {
  const errors: Errors = {};

  // The floor is MIN_DONATION, NOT the smallest preset: someone typing ₹200
  // into the custom field is giving, and must not be refused because the
  // cheapest button happens to say ₹500.
  if (form.amount === null) {
    errors.amount = 'Choose an amount, or enter your own.';
  } else if (form.amount < MIN_DONATION) {
    errors.amount = `The smallest donation we can record is ${formatRupees(MIN_DONATION)}.`;
  }
  if (form.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = 'That email address does not look right yet.';
  }
  if (!/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))) {
    errors.phone = 'Please enter a 10-digit Indian mobile number.';
  }
  if (!form.termsAccepted) {
    errors.termsAccepted =
      'Please accept the Terms of Service and Privacy Policy to continue.';
  }
  return errors;
}

/* -------------------------------------------------------------------- */
/*  Shell                                                                */
/* -------------------------------------------------------------------- */

function Chrome() {
  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: EASE.out }}
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl md:px-10"
      aria-label="Support"
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
  );
}

/** A titled block inside the glass panel. */
function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/60 pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden="true"
          className="font-display text-sm tabular-nums text-primary"
        >
          {n}
        </span>
        <h2 className="font-display text-xl font-medium tracking-tight text-foreground md:text-2xl">
          {title}
        </h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';
const ghostButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

/* -------------------------------------------------------------------- */

export default function DonatePage() {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [outcome, setOutcome] = useState<DonationOutcome | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // The page paints its own dark ground while `body` stays marble. Any moment
  // the root is shorter than the visual viewport shows that marble as a pale
  // band; painting the same ground onto the document removes it. Same reason
  // as PassPage, same technique.
  const ground = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ground.current;
    if (!el) return;
    const { body } = document;
    const previous = body.style.backgroundColor;
    body.style.backgroundColor = getComputedStyle(el).backgroundColor;
    return () => {
      body.style.backgroundColor = previous;
    };
  }, []);

  // Each screen replaces the last in place, so without this the reader lands
  // part-way down whatever they had scrolled to on the previous one.
  useEffect(() => {
    if (step !== 'form') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const toReview = () => {
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      // Take the reader to the first thing that needs them.
      const first = document.querySelector('[aria-invalid="true"], [role="alert"]');
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setStep('review');
  };

  const confirm = async () => {
    setStep('processing');
    const intent: DonationIntent = {
      full_name: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.replace(/\s/g, ''),
      donor_type: form.donorType,
      organisation:
        form.donorType === 'corporate' && form.organisation.trim()
          ? form.organisation.trim()
          : null,
      amount: form.amount ?? 0,
      recognition_preference: form.recognition,
      marketing_opt_in: form.marketingOptIn,
      terms_accepted: true,
    };
    const result = await settleDonation(intent);
    setOutcome(result);
    // A failure returns to the review rather than dead-ending: everything the
    // reader typed is still in state and one more attempt costs one tap.
    setStep(result.ok ? 'done' : 'review');
  };

  return (
    <div
      ref={ground}
      className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.14),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>
      <Chrome />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-6 pb-[env(safe-area-inset-bottom)] pt-16 md:px-8">
        <header ref={headingRef} className="pb-10 pt-14 md:pt-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE.out }}
          >
            <GoldRule className="w-20" />
          </motion.div>
          <TextEffect
            as="h1"
            per="word"
            preset="fade-in-blur"
            delay={0.2}
            className="mt-7 font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl"
          >
            Support Flash
          </TextEffect>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55, ease: EASE.out }}
            className="mt-6 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Support the mission of Flash @ Brigade and help create meaningful
            opportunities for underprivileged children through education and
            healthcare initiatives.
          </motion.p>
        </header>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: EASE.out }}
              onSubmit={(event) => {
                event.preventDefault();
                toReview();
              }}
              noValidate
              className="liquid-glass mb-16 space-y-8 rounded-xl border border-white/10 p-6 md:p-10"
            >
              <Section n="01" title="Your donation">
                <AmountField
                  value={form.amount}
                  custom={form.custom}
                  error={errors.amount}
                  onSelect={(amount) => set('amount', amount)}
                  onCustom={(raw) => {
                    setForm((f) => ({
                      ...f,
                      custom: raw,
                      // Clearing the field clears the amount rather than
                      // silently reverting to whichever preset was last on.
                      amount: raw === '' ? null : Number(raw),
                    }));
                    setErrors((e) => ({ ...e, amount: undefined }));
                  }}
                />
                <div className="mt-6">
                  <RadioPills
                    legend="Donation type"
                    name="donor-type"
                    options={DONOR_TYPES}
                    value={form.donorType}
                    onChange={(v) => set('donorType', v as Form['donorType'])}
                    columns={4}
                  />
                </div>
              </Section>

              <Section n="02" title="Your details">
                <div className="space-y-1">
                  <FloatingInput
                    id="donor-name"
                    label="Full name"
                    value={form.fullName}
                    onChange={(v) => set('fullName', v)}
                    error={errors.fullName}
                    autoComplete="name"
                    maxLength={120}
                  />
                  <FloatingInput
                    id="donor-email"
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
                    id="donor-phone"
                    label="Mobile number"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(v) => set('phone', v)}
                    error={errors.phone}
                    autoComplete="tel"
                    maxLength={16}
                  />
                  {/* Corporate only. Animated on its own height so the panel
                      does not jump when the donor type changes. */}
                  <AnimatePresence initial={false}>
                    {form.donorType === 'corporate' && (
                      <motion.div
                        key="organisation"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: EASE.out }}
                        className="overflow-hidden"
                      >
                        <FloatingInput
                          id="donor-organisation"
                          label="Organisation / Company"
                          value={form.organisation}
                          onChange={(v) => set('organisation', v)}
                          hint="Optional."
                          autoComplete="organization"
                          maxLength={160}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Section>

              <Section n="03" title="Recognition">
                <RadioPills
                  legend="Recognition preference"
                  name="recognition"
                  options={RECOGNITION}
                  value={form.recognition}
                  onChange={(v) => set('recognition', v as Form['recognition'])}
                  columns={2}
                />
                <p className="font-body text-xs leading-relaxed text-muted-foreground">
                  {form.recognition === 'anonymous'
                    ? 'Your name will not appear in any public acknowledgement of donors. We will still use it on your receipt and to contact you.'
                    : 'Your name may appear where donors are thanked publicly. Choose Anonymous if you would rather it did not.'}
                </p>
              </Section>

              <Section n="04" title="Stay connected">
                <Consent
                  id="donor-marketing"
                  checked={form.marketingOptIn}
                  onChange={(v) => set('marketingOptIn', v)}
                >
                  Keep me informed about Flash @ Brigade updates.
                </Consent>
              </Section>

              <Section n="05" title="Consent">
                <Consent
                  id="donor-terms"
                  checked={form.termsAccepted}
                  onChange={(v) => set('termsAccepted', v)}
                  error={errors.termsAccepted}
                >
                  I have read and agree to the{' '}
                  <Link
                    to="/terms"
                    className="text-primary underline underline-offset-4 hover:brightness-110"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy"
                    className="text-primary underline underline-offset-4 hover:brightness-110"
                  >
                    Privacy Policy
                  </Link>
                  .
                </Consent>
              </Section>

              <div className="flex justify-end pt-2">
                <button type="submit" className={primaryButton}>
                  Continue
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </motion.form>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: EASE.out }}
              className="liquid-glass mb-16 rounded-xl border border-white/10 p-6 md:p-10"
            >
              <p className="font-body text-2xs font-semibold uppercase tracking-[0.22em] text-primary">
                Review
              </p>
              <h2 className="mt-4 font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
                Before we record it
              </h2>

              <dl className="mt-8 divide-y divide-border/60 border-y border-border/60">
                {[
                  ['Donation amount', formatRupees(form.amount ?? 0)],
                  [
                    'Donation type',
                    DONOR_TYPES.find((d) => d.value === form.donorType)?.label ??
                      '',
                  ],
                  ...(form.donorType === 'corporate' && form.organisation.trim()
                    ? ([['Organisation', form.organisation.trim()]] as const)
                    : []),
                  ['Full name', form.fullName.trim()],
                  ['Email', form.email.trim().toLowerCase()],
                  [
                    'Recognition',
                    RECOGNITION.find((r) => r.value === form.recognition)
                      ?.label ?? '',
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <dt className="font-body text-sm text-muted-foreground">
                      {label}
                    </dt>
                    <dd
                      className={cn(
                        'font-body text-base text-foreground sm:text-right',
                        label === 'Donation amount' &&
                          'font-display text-2xl font-medium tracking-tight text-primary'
                      )}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {outcome && !outcome.ok && (
                <p
                  role="alert"
                  className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 font-body text-sm text-foreground"
                >
                  {outcome.error}
                </p>
              )}

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className={ghostButton}
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void confirm()}
                  className={primaryButton}
                >
                  Confirm donation
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: EASE.out }}
              className="liquid-glass mb-16 rounded-xl border border-white/10 p-10 text-center md:p-16"
              role="status"
              aria-live="polite"
            >
              <span
                aria-hidden="true"
                className="mx-auto block h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
              />
              <p className="mt-8 font-display text-2xl italic text-foreground">
                Recording your donation
              </p>
              <p className="mx-auto mt-3 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
                One moment. Please do not close this page.
              </p>
            </motion.div>
          )}

          {step === 'done' && outcome?.ok && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE.out }}
              className="liquid-glass mb-16 rounded-xl border border-white/10 p-8 text-center md:p-12"
            >
              <motion.span
                aria-hidden="true"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: EASE.out }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary"
              >
                {PAYMENTS_LIVE ? (
                  <Check className="h-7 w-7" />
                ) : (
                  <Heart className="h-7 w-7" />
                )}
              </motion.span>

              <h2 className="mt-8 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
                Thank you
              </h2>
              <p className="mx-auto mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
                {form.fullName.trim().split(' ')[0]}, thank you for choosing to
                support {formatRupees(form.amount ?? 0)} towards the education
                and healthcare of children who need it.
              </p>

              {/* Reads the outcome rather than assuming. The day a gateway is
                  wired in, `settled` comes back true and this paragraph
                  changes on its own. */}
              {!outcome.settled && (
                <p className="mx-auto mt-6 max-w-md rounded-lg border border-border/70 bg-background/40 px-5 py-4 font-body text-sm leading-relaxed text-muted-foreground">
                  Payment integration is currently under development. Your
                  donation intent has been recorded and the team will contact
                  you when online donations become available.
                </p>
              )}

              {outcome.reference && (
                <p className="mt-6 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Reference{' '}
                  <span className="text-foreground">
                    {outcome.reference.slice(0, 8)}
                  </span>
                </p>
              )}

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/" className={ghostButton}>
                  Return home
                </Link>
                <Link to="/get-passes" className={primaryButton}>
                  Get passes
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
