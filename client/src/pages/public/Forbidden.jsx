import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';

/**
 * 403.
 *
 * Reached when a signed-in user opens an admin route their role does not cover.
 * The page states the role they hold, because the usual cause is an admin who has
 * not yet granted a promotion, not a broken account.
 */
export default function Forbidden() {
  const { t } = useTranslation();

  return (
    <>
      <SEO title="403" noIndex />
      <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-6xl font-extrabold text-gold/30">403</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-content-primary">
          {t('admin.noPermission')}
        </h1>
        <Link
          to="/"
          className="mt-6 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          {t('nav.home')}
        </Link>
      </div>
    </>
  );
}
