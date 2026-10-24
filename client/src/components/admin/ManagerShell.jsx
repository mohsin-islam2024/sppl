import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import SEO from '../common/SEO.jsx';
import AdminPageHeader from './AdminPageHeader.jsx';
import AdminTable, { RowAction, PrimaryButton } from './AdminTable.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { ErrorState } from '../common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useAdminContentList, useContentMutations } from '../../hooks/useAdminContent.js';

/** The server's message plus its per-field validation details, when it sent any. */
function describeError(err, fallback) {
  const details = Array.isArray(err?.details)
    ? err.details.map((detail) => `${detail.field}: ${detail.message}`).join('; ')
    : '';
  return [err?.message ?? fallback, details].filter(Boolean).join(' — ');
}

/**
 * The list + form + delete-confirm scaffolding shared by the content managers
 * (news, gallery, sponsors, awards, announcements).
 *
 * It follows the same flow as TeamManager — season-scoped list, an inline form
 * below the table, a confirm dialog before deleting — so the five pages differ only
 * in what they declare: their columns, their form fields and how a row maps to a
 * payload. Keeping the flow in one place means a fix to it lands everywhere.
 *
 * @param {object} props
 * @param {string} props.resource          'news' | 'gallery' | 'sponsors' | 'awards' | 'announcements'
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.newLabel]        text of the "new" button
 * @param {string} props.emptyText
 * @param {Array}  props.columns           AdminTable columns
 * @param {object} props.schema            zod schema for the form
 * @param {object} props.emptyValues       form defaults for a new record
 * @param {(row:object) => object} props.toFormValues
 * @param {(values:object, ctx:{editing:boolean}) => object} props.toPayload
 * @param {(api:object) => React.ReactNode} props.renderFields
 * @param {(row:object) => string} props.rowName   shown in the delete dialog
 * @param {boolean} [props.canCreate=true]  false hides the "new" button (gallery adds via upload)
 * @param {React.ReactNode | ((ctx:{season:object}) => React.ReactNode)} [props.topSlot]
 */
export default function ManagerShell({
  resource,
  title,
  description,
  newLabel,
  emptyText,
  columns,
  schema,
  emptyValues,
  toFormValues,
  toPayload,
  renderFields,
  rowName,
  canCreate = true,
  topSlot = null,
}) {
  const { t } = useTranslation();
  const { season, identifier } = useActiveSeason();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [banner, setBanner] = useState(null);
  const formRef = useRef(null);

  const listQuery = useAdminContentList(resource, identifier);
  const { create, update, remove } = useContentMutations(resource);
  const rows = listQuery.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  // Bring the form into view when it opens, so tapping "Edit" on a long list on a
  // phone does not leave the admin looking at an unchanged screen.
  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [formOpen, editing]);

  const openCreate = () => {
    setEditing(null);
    setBanner(null);
    reset(emptyValues);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setBanner(null);
    reset(toFormValues(row));
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const onSubmit = async (values) => {
    setBanner(null);
    if (!season) {
      setBanner({ tone: 'error', text: t('admin.selectSeasonFirst') });
      return;
    }

    const payload = toPayload(values, { editing: Boolean(editing) });

    try {
      if (editing) {
        await update.mutateAsync({ id: editing._id ?? editing.id, payload });
      } else {
        await create.mutateAsync({ seasonId: season.id, ...payload });
      }
      setBanner({ tone: 'success', text: t('admin.saved') });
      closeForm();
    } catch (err) {
      setBanner({ tone: 'error', text: describeError(err, t('admin.saveFailed')) });
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      await remove.mutateAsync(confirmTarget._id ?? confirmTarget.id);
      setBanner({ tone: 'success', text: t('admin.deleted') });
    } catch (err) {
      setBanner({ tone: 'error', text: describeError(err, t('admin.deleteFailed')) });
    } finally {
      setConfirmTarget(null);
    }
  };

  if (!season) {
    return (
      <>
        <SEO title={title} noIndex />
        <AdminPageHeader title={title} description={t('admin.selectSeasonFirst')} />
      </>
    );
  }

  return (
    <>
      <SEO title={title} noIndex />

      <AdminPageHeader
        title={title}
        description={description}
        action={canCreate ? <PrimaryButton onClick={openCreate}>+ {newLabel}</PrimaryButton> : null}
      />

      {banner && (
        <div
          role="status"
          className={`mb-5 rounded-lg border px-3.5 py-3 text-sm ${
            banner.tone === 'error'
              ? 'border-live/30 bg-live/10 text-live-light'
              : 'border-win/30 bg-win/10 text-win'
          }`}
        >
          {banner.text}
        </div>
      )}

      {typeof topSlot === 'function' ? topSlot({ season }) : topSlot}

      {listQuery.isError ? (
        <ErrorState message={listQuery.error?.message} onRetry={listQuery.refetch} />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row._id ?? row.id}
          empty={listQuery.isLoading ? t('common.loading') : emptyText}
          actions={(row) => (
            <>
              <RowAction onClick={() => openEdit(row)}>{t('common.edit')}</RowAction>
              <RowAction tone="danger" onClick={() => setConfirmTarget(row)}>
                {t('common.delete')}
              </RowAction>
            </>
          )}
        />
      )}

      {formOpen && (
        <div ref={formRef} className="mt-8 card p-5">
          <h2 className="font-display text-base font-bold text-content-primary">
            {editing ? `${t('common.edit')}: ${rowName(editing)}` : newLabel}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
            {renderFields({ register, errors, setValue, watch, getValues, editing, season })}

            <div className="flex flex-wrap gap-3">
              <PrimaryButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('common.save')}
              </PrimaryButton>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-pill border border-surface-border px-4 py-2.5 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={t('admin.deleteItemTitle')}
        message={t('admin.deleteItemBody', { name: confirmTarget ? rowName(confirmTarget) : '' })}
        busy={remove.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
