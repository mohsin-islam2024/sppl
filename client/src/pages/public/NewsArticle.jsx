import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import { Skeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useArticle } from '../../hooks/useContent.js';
import { formatDate } from '../../utils/format.js';

/**
 * A single news article, at /news/:slug.
 *
 * The body is plain text. Blank lines split it into paragraphs and single line
 * breaks inside a paragraph are kept, so what the admin typed is what the reader
 * sees. It is rendered as text, never as HTML, so an article cannot inject markup
 * into the page.
 */
export default function NewsArticle() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const { data: article, isLoading, isError, error, refetch } = useArticle(slug);

  const pick = (field) =>
    article
      ? lang === 'bn'
        ? article[`${field}Bn`] || article[`${field}En`]
        : article[`${field}En`] || article[`${field}Bn`]
      : '';

  const notFound = isError && error?.status === 404;

  return (
    <>
      <SEO
        title={article ? pick('title') : t('nav.news')}
        description={article ? pick('excerpt') : undefined}
        path={`/news/${slug}`}
      />

      <div className="container-page max-w-3xl py-8">
        <Link to="/news" className="text-sm font-semibold text-brand-light hover:underline">
          ← {t('news.backToNews')}
        </Link>

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : notFound ? (
          <p className="mt-10 text-center text-content-muted">{t('news.notFound')}</p>
        ) : isError ? (
          <div className="mt-6">
            <ErrorState message={error?.message} onRetry={refetch} />
          </div>
        ) : article ? (
          <article className="mt-6">
            {article.publishedAt && (
              <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                {formatDate(article.publishedAt, lang)}
              </p>
            )}
            <h1 className="mt-2 text-balance font-display text-2xl font-extrabold leading-tight text-content-primary sm:text-4xl">
              {pick('title')}
            </h1>

            {article.coverUrl && (
              <img
                src={article.coverUrl}
                alt=""
                className="mt-6 w-full rounded-lg border border-surface-border object-cover"
              />
            )}

            <div className="mt-6 space-y-4 text-base leading-relaxed text-content-secondary">
              {pick('body')
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </div>

            {article.tags?.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <li key={tag} className="badge bg-brand/15 text-brand-light">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : null}
      </div>
    </>
  );
}
