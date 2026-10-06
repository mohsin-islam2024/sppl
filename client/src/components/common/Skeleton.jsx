import { useTranslation } from 'react-i18next';

/**
 * Loading placeholder.
 *
 * Shaped like the content it replaces rather than a generic spinner: the layout does
 * not jump when data arrives, which matters most on a slow connection where the
 * skeleton is on screen for seconds.
 */
export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded bg-surface-sunken ${className}`} aria-hidden="true" />
  );
}

export function MatchCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-16 rounded-pill" />
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="border-t border-surface-border px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 4, columns = 6 }) {
  return (
    <div className="card overflow-hidden p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            {Array.from({ length: columns - 2 }).map((__, columnIndex) => (
              <Skeleton key={columnIndex} className="h-4 w-8" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 4, className = '' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card overflow-hidden">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inline error with a retry, for a section that failed but should not kill the page. */
export function ErrorState({ message, onRetry }) {
  const { t } = useTranslation();

  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <h2 className="font-display text-base font-bold text-content-primary">{t('common.error')}</h2>
      {message && <p className="mt-2 max-w-prose text-sm text-content-muted">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export default Skeleton;
