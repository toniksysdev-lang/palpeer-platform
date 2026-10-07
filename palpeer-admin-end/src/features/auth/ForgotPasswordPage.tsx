import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { appConfig } from '@/config/env';
import { confirmPasswordReset, requestPasswordReset } from '@/services/api/auth';
import { ApiClientError } from '@/types/api';

const requestSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

const confirmSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  code: z.string().trim().min(4, 'Enter the OTP code from email.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(8, 'Confirm your new password.'),
});

type Step = 'request' | 'confirm' | 'done';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = requestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email.');
      return;
    }
    setSubmitting(true);
    try {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        await requestPasswordReset(parsed.data.email);
      }
      setInfo(
        'If an account exists for that email, a reset code was sent. Enter the code and your new password.',
      );
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not request a password reset.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = confirmSchema.safeParse({ email, code, newPassword, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid form.');
      return;
    }
    if (parsed.data.newPassword !== parsed.data.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      if (appConfig.useMockApi) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        await confirmPasswordReset({
          email: parsed.data.email,
          code: parsed.data.code,
          newPassword: parsed.data.newPassword,
        });
      }
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="auth-panel w-full max-w-[420px] rounded-[0.6rem] border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              Password reset
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
              Recover access
            </h1>
          </div>
          {appConfig.useMockApi ? <Badge tone="warning">Mock</Badge> : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mb-4 rounded-[0.6rem] border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-text-secondary">
            {info}
          </div>
        ) : null}

        {step === 'request' ? (
          <form className="space-y-4" onSubmit={onRequest} noValidate>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">Email</span>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                autoComplete="email"
                placeholder="admin@example.com"
              />
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        ) : null}

        {step === 'confirm' ? (
          <form className="space-y-4" onSubmit={onConfirm} noValidate>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">Email</span>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">OTP code</span>
              <input
                className="input-field font-mono"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={submitting}
                autoComplete="one-time-code"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">New password</span>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={submitting}
                autoComplete="new-password"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-text-primary">Confirm password</span>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting ? 'Saving…' : 'Reset password'}
            </button>
            <button
              type="button"
              className="w-full text-sm text-primary hover:underline"
              onClick={() => setStep('request')}
            >
              Resend code
            </button>
          </form>
        ) : null}

        {step === 'done' ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Password updated. You can sign in with your new credentials.
            </p>
            <button type="button" className="btn-primary w-full py-3" onClick={() => navigate('/sign-in')}>
              Back to sign in
            </button>
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-text-muted">
          <Link to="/sign-in" className="text-primary hover:underline">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
