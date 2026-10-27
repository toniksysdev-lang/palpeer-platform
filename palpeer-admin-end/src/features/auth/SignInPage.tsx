import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Badge } from '@/components/ui/Badge';
import { appConfig } from '@/config/env';
import { ApiClientError } from '@/types/api';
import { loadRememberPreference, loadRememberedEmail } from '@/features/auth/session';
import { safeAdminRedirect } from '@/lib/safeRedirect';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean(),
});

export function SignInPage() {
  const { status, login, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const { mode, cycleMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeAdminRedirect((location.state as { from?: string } | null)?.from);

  const [email, setEmail] = useState(() => loadRememberedEmail() ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => loadRememberPreference());
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; mfaCode?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionExpiredMessage) {
      setFormError(sessionExpiredMessage);
    }
  }, [sessionExpiredMessage]);

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearSessionExpiredMessage();
    setFormError(null);

    if (mfaToken) {
      const code = mfaCode.trim().toUpperCase();
      const isTotp = /^\d{6}$/.test(code);
      const isRecovery = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
      if (!isTotp && !isRecovery) {
        setFieldErrors({
          mfaCode: 'Enter a 6-digit authenticator code or a recovery code (XXXX-XXXX).',
        });
        return;
      }
      setFieldErrors({});
      setSubmitting(true);
      try {
        await login({ email, password, remember, mfaToken, mfaCode: code });
        navigate(from, { replace: true });
      } catch (error) {
        if (error instanceof ApiClientError) {
          if (error.code === 'MFA_INVALID' || error.code === 'MFA_TOKEN_INVALID') {
            setFormError(error.message || 'Invalid authenticator code.');
          } else {
            setFormError(error.message);
          }
        } else {
          setFormError('Authentication failed. Please try again.');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const parsed = loginSchema.safeParse({ email, password, remember });
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'email' || key === 'password') {
          next[key] = issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await login(parsed.data);
      if (result?.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        setMfaCode('');
        setPassword('');
        return;
      }
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === 'USER_DISABLED') {
          setFormError('This account is locked or disabled.');
        } else if (error.code === 'NOT_ADMIN') {
          setFormError(error.message);
        } else if (error.code === 'NETWORK_ERROR') {
          setFormError(error.message);
        } else if (error.code === 'INVALID_CREDENTIALS') {
          setFormError('Invalid email or password.');
        } else if (error.code === 'ACCOUNT_LOCKED') {
          setFormError(error.message || 'Too many incorrect attempts. Try again later.');
        } else if (error.code === 'SESSION_ALREADY_ACTIVE') {
          setFormError(error.message);
        } else if (error.status === 401) {
          setFormError(error.message || 'Authentication failed. Please try again.');
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Authentication failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* Brand plane — full-bleed left */}
      <aside className="relative flex min-h-[38vh] flex-col justify-between overflow-hidden px-8 py-10 text-white sm:px-12 lg:min-h-screen lg:px-14 lg:py-12">
        <div aria-hidden className="absolute inset-0 auth-shell-bg" />
        <div
          aria-hidden
          className="auth-orb pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="auth-orb-delayed pointer-events-none absolute -right-16 bottom-8 h-80 w-80 rounded-full bg-[#7CBB15]/20 blur-3xl"
        />

        <div className="relative z-10 animate-auth-rise">
          <div className="inline-flex items-center rounded-[0.6rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(8,47,50,0.18)]">
            <img
              src="/palpeer-logo.png"
              alt="PALPEER"
              className="h-11 w-auto max-w-[180px] object-contain sm:h-12 sm:max-w-[200px]"
            />
          </div>
          <p className="mt-3 text-xs font-medium tracking-[0.18em] text-white/70 uppercase">
            Your Rate Your Way
          </p>
        </div>

        <div className="relative z-10 mt-10 max-w-md animate-auth-rise lg:mt-0" style={{ animationDelay: '80ms' }}>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Admin operations
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80 sm:text-[15px]">
            Secure console for users, compliance, rates, and financial activity across the Palpeer
            platform.
          </p>
        </div>

        <p className="relative z-10 mt-10 hidden text-xs text-white/55 lg:block">
          © {new Date().getFullYear()} PALPEER. All rights reserved.
        </p>
      </aside>

      {/* Form plane */}
      <main className="relative flex flex-col bg-surface px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <div className="mb-8 flex items-center justify-end gap-2 lg:absolute lg:right-10 lg:top-8">
          {appConfig.useMockApi ? <Badge tone="warning">Mock auth</Badge> : null}
          <button
            type="button"
            className="rounded-[0.6rem] border border-border bg-surface-secondary/60 px-3 py-1.5 text-xs font-medium text-text-secondary transition-smooth hover:border-primary/30 hover:text-primary"
            onClick={cycleMode}
          >
            Theme: {mode}
          </button>
        </div>

        <div className="auth-panel mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              {mfaToken ? 'Authenticator' : 'Sign in'}
            </p>
            <h2 className="mt-2 text-[1.65rem] font-semibold tracking-tight text-navy-800 dark:text-text-primary">
              {mfaToken ? 'Enter verification code' : 'Welcome back'}
            </h2>
            <p className="mt-1.5 text-sm text-text-muted">
              {mfaToken
                ? 'Enter the 6-digit authenticator code, or a one-time recovery code (XXXX-XXXX).'
                : 'Use your operator credentials to continue.'}
            </p>
          </div>

          {appConfig.useMockApi ? (
            <div className="mt-6 rounded-[0.6rem] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Mock mode: any email with password <code className="font-mono">admin</code> or{' '}
              <code className="font-mono">password</code>.
            </div>
          ) : null}

          {formError ? (
            <div
              className="mt-6 rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          {fieldErrors.email || fieldErrors.password || fieldErrors.mfaCode ? (
            <div
              className="mt-6 rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              role="alert"
            >
              {fieldErrors.email ?? fieldErrors.password ?? fieldErrors.mfaCode}
            </div>
          ) : null}

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
            {mfaToken ? (
              <div>
                <label
                  htmlFor="mfaCode"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-text-secondary"
                >
                  Authentication code
                </label>
                <input
                  id="mfaCode"
                  name="mfaCode"
                  type="text"
                  autoComplete="one-time-code"
                  maxLength={9}
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))
                  }
                  disabled={submitting || status === 'bootstrapping'}
                  className="input-field tracking-[0.2em]"
                  placeholder="000000 or XXXX-XXXX"
                  autoFocus
                />
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
                  onClick={() => {
                    setMfaToken(null);
                    setMfaCode('');
                    setFormError(null);
                  }}
                  disabled={submitting}
                >
                  Back to password
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-text-secondary"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting || status === 'bootstrapping'}
                    className="input-field"
                    placeholder="name@company.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-text-secondary"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting || status === 'bootstrapping'}
                      className="input-field pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700 focus:outline-none dark:hover:text-text-primary"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-text-secondary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500/30"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      disabled={submitting}
                    />
                    Remember session
                  </label>
                  <Link
                    to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                    className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
                  >
                    Forgot password?
                  </Link>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting || status === 'bootstrapping'}
              className="btn-primary mt-2 w-full py-3 text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {mfaToken ? 'Verifying...' : 'Signing in...'}
                </span>
              ) : mfaToken ? (
                'Verify and continue'
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-text-muted lg:text-left">
            Secure access to the Palpeer admin workspace
          </p>
        </div>
      </main>
    </div>
  );
}
