import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';
import { PassCard } from './PassCard';
import {
  FloatingInput,
  FloatingTextarea,
  PassStepper,
  RadioPills,
} from './fields';

const VISITOR_TYPES = [
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'guest', label: 'Guest' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'other', label: 'Other' },
] as const;

// Per-visitor-type pass ceilings. Mirrors PASS_LIMITS in api/_shared.ts;
// the server re-validates and never trusts these.
const PASS_LIMITS: Record<string, number> = {
  student: 1,
  parent: 2,
  guest: 2,
  alumni: 1,
  faculty: 5,
  other: 3,
};

const STEPS = ['Visitor', 'Booking', 'Details', 'Confirm'] as const;

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  passes: number;
  visitorType: string;
  accessibility: string;
  comments: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  fullName: '',
  email: '',
  phone: '',
  passes: 1,
  visitorType: '',
  accessibility: '',
  comments: '',
};

function validateStep(step: number, form: FormState): Errors {
  const errors: Errors = {};
  if (step === 0) {
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
    if (!VISITOR_TYPES.some((t) => t.value === form.visitorType)) {
      errors.visitorType = 'Choose the option that fits you best.';
    } else {
      const limit = PASS_LIMITS[form.visitorType] ?? 1;
      if (form.passes < 1 || form.passes > limit) {
        errors.passes = `Up to ${limit} ${limit === 1 ? 'pass' : 'passes'} for this visitor type.`;
      }
    }
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
} | null;

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string }
  | { phase: 'duplicate'; message: string }
  | { phase: 'success'; pass: MintedPass };

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
      {/* Below sm the four labels form a deliberate 2×2 grid — the form's
          inner width (224px at a 320px viewport) cannot seat them on one
          line at any legible size — and the counter goes screen-reader
          only. Desktop keeps its original single rail untouched. */}
      <div className="flex items-baseline justify-between gap-3">
        <ol
          className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:flex sm:gap-x-5"
          aria-label="Registration steps"
        >
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={
                'font-body text-2xs uppercase tracking-[0.12em] transition-colors duration-300 sm:text-xs sm:tracking-[0.18em] ' +
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

function SuccessView({ pass, form }: { pass: MintedPass; form: FormState }) {
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
        {pass
          ? 'Your digital pass is below. Show its code at the gate on 14 November; the organising committee will write only if anything needs attention.'
          : 'Your passes will be waiting at the main gate on 14 November. The organising committee will write to you only if anything about your booking needs attention.'}
      </motion.p>

      {pass && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.6, ease: EASE.out }}
          className="mt-10 w-full"
        >
          <PassCard
            pass={{
              token: pass.token,
              reference: pass.reference,
              status: 'valid',
              guestName: form.fullName.trim(),
              visitorType: form.visitorType,
              numberOfPasses: form.passes,
            }}
          />
          <p className="mx-auto mt-5 max-w-sm font-body text-xs leading-relaxed text-muted-foreground">
            Keep your{' '}
            <Link
              to={`/pass/${pass.token}`}
              className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary"
            >
              pass link
            </Link>{' '}
            safe. If you lose it, you can retrieve the pass anytime with your
            email and mobile number.
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: pass ? 2.0 : 1.5, ease: EASE.out }}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
      >
        {pass && (
          <Link
            to={`/pass/${pass.token}`}
            className="inline-flex items-center rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View QR Pass
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

export default function GetPassesPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });

  // Bring the pass fully into view once it is minted.
  useEffect(() => {
    if (submit.phase === 'success') window.scrollTo({ top: 0 });
  }, [submit.phase]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

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
          number_of_passes: form.passes,
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

    if (response.status === 409) {
      setSubmit({
        phase: 'duplicate',
        message:
          data?.error ??
          'We already have a recent registration for this email address.',
      });
      return;
    }
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
      return;
    }
    setSubmit({ phase: 'success', pass: data?.pass ?? null });
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
        {/* Hero */}
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
            A minute of your time helps the student committee plan gates,
            seating and the mercato for the right crowd, so the day feels
            effortless for everyone.
          </motion.p>
        </header>

        {/* Form panel */}
        <motion.section
          aria-label="Pass registration form"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE.out }}
          className="liquid-glass mb-16 rounded-xl border border-white/10 p-6 md:p-10"
        >
          {submit.phase === 'success' ? (
            <SuccessView pass={submit.pass} form={form} />
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
                      </div>
                    )}

                    {step === 1 && (
                      <div className="space-y-8">
                        <h2 className="font-display text-2xl font-medium text-foreground">
                          Booking details
                        </h2>
                        <RadioPills
                          legend="I am a"
                          name="visitorType"
                          options={VISITOR_TYPES}
                          value={form.visitorType}
                          onChange={(v) => {
                            set('visitorType', v);
                            // Clamp into the new ceiling when switching type.
                            const limit = PASS_LIMITS[v] ?? 1;
                            if (form.passes > limit) set('passes', limit);
                          }}
                          error={errors.visitorType}
                        />
                        {form.visitorType ? (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: EASE.out }}
                          >
                            <PassStepper
                              label="Number of passes"
                              value={form.passes}
                              onChange={(v) => set('passes', v)}
                              max={PASS_LIMITS[form.visitorType] ?? 1}
                            />
                          </motion.div>
                        ) : null}
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

                        {(submit.phase === 'error' ||
                          submit.phase === 'duplicate') && (
                          <div
                            role="alert"
                            className={
                              'mt-6 rounded-lg border px-4 py-3 font-body text-sm ' +
                              (submit.phase === 'duplicate'
                                ? 'border-accent/50 text-foreground'
                                : 'border-destructive/60 text-foreground')
                            }
                          >
                            {submit.phase === 'duplicate' ? (
                              <>
                                A pass has already been issued for this
                                attendee. Please use{' '}
                                <Link
                                  to="/pass"
                                  className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  Retrieve your Pass
                                </Link>{' '}
                                if you cannot find it. If you'd like to reserve
                                more passes, contact the{' '}
                                <Link
                                  to="/#contact"
                                  className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  Front Desk
                                </Link>
                                .
                              </>
                            ) : (
                              <>
                                {submit.message}
                                <span className="block pt-1 text-muted-foreground">
                                  Nothing was lost. You can try again below.
                                </span>
                              </>
                            )}
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
                      disabled={
                        submit.phase === 'submitting' ||
                        submit.phase === 'duplicate'
                      }
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

        {submit.phase !== 'success' && (
          <p className="-mt-10 mb-16 text-center font-body text-xs text-muted-foreground">
            Already registered?{' '}
            <Link
              to="/pass"
              className="text-foreground underline decoration-accent/60 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retrieve your pass
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
