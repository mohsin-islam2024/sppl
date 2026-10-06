import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-6xl font-extrabold text-brand/25">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-content-primary">
        পেজটি খুঁজে পাওয়া যায়নি
      </h1>
      <p className="mt-1 text-sm text-content-muted">This page could not be found.</p>
      <Link
        to="/"
        className="mt-6 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        {t('nav.home')}
      </Link>
    </div>
  );
}
