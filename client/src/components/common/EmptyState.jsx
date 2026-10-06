import { useTranslation } from 'react-i18next';

/**
 * Empty state.
 *
 * The wording matters more than the styling here. Season 2 has no dates and no
 * teams yet, and Season 1 is over — so "no fixtures" can mean several very
 * different things, and the wrong message makes a working page look broken.
 *
 * A caller passes a `variant`, and the copy comes from the translation file where
 * it can be reviewed as prose rather than assembled from fragments in JSX.
 */
export default function EmptyState({
  variant = 'default',
  title,
  description,
  action = null,
  icon = null,
}) {
  const { t } = useTranslation();

  const preset = {
    default: {
      title: t('empty.defaultTitle'),
      description: t('empty.defaultBody'),
    },
    noDates: {
      title: t('empty.noDatesTitle'),
      description: t('empty.noDatesBody'),
    },
    noTeams: {
      title: t('empty.noTeamsTitle'),
      description: t('empty.noTeamsBody'),
    },
    notStarted: {
      title: t('empty.notStartedTitle'),
      description: t('empty.notStartedBody'),
    },
    archived: {
      title: t('empty.archivedTitle'),
      description: t('empty.archivedBody'),
    },
    noResults: {
      title: t('empty.noResultsTitle'),
      description: t('empty.noResultsBody'),
    },
  };

  const content = preset[variant] ?? preset.default;

  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-xl text-content-muted"
        aria-hidden="true"
      >
        {icon ?? '🏏'}
      </span>

      <h2 className="mt-4 font-display text-base font-bold text-content-primary">
        {title ?? content.title}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-content-muted">
        {description ?? content.description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
