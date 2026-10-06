import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth.js';
import SEO from '../../components/common/SEO.jsx';

const fieldClass =
  'w-full rounded-lg border border-surface-border bg-surface-raised px-3.5 py-2.5 text-sm text-content-primary placeholder:text-content-muted transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';
const labelClass = 'mb-1.5 block text-sm font-medium text-content-secondary';
const errorClass = 'mt-1.5 text-xs font-medium text-live';

const schema = z.object({
  email: z.string().min(1, 'required').email('Enter a valid email'),
});

/**
 * Password reset.
 *
 * The confirmation message is deliberately identical whether or not the address is
 * registered — a different message would let anyone probe which emails have accounts.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = useCallback(
    async (values) => {
      setFormError(null);
      try {
        await resetPassword(values.email);
        setSent(true);
      } catch (error) {
        const code = error?.code ?? '';
        if (code.includes('too-many-requests')) {
          setFormError('অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার করুন।');
        } else {
          // Still show the neutral success state for unknown addresses.
          setSent(true);
        }
      }
    },
    [resetPassword],
  );

  return (
    <>
      <SEO title={t('auth.resetTitle')} path="/forgot-password" noIndex />

      <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-7">
            {sent ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-xl">
                  ✉
                </div>
                <h1 className="mt-4 font-display text-lg font-bold text-content-primary">
                  {t('auth.resetSent')}
                </h1>
                <p className="mt-2 text-sm text-content-muted">
                  ইমেইলটি না পেলে স্প্যাম ফোল্ডার দেখুন। / Check your spam folder if it does not
                  arrive.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-block w-full rounded-pill bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  {t('nav.login')}
                </Link>
              </div>
            ) : (
              <>
                <h1 className="font-display text-xl font-bold text-content-primary">
                  {t('auth.resetTitle')}
                </h1>
                <p className="mt-1.5 text-sm text-content-muted">
                  আপনার ইমেইল দিন, রিসেট লিংক পাঠানো হবে।
                </p>

                {formError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-live/30 bg-live/10 px-3.5 py-3 text-sm text-live-light"
                  >
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4">
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

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-pill bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {isSubmitting ? t('common.loading') : t('auth.resetTitle')}
                  </button>
                </form>

                <Link
                  to="/login"
                  className="mt-5 block text-center text-sm text-content-muted hover:text-content-primary"
                >
                  ← {t('nav.login')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
