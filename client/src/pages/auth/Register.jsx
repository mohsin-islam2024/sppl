import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth.js';
import SEO from '../../components/common/SEO.jsx';
import logo from '/logos/sppl-logo.png';

const fieldClass =
  'w-full rounded-lg border border-surface-border bg-surface-raised px-3.5 py-2.5 text-sm text-content-primary placeholder:text-content-muted transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';
const labelClass = 'mb-1.5 block text-sm font-medium text-content-secondary';
const errorClass = 'mt-1.5 text-xs font-medium text-live';

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    email: z.string().min(1, 'required').email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Registration.
 *
 * A new account is always role USER — player, scorer and admin roles are assigned
 * by an administrator afterwards, and the server rejects any attempt to set a role
 * from the client. That is why this form asks for nothing but identity.
 */
export default function Register() {
  const { t } = useTranslation();
  const { register: registerUser, signInGoogle } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const readableError = useCallback((error) => {
    const code = error?.code ?? '';
    if (code.includes('email-already-in-use')) {
      return 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে। / This email is already registered.';
    }
    if (code.includes('weak-password')) {
      return 'পাসওয়ার্ড আরও শক্তিশালী দিন। / Please choose a stronger password.';
    }
    if (code.includes('invalid-email')) {
      return 'ইমেইলটি সঠিক নয়। / That email address is not valid.';
    }
    if (code.includes('network')) {
      return 'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। / No internet connection.';
    }
    return error?.message ?? 'রেজিস্ট্রেশন করা যায়নি। / Could not create the account.';
  }, []);

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        remember: true,
      });
      setSuccess(true);
    } catch (error) {
      setFormError(readableError(error));
    }
  };

  const onGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInGoogle({ remember: true });
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(readableError(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <SEO title={t('auth.registerTitle')} path="/register" noIndex />
        <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
          <div className="card w-full max-w-md p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-win/15 text-2xl">
              ✓
            </div>
            <h1 className="mt-4 font-display text-xl font-bold text-content-primary">
              অ্যাকাউন্ট তৈরি হয়েছে
            </h1>
            <p className="mt-2 text-sm text-content-secondary">
              আপনার ইমেইলে একটি যাচাইকরণ লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে ইমেইল যাচাই করে নিন।
            </p>
            <p className="mt-1 text-xs text-content-muted">
              A verification link has been sent to your email. It does not block browsing the
              site.
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="mt-6 w-full rounded-pill bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              {t('nav.home')}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title={t('auth.registerTitle')} path="/register" noIndex />

      <div className="container-page flex min-h-[75vh] items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src={logo} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
            <h1 className="mt-4 font-display text-2xl font-extrabold text-content-primary">
              {t('auth.registerTitle')}
            </h1>
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
                <label htmlFor="name" className={labelClass}>
                  {t('auth.name')}
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.name)}
                  {...register('name')}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                {errors.password && <p className={errorClass}>{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  {t('auth.confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className={errorClass}>{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-pill bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
              >
                {isSubmitting ? t('common.loading') : t('nav.register')}
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
              className="w-full rounded-pill border border-surface-border py-3 text-sm font-semibold text-content-primary transition hover:bg-surface-sunken disabled:opacity-60"
            >
              {t('auth.loginWithGoogle')}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-content-muted">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-semibold text-brand-light hover:underline">
              {t('nav.login')}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
