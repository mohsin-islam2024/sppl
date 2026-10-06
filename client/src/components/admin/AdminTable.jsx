import { useTranslation } from 'react-i18next';

/**
 * The table every admin list uses.
 *
 * Rendered as a real `<table>` on wide screens and as a stack of cards on a phone —
 * a seven-column table on a 360px screen is unreadable however it is styled. The
 * breakpoint is `md`, and the mobile form keeps every value, so nothing is lost.
 *
 * @param {object} props
 * @param {Array<{ key: string, label: string, align?: 'left'|'center'|'right', render?: Function, className?: string }>} props.columns
 * @param {Array<object>} props.rows
 * @param {(row: object) => string} [props.rowKey]
 * @param {(row: object) => React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.empty]
 */
export default function AdminTable({ columns, rows = [], rowKey, actions, empty = null }) {
  const { t } = useTranslation();

  if (!rows.length) {
    return (
      <div className="card p-8 text-center text-sm text-content-muted">
        {empty ?? t('admin.noRows')}
      </div>
    );
  }

  /** Column values, so the desktop table and the mobile cards share one renderer. */
  const cell = (column, row) =>
    column.render ? column.render(row) : (row[column.key] ?? '—');

  const alignClass = (align) =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <>
      {/* Wide screens: a table */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${alignClass(column.align)} ${column.className ?? ''}`}
                  >
                    {column.label}
                  </th>
                ))}
                {actions && (
                  <th scope="col" className="w-32 text-right">
                    {t('admin.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={rowKey ? rowKey(row) : (row.id ?? row._id ?? index)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${alignClass(column.align)} ${column.className ?? ''}`}
                    >
                      {cell(column, row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="text-right">
                      <div className="flex justify-end gap-2">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phones: one card per row */}
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div key={rowKey ? rowKey(row) : (row.id ?? row._id ?? index)} className="card p-4">
            <dl className="space-y-2">
              {columns.map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-2xs font-semibold uppercase tracking-widest text-content-muted">
                    {column.label}
                  </dt>
                  <dd className="min-w-0 text-right text-sm text-content-primary">
                    {cell(column, row)}
                  </dd>
                </div>
              ))}
            </dl>

            {actions && (
              <div className="mt-3 flex justify-end gap-2 border-t border-surface-border pt-3">
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/** A small text action button for the row controls. */
export function RowAction({ onClick, children, tone = 'default', type = 'button', ...props }) {
  const toneClass =
    tone === 'danger'
      ? 'text-live hover:bg-live/10'
      : tone === 'primary'
        ? 'text-brand-light hover:bg-brand/10'
        : 'text-content-secondary hover:bg-surface-sunken';

  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${toneClass}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** The primary action button used in page headers. */
export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`rounded-pill bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}


