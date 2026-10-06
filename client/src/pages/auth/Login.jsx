import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth.js';
import SEO from '../../components/common/SEO.jsx';
import logo from '/logos/sppl-logo.png';

/**
 * Shared field styling. Kept as a constant rather than a component so the inputs
 * stay native elements — React Hook Form's register() works on the element, and a
 * wrapper would need forwardRef plumbing for no real gain.
 */
const fieldClass =
  'w-full rounded-lg border border-surface-border bg-surface-raised px-3.5 py-2.5 text-sm text-content-primary placeholder:text-content-muted transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

const labelClass = 'mb-1.5 block text-sm font-medium text-content-secondary';
const errorClass = 'mt-1.5 text-xs font-medium text-live';

const loginSchema = z.object({
  email: z.string().min(1, 'required').email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().default(true),
});

/**
 * Login page.
 *
 * Three entry points — email/password, Google, and password reset — because the
 * people who need this site are spread across devices and password habits. Errors
 * from Firebase are mapped to readable text rather than shown raw: "auth/invalid-credential"
 * means nothing to a player.
 */
export default function Login() {
  const { t } = useTranslation();
  const { signInEmail, signInGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formError, setFormError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  /** Return the user to wherever the protected route bounced them from. */
  const redirectTo = location.state?.from ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  /** Turn a Firebase error code into something a person can act on. */
  const readableError = useCallback((error) => {
    const code = error?.code ?? '';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) {
      return 'ইমেইল বা পাসওয়ার্ড ঠিক নয়। / Incorrect email or password.';
    }
    if (code.includes('user-not-found')) {
      return 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই। / No account found for this email.';
    }
    if (code.includes('too-many-requests')) {
      return 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার করুন। / Too many attempts, please wait.';
    }
    if (code.includes('network')) {
      return 'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। / No internet connection.';
    }
    if (code.includes('popup-closed-by-user')) {
      return 'গুগল লগইন বন্ধ করা হয়েছে। / Google sign-in was closed.';
    }
    if (code.includes('invalid-api-key') || code.includes('configuration')) {
      return 'Firebase কনফিগারেশন পাওয়া যায়নি। client/.env ফাইল দেখুন।';
    }
    return error?.message ?? 'লগইন করা যায়নি। / Could not sign in.';
  }, []);

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await signInEmail(values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(readableError(error));
    }
  };

  const onGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInGoogle({ remember: true });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(readableError(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <>
      <SEO title={t('auth.loginTitle')} path="/login" noIndex />

      <div className="container-page flex min-h-[75vh] items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src={logo} alt="" width={72} height={72} className="h-16 w-16 object-contain" />
            <h1 className="mt-4 font-display text-2xl font-extrabold text-content-primary">
              {t('auth.loginTitle')}
            </h1>
            <p className="mt-1 text-sm text-content-muted">
              {t('common.appFullName')} · {year}
            </p>
          </div>

          <div className="card p-6 sm:p-7">
            {formError && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-live/30 bg-live/10 px-3.5 py-3 text-sm text-live-light"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClass}>
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={fieldClass}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="email-error" className={errorClass}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="password" className={labelClass}>
                    {t('auth.password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-brand-light hover:underline"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={fieldClass}
                  {...register('password')}
                />
                {errors.password && (
                  <p id="password-error" className={errorClass}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-content-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-border text-brand focus:ring-brand"
                  {...register('remember')}
                />
                {t('auth.rememberMe')}
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-pill bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? t('common.loading') : t('auth.loginTitle')}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-surface-border" />
              <span className="text-2xs uppercase tracking-widest text-content-muted">or</span>
              <span className="h-px flex-1 bg-surface-border" />
            </div>

            <button
              type="button"
              onClick={onGoogle}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-pill border border-surface-border bg-surface-raised py-3 text-sm font-semibold text-content-primary transition hover:bg-surface-sunken disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
                />
              </svg>
              {t('auth.loginWithGoogle')}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-content-muted">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-semibold text-brand-light hover:underline">
              {t('nav.register')}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
