import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Send } from 'lucide-react';
import { EASE, REVEAL_VIEWPORT } from '@/utils/motion';
import { GoldRule } from '../materials';
import {
  Consent,
  FloatingInput,
  FloatingSelect,
  FloatingTextarea,
} from '../getpasses/fields';
import { Band, PageShell } from './PageShell';
import { CHAPTERS } from './chapters';

const chapter = CHAPTERS[4];

/**
 * /enquiry — the front desk.
 *
 * The form is INLINE, not a floating panel. Get Passes and Donate are tasks
 * you arrived to perform, so they get their own evening shell and a glass
 * card to work inside; this is a page you are reading that happens to end in
 * a way to reply. So it keeps the district's daylight chapter, its standard
 * hero and the same `Band` rhythm as every other informational page, and the
 * fields sit on the raised band the way body copy sits on the plain one. No
 * card, no border, no shadow.
 *
 * Everything else is shared: the fields are the Get Passes primitives, the
 * reveals are the site's own, and the success state replaces the form in
 * place rather than navigating anywhere.
 */

/** The words shown. Order is the brief's. */
const SUBJECT_LABELS = [
  'General Enquiry',
  'Passes',
  'Stall Booking',
  'Sponsorship',
  'Donations',
  'Technical Support',
  'Other',
] as const;

/** Label -> what the API and the column store. Mirrors SUBJECTS in api/enquiry.ts. */
const SUBJECT_VALUES: Record<(typeof SUBJECT_LABELS)[number], string> = {
  'General Enquiry': 'general',
  Passes: 'passes',
  'Stall Booking': 'stall-booking',
  Sponsorship: 'sponsorship',
  Donations: 'donations',
  'Technical Support': 'technical-support',
  Other: 'other',
};

/** What the page says it is for, in the order someone is likely to need it. */
const TOPICS = [
  { title: 'Passes', body: 'Booking, changing or retrieving a reservation.' },
  {
    title: 'Stall bookings',
    body: 'Running a stall at the mercato on the day.',
  },
  {
    title: 'Sponsorships',
    body: 'Organisations who want to back the carnival.',
  },
  { title: 'Donations', body: 'Giving to Passion with Compassion.' },
  {
    title: 'Technical support',
    body: 'Anything on this site that will not do what it should.',
  },
  {
    title: 'General enquiries',
    body: 'Timings, access, what to expect, anything else.',
  },
];

type Form = {
  fullName: string;
  email: string;
  mobile: string;
  subject: string;
  message: string;
  marketingOptIn: boolean;
  privacyAccepted: boolean;
};

const EMPTY: Form = {
  fullName: '',
  email: '',
  mobile: '',
  subject: '',
  message: '',
  marketingOptIn: false,
  privacyAccepted: false,
};

type Errors = Partial<Record<keyof Form, string>>;

/**
 * The same rules the API enforces, so the reader is told before a round trip.
 * The server revalidates everything and this is never trusted.
 */
function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = 'That email address does not look right yet.';
  }
  // Optional, but a wrong number is worse than none, because we would try it.
  if (
    form.mobile.trim() &&
    !/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(form.mobile.replace(/\s/g, ''))
  ) {
    errors.mobile =
      'Please enter a 10-digit Indian mobile number, or leave it blank.';
  }
  if (!form.subject) errors.subject = 'Choose what this is about.';
  if (form.message.trim().length < 10) {
    errors.message = 'Please write a little more so we can help properly.';
  }
  if (!form.privacyAccepted) {
    errors.privacyAccepted = 'Please accept the Privacy Policy to continue.';
  }
  return errors;
}

const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';
const ghostButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-body text-sm font-medium text-foreground transition-all duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

