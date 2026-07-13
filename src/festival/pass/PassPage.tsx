import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { TextEffect } from '@/components/motion/text-effect';
import { EASE } from '@/utils/motion';
import { Grain } from '../materials';
import { CarnivalMark } from '../CarnivalMark';
import { PassCard, type PassData } from '../getpasses/PassCard';
import { FloatingInput } from '../getpasses/fields';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; pass: PassData; checkedInAt: string | null }
  | { phase: 'missing' }
  | { phase: 'error'; message: string };

function Chrome() {
  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: EASE.out }}
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-6 backdrop-blur-xl md:px-10"
      aria-label="Pass"
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,hsl(var(--accent)/0.14),transparent_70%)]" />
        <Grain className="opacity-[0.04]" />
      </div>
      <Chrome />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-6 pt-16 md:px-8">
        {children}
      </div>
    </div>
  );
}

function RetrieveForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !phone.trim()) {
      setError(
        'Enter both the email address and the mobile number you registered with.'
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\s/g, ''),
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.token) {
        navigate(`/pass/${data.token}`);
        return;
      }
      setError(
        data?.error ??
          'If those details match a registration, the pass is shown here. Please check them and try again.'
      );
    } catch {
      setError('The pass service is unreachable right now. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: EASE.out }}
      onSubmit={submit}
      className="liquid-glass mb-16 rounded-xl border border-white/10 p-6 md:p-10"
      noValidate
    >
      <div className="space-y-1">
        <FloatingInput
          id="retrieve-email"
          label="Email address"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          maxLength={160}
        />
        <FloatingInput
          id="retrieve-phone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          maxLength={16}
          hint="The details you registered with."
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 font-body text-sm text-muted-foreground">
          {error}
        </p>
      )}
      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
            />
          )}
          {busy ? 'Looking' : 'Find my pass'}
        </button>
      </div>
    </motion.form>
  );
}

export default function PassPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setState({ phase: 'loading' });
      try {
        const response = await fetch(
          `/api/pass?token=${encodeURIComponent(token)}`
        );
        if (response.status === 404 || response.status === 422) {
          if (!cancelled) setState({ phase: 'missing' });
          return;
        }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (cancelled) return;
        setState({
          phase: 'ready',
          checkedInAt: data.pass.checked_in_at ?? null,
          pass: {
            token,
            reference: data.pass.reference,
            status: data.pass.status,
            guestName: data.pass.guest.name,
            visitorType: data.pass.guest.visitor_type,
            numberOfPasses: data.pass.guest.number_of_passes,
          },
        });
      } catch {
        if (!cancelled) {
          setState({
            phase: 'error',
            message: 'The pass service is unreachable right now.',
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Shell>
      <header className="pb-10 pt-14 md:pt-20">
        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.2}
          className="font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl"
        >
          Your Pass
        </TextEffect>
        {!token && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: EASE.out }}
            className="mt-5 max-w-md font-body text-base leading-relaxed text-muted-foreground"
          >
            Enter the email address and mobile number you registered with, and
            we will bring your pass back.
          </motion.p>
        )}
      </header>

      {!token ? (
        <RetrieveForm />
      ) : state.phase === 'loading' ? (
        <div
          className="mx-auto mb-16 h-[480px] w-full max-w-sm animate-pulse rounded-xl border border-border bg-card"
          aria-label="Loading pass"
        />
      ) : state.phase === 'ready' ? (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE.out }}
          className="mb-16"
        >
          <PassCard pass={state.pass} />
          {state.pass.status === 'checked_in' && state.checkedInAt && (
            <p className="mt-4 text-center font-body text-xs text-muted-foreground">
              Checked in at{' '}
              {new Date(state.checkedInAt).toLocaleString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </motion.div>
      ) : (
        <div className="liquid-glass mb-16 rounded-xl border border-white/10 p-8 text-center md:p-10">
          <p className="font-display text-2xl italic text-foreground">
            {state.phase === 'missing'
              ? 'No pass matches this link.'
              : 'The pass service is unreachable right now.'}
          </p>
          <p className="mx-auto mt-3 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
            {state.phase === 'missing'
              ? 'Links change when a pass is re-retrieved. You can fetch the current one with your registration details.'
              : 'Nothing is lost. Please try again in a moment.'}
          </p>
          <Link
            to="/pass"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3.5 font-body text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retrieve my pass
          </Link>
        </div>
      )}
    </Shell>
  );
}
