import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { GoldRule, Grain } from '../materials';
import { FormChrome, FormSection } from '../forms/FormShell';
import {
  ghostButton,
  primaryButton,
  useOwnGround,
} from '../forms/formStyles';
import {
  Consent,
  FloatingInput,
  FloatingSelect,
  FloatingTextarea,
} from '../getpasses/fields';
import { DocumentField } from '../forms/DocumentField';
import { uploadDocument, uploadMessage } from '../forms/uploadDocument';
import type { UploadedDocument } from '../forms/uploadDocument';
import { formatRupees } from '@/utils/money';

/**
 * /partner-interest, the sponsor Expression of Interest.
 *
 * Three screens on one route (form, sending, done) rather than three routes,
 * for the same reasons /donate is: a half-filled approach is not something
 * anyone should land on from a bookmark, and everything typed has to survive
 * a failed submit.
 *
 * Built entirely from pieces that already existed: the Get Passes field
 * primitives, the shared form chrome, the evening ground, so it reads as the
 * same site as Donate and Get Passes without any of it being reimplemented
 * here. What is specific to this page is the QUESTIONS, which is as it should
 * be: nothing else about it is new.
 */

type Step = 'form' | 'sending' | 'done';

const ORGANISATION_TYPES = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'small-business', label: 'Small Business' },
  { value: 'educational', label: 'Educational Institution' },
  { value: 'ngo', label: 'NGO' },
  { value: 'startup', label: 'Startup' },
  { value: 'individual', label: 'Individual' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * The real structure Flash @ Brigade sponsors under, mirrored from
 * `SPONSORSHIP_INTERESTS` in api/partner-interest.ts. Not tiers, and
 * deliberately not Gold/Silver/Bronze.
 */
const SPONSORSHIP_INTERESTS = [
  { value: 'powered-by', label: 'Powered By · title partner' },
  { value: 'co-powered-by', label: 'Co-powered By · supporting partner' },
  { value: 'event-organised-by', label: 'Event Organised By · event partner' },
  { value: 'undecided', label: 'Not sure yet, talk it through with us' },
] as const;

type Form = {
  organisationName: string;
  contactPerson: string;
  designation: string;
  website: string;
  organisationType: string;
  email: string;
  mobile: string;
  officePhone: string;
  sponsorshipInterest: string;
  estimatedValue: string;
  proposal: string;
  marketingOptIn: boolean;
  privacyAccepted: boolean;
};

type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = {
  organisationName: '',
  contactPerson: '',
  designation: '',
  website: '',
  organisationType: '',
  email: '',
  mobile: '',
  officePhone: '',
  sponsorshipInterest: '',
  estimatedValue: '',
  proposal: '',
  marketingOptIn: false,
  privacyAccepted: false,
};

/**
 * The client's copy of the server's rules. The server re-validates every one
 * of these and is the authority; this exists so nobody waits for a round trip
 * to be told they left the organisation name blank.
 */
function validate(form: Form): Errors {
  const errors: Errors = {};

  if (form.organisationName.trim().length < 2) {
    errors.organisationName = 'Please tell us the organisation’s name.';
  }
  if (form.contactPerson.trim().length < 2) {
    errors.contactPerson = 'Please tell us who we should speak to.';
  }
  if (!form.organisationType) {
    errors.organisationType = 'Please choose the kind of organisation.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = 'That email address does not look right yet.';
  }
  const mobile = form.mobile.replace(/[\s-]/g, '');
  if (!/^(\+?91)?[6-9]\d{9}$/.test(mobile)) {
    errors.mobile = 'Please enter a 10-digit Indian mobile number.';
  }
  const office = form.officePhone.replace(/\s/g, '');
  if (office && !/^[+\d][\d\-()]{5,23}$/.test(office)) {
    errors.officePhone = 'That office number does not look right.';
  }
  if (!form.sponsorshipInterest) {
    errors.sponsorshipInterest = 'Please choose which partnership interests you.';
  }
  // Required now, and validated on the VALUE rather than on the string: an
  // estimate written as "5,00,000" or "₹5 lakh" is a real answer, and only a
  // field with no digits in it at all is a blank one.
  if (!/\d/.test(form.estimatedValue)) {
    errors.estimatedValue =
      'Please give a rough figure. An estimate is enough.';
  }
  if (form.proposal.trim().length < 10) {
    errors.proposal = 'Please tell us a little about what you have in mind.';
  }
  if (!form.privacyAccepted) {
    errors.privacyAccepted = 'Please accept the Privacy Policy to continue.';
  }
  return errors;
}

/** Digits only, so "5,00,000" and "₹5 lakh" both read as a number to show back. */
function valuePreview(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? formatRupees(parsed)
    : null;
}

/* -------------------------------------------------------------------- */

export default function PartnerInterestPage() {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const ground = useOwnGround();

  /* The attachment. Held as a File until submit — see DocumentField for why
     it is not uploaded the moment it is chosen. `progress` is null except
     while bytes are actually moving. */
  const [document_, setDocument] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Guards the one thing a form like this must never do twice. `step` alone
  // is not enough: the click that starts the request and the click that
  // lands a millisecond later both see `step === 'form'`.
  const inFlight = useRef(false);

  /** The object already in the bucket, so a retry does not upload it again. */
  const uploaded = useRef<{ file: File; doc: UploadedDocument } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Each screen replaces the last in place, so without this the reader lands
  // part-way down whatever they had scrolled to on the previous one.
  useEffect(() => {
    if (step !== 'form') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const submit = async () => {
    if (inFlight.current) return;
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      const first = document.querySelector(
        '[aria-invalid="true"], [role="alert"]'
      );
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    inFlight.current = true;
    setFailure(null);
    setStep('sending');
    try {
      /* THE FILE GOES FIRST. The row is the record, and a record that names
         an attachment nobody can open is worse than one with no attachment:
         so if the upload fails, nothing is submitted and everything typed is
         still on the form. */
      let attached: UploadedDocument | null = null;
      if (document_) {
        // A submit that failed AFTER the file landed must not send it twice
        // on the retry: that is a second 10 MB upload for the sender and a
        // second object in the bucket for us, and the first one is already
        // exactly what we want. Identity on the File is the right key —
        // choosing a different document produces a different object.
        if (uploaded.current?.file === document_) {
          attached = uploaded.current.doc;
        } else {
          try {
            setProgress(0);
            attached = await uploadDocument(document_, setProgress);
            uploaded.current = { file: document_, doc: attached };
          } catch (cause) {
            setDocumentError(uploadMessage(cause));
            setProgress(null);
            setStep('form');
            return;
          }
        }
      }

      const response = await fetch('/api/partner-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation_name: form.organisationName.trim(),
          contact_person: form.contactPerson.trim(),
          designation: form.designation.trim() || null,
          organisation_type: form.organisationType,
          website: form.website.trim() || null,
          email: form.email.trim().toLowerCase(),
          mobile: form.mobile.replace(/[\s-]/g, ''),
          office_phone: form.officePhone.replace(/\s/g, '') || null,
          sponsorship_interest: form.sponsorshipInterest,
          estimated_value: form.estimatedValue.trim() || null,
          proposal: form.proposal.trim() || null,
          marketing_opt_in: form.marketingOptIn,
          privacy_accepted: true,
          document: attached,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        acknowledgement_sent?: boolean;
      } | null;

      if (!response.ok) {
        // Back to the form with everything still typed in it, and the
        // server's own sentence rather than a generic one. It is the only
        // thing that knows whether this was a bad address or too many tries.
        setFailure(data?.error ?? 'We could not send that just now.');
        setStep('form');
        return;
      }
      setAcknowledged(Boolean(data?.acknowledgement_sent));
      setStep('done');
    } catch {
      setFailure(
        'We could not reach the festival desk. Please check your connection and try again.'
      );
      setStep('form');
    } finally {
      inFlight.current = false;
    }
  };

  const startAnother = () => {
    setForm(EMPTY);
    setDocument(null);
    setDocumentError(null);
    setProgress(null);
    uploaded.current = null;
    setErrors({});
    setFailure(null);
    setStep('form');
  };

  const preview = valuePreview(form.estimatedValue);
  /** Bytes are still moving. Once they stop, the wait is the API call. */
  const uploading = progress !== null && progress < 1;

  return (
    <div
      ref={ground}
      className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.14),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>
      <FormChrome label="Partner with Flash" />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-6 pb-[env(safe-area-inset-bottom)] pt-16 md:px-8">
        <header className="pb-10 pt-14 md:pt-20">
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
            Expression of Interest
          </TextEffect>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55, ease: EASE.out }}
            className="mt-6 max-w-xl font-body text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Tell us about your organisation and how you'd like to partner with
            Flash @ Brigade.
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
                void submit();
              }}
              noValidate
              className="liquid-glass mb-16 space-y-10 rounded-xl border border-white/10 p-6 md:p-10"
            >
              {failure && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 font-body text-sm text-foreground"
                >
                  {failure}
                </p>
              )}

              <FormSection n="01" title="Organisation">
                <div className="space-y-5">
                  <FloatingInput
                    id="organisationName"
                    label="Organisation name"
                    value={form.organisationName}
                    onChange={(v) => set('organisationName', v)}
                    error={errors.organisationName}
                    autoComplete="organization"
                    maxLength={160}
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FloatingInput
                      id="contactPerson"
                      label="Contact person"
                      value={form.contactPerson}
                      onChange={(v) => set('contactPerson', v)}
                      error={errors.contactPerson}
                      autoComplete="name"
                      maxLength={120}
                    />
                    <FloatingInput
                      id="designation"
                      label="Designation (optional)"
                      value={form.designation}
                      onChange={(v) => set('designation', v)}
                      autoComplete="organization-title"
                      maxLength={120}
                    />
                  </div>
                  <FloatingInput
                    id="website"
                    label="Organisation website (optional)"
                    value={form.website}
                    onChange={(v) => set('website', v)}
                    autoComplete="url"
                    maxLength={300}
                  />
                  <FloatingSelect
                    id="organisationType"
                    label="Organisation type"
                    value={form.organisationType}
                    onChange={(v) => set('organisationType', v)}
                    error={errors.organisationType}
                    options={ORGANISATION_TYPES.map((t) => ({
                      value: t.value,
                      label: t.label,
                    }))}
                  />
                </div>
              </FormSection>

              <FormSection n="02" title="Contact details">
                <div className="space-y-5">
                  <FloatingInput
                    id="email"
                    label="Email address"
                    type="email"
                    value={form.email}
                    onChange={(v) => set('email', v)}
                    error={errors.email}
                    autoComplete="email"
                    inputMode="email"
                    maxLength={160}
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FloatingInput
                      id="mobile"
                      label="Mobile number"
                      type="tel"
                      value={form.mobile}
                      onChange={(v) => set('mobile', v)}
                      error={errors.mobile}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={16}
                    />
                    <FloatingInput
                      id="officePhone"
                      label="Office number (optional)"
                      type="tel"
                      value={form.officePhone}
                      onChange={(v) => set('officePhone', v)}
                      error={errors.officePhone}
                      autoComplete="tel-national"
                      inputMode="tel"
                      maxLength={24}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection n="03" title="Sponsorship interest">
                <div className="space-y-5">
                  <FloatingSelect
                    id="sponsorshipInterest"
                    label="What kind of partnership?"
                    value={form.sponsorshipInterest}
                    onChange={(v) => set('sponsorshipInterest', v)}
                    error={errors.sponsorshipInterest}
                    options={SPONSORSHIP_INTERESTS.map((s) => ({
                      value: s.value,
                      label: s.label,
                    }))}
                  />
                  <FloatingInput
                    id="estimatedValue"
                    label="Estimated sponsorship value"
                    value={form.estimatedValue}
                    onChange={(v) => set('estimatedValue', v)}
                    inputMode="numeric"
                    maxLength={20}
                    error={errors.estimatedValue}
                    hint={preview ? `We will read that as ${preview}.` : undefined}
                  />
                  <FloatingTextarea
                    id="proposal"
                    label="Message or proposal"
                    value={form.proposal}
                    onChange={(v) => set('proposal', v)}
                    maxLength={4000}
                    rows={7}
                    error={errors.proposal}
                  />
                </div>
              </FormSection>

              <FormSection n="04" title="Additional information">
                <p className="font-body text-sm leading-relaxed text-muted-foreground">
                  If you have something that would help us understand your
                  organisation, we would like to see it. A company profile, an
                  organisation brochure, a sponsorship deck, a capability
                  statement, a corporate presentation, or anything similar.
                </p>
                <div className="mt-5">
                  <DocumentField
                    file={document_}
                    onChange={setDocument}
                    error={documentError ?? undefined}
                    onError={setDocumentError}
                  />
                </div>

                <div className="mt-6 space-y-3">
                  <Consent
                    id="marketingOptIn"
                    checked={form.marketingOptIn}
                    onChange={(v) => set('marketingOptIn', v)}
                  >
                    Keep me informed about Flash @ Brigade updates.
                  </Consent>
                  <Consent
                    id="privacyAccepted"
                    checked={form.privacyAccepted}
                    onChange={(v) => set('privacyAccepted', v)}
                    error={errors.privacyAccepted}
                  >
                    I have read and agree to the{' '}
                    <Link
                      to="/privacy"
                      className="text-primary underline underline-offset-4"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </Consent>
                </div>
              </FormSection>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Link to="/partners" className={ghostButton}>
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Back to Partners
                </Link>
                <button type="submit" className={primaryButton}>
                  Submit Expression of Interest
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </motion.form>
          )}

          {step === 'sending' && (
            <motion.div
              key="sending"
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
                {uploading ? 'Sending your document' : 'Sending it to the desk'}
              </p>
              <p className="mx-auto mt-3 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
                One moment. Please do not close this page.
              </p>

              {/* REAL BYTES ON THE WIRE, not a spinner pretending to be one.
                  A 10 MB deck on a mobile connection takes long enough that a
                  screen which only says "one moment" reads as frozen. */}
              {uploading && document_ && (
                <div className="mx-auto mt-8 max-w-sm">
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round((progress ?? 0) * 100)}
                    aria-label={`Uploading ${document_.name}`}
                    className="h-1 overflow-hidden rounded-full bg-foreground/10"
                  >
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={false}
                      animate={{ width: `${Math.max(4, (progress ?? 0) * 100)}%` }}
                      transition={{ duration: 0.3, ease: EASE.out }}
                    />
                  </div>
                  <p className="mt-3 truncate font-body text-xs text-muted-foreground">
                    {document_.name} · {Math.round((progress ?? 0) * 100)}%
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {step === 'done' && (
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
                <Check className="h-7 w-7" />
              </motion.span>

              <h2 className="mt-8 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
                Expression of Interest submitted
              </h2>
              <p className="mx-auto mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground">
                Thank you for your interest in partnering with Flash @ Brigade.
                {/* Reads what the server actually did. Promising a
                    confirmation email that Resend never sent would be the one
                    lie this screen can tell. */}
                {acknowledged
                  ? ' We’ve sent a confirmation email and will contact you soon.'
                  : ' A member of the organising team will contact you soon.'}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/" className={ghostButton}>
                  Return home
                </Link>
                <button
                  type="button"
                  onClick={startAnother}
                  className={primaryButton}
                >
                  Submit another Expression
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