export default function EnquiryPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [sent, setSent] = useState<{ acknowledged: boolean } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The button is disabled while busy, but a second submit can still arrive
    // from the keyboard between renders. The API is idempotent for a repeated
    // message; this stops it ever having to be.
    if (busy) return;

    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      document
        .querySelector('[aria-invalid="true"], [role="alert"]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    setBusy(true);
    setFailure('');
    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          mobile: form.mobile.replace(/\s/g, '') || null,
          subject:
            SUBJECT_VALUES[form.subject as (typeof SUBJECT_LABELS)[number]],
          message: form.message.trim(),
          marketing_opt_in: form.marketingOptIn,
          privacy_accepted: true,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        acknowledgement_sent?: boolean;
      } | null;

      if (!response.ok) {
        setFailure(
          data?.error ??
            `The enquiry service failed (error ${response.status}). Nothing has been sent.`
        );
        return;
      }
      setSent({ acknowledged: data?.acknowledgement_sent === true });
    } catch {
      setFailure(
        'We could not reach the enquiry service. Please check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      chapter={chapter}
      eyebrow="Festival desk"
      title="Enquiry"
      lede="Whatever you need to ask about Flash @ Brigade 2026, this reaches the people running it."
      cover={{
        src: '/Enquiries.jpeg',
        alt: 'The reception at The Brigade School @ Malleswaram',
        // The band is far wider than the photograph's 4:3, so the crop keeps
        // the upper third: that is where the seagull sits, and it is the one
        // element of this picture anyone would recognise.
        position: 'center 18%',
      }}
    >
      {/* 01 · What this is for ------------------------------------- */}
      <Band>
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <GoldRule className="w-16" />
            <h2 className="mt-6 font-display text-3xl font-medium leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Ask us anything
            </h2>
            <p className="mt-5 font-body text-base leading-relaxed text-muted-foreground md:text-lg">
              One form, read by the organising team. If it is about the
              carnival it belongs here, and you will get a reply from a person
              rather than a queue number.
            </p>
          </div>

          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 md:col-span-6 md:col-start-7">
            {TOPICS.map((topic, i) => (
              <motion.li
                key={topic.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={REVEAL_VIEWPORT}
                transition={{ duration: 0.6, delay: i * 0.05, ease: EASE.out }}
              >
                <h3 className="font-body text-sm font-semibold text-foreground">
                  {topic.title}
                </h3>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-muted-foreground">
                  {topic.body}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </Band>

      {/* 02 · The form, inline ------------------------------------- */}
      <Band tone="raised">
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE.out }}
              className="mx-auto max-w-xl text-center"
            >
              <motion.span
                aria-hidden="true"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: EASE.out }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent"
              >
                <Check className="h-7 w-7" />
              </motion.span>
              <h2 className="mt-8 font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Enquiry received
              </h2>
              <p className="mx-auto mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
                Thank you for contacting Flash @ Brigade 2026.{' '}
                {/* Only promises a confirmation email when one actually went
                    out: the API reports whether it did. */}
                {sent.acknowledged
                  ? 'We have sent a confirmation email and will get back to you as soon as we can.'
                  : 'Your enquiry is with the team and we will get back to you as soon as we can.'}
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/" className={ghostButton}>
                  Return home
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setForm(EMPTY);
                    setErrors({});
                    setFailure('');
                    setSent(null);
                  }}
                  className={primaryButton}
                >
                  Submit another enquiry
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE.out }}
              className="grid gap-10 md:grid-cols-12 md:gap-16"
            >
              <div className="md:col-span-4">
                <h2 className="font-display text-3xl font-medium leading-[1.1] tracking-tight sm:text-4xl">
                  Write to us
                </h2>
                <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
                  We answer in the order enquiries arrive. If it is urgent and
                  close to the day, the phone numbers in the footer are faster.
                </p>
              </div>

              <form
                onSubmit={submit}
                noValidate
                className="md:col-span-8 md:col-start-5"
              >
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <FloatingInput
                    id="enquiry-name"
                    label="Full name"
                    value={form.fullName}
                    onChange={(v) => set('fullName', v)}
                    error={errors.fullName}
                    autoComplete="name"
                    maxLength={120}
                  />
                  <FloatingInput
                    id="enquiry-email"
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
                    id="enquiry-mobile"
                    label="Mobile number"
                    type="tel"
                    inputMode="tel"
                    value={form.mobile}
                    onChange={(v) => set('mobile', v)}
                    error={errors.mobile}
                    hint="Optional."
                    autoComplete="tel"
                    maxLength={16}
                  />
                  <FloatingSelect
                    id="enquiry-subject"
                    label="Subject"
                    value={form.subject}
                    onChange={(v) => set('subject', v)}
                    error={errors.subject}
                    options={SUBJECT_LABELS}
                  />
                </div>

                <FloatingTextarea
                  id="enquiry-message"
                  label="Message"
                  value={form.message}
                  onChange={(v) => set('message', v)}
                  error={errors.message}
                  rows={7}
                  maxLength={4000}
                  hint={`${form.message.length} of 4000 characters.`}
                />

                <div className="mt-6 space-y-4">
                  <Consent
                    id="enquiry-marketing"
                    checked={form.marketingOptIn}
                    onChange={(v) => set('marketingOptIn', v)}
                  >
                    Keep me informed about updates related to Flash @ Brigade.
                  </Consent>
                  <Consent
                    id="enquiry-privacy"
                    checked={form.privacyAccepted}
                    onChange={(v) => set('privacyAccepted', v)}
                    error={errors.privacyAccepted}
                  >
                    I have read and agree to the{' '}
                    <Link
                      to="/privacy"
                      className="text-accent underline underline-offset-4 hover:brightness-110"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </Consent>
                </div>

                {failure && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 font-body text-sm text-foreground"
                  >
                    {failure}
                  </p>
                )}

                <div className="mt-8 flex justify-end">
                  <button type="submit" disabled={busy} className={primaryButton}>
                    {busy && (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                      />
                    )}
                    {busy ? 'Sending' : 'Submit enquiry'}
                    {!busy && <Send aria-hidden="true" className="h-4 w-4" />}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </Band>
    </PageShell>
  );
}
