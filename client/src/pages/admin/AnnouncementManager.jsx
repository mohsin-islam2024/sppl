import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ManagerShell from '../../components/admin/ManagerShell.jsx';
import { TextField, TextAreaField, SelectField, CheckboxField } from '../../components/admin/Field.jsx';
import { formatShortDate } from '../../utils/format.js';
import { ANNOUNCEMENT_PRIORITY } from '@sppl/shared/constants/tournament.js';

/**
 * Announcements: the notices shown in the ticker at the top of the site.
 *
 * `expiresAt` hides a notice automatically after a date. Clearing the field on edit
 * sends `null`, which the API stores as "never expires".
 */

const schema = z.object({
  titleBn: z.string().trim().min(1, 'Required').max(200),
  titleEn: z.string().trim().min(1, 'Required').max(200),
  bodyBn: z.string().trim().min(1, 'Required').max(5000),
  bodyEn: z.string().trim().min(1, 'Required').max(5000),
  priority: z.enum(Object.values(ANNOUNCEMENT_PRIORITY)),
  expiresAt: z.string().optional(),
  active: z.boolean().catch(true),
});

const EMPTY = {
  titleBn: '',
  titleEn: '',
  bodyBn: '',
  bodyEn: '',
  priority: ANNOUNCEMENT_PRIORITY.NORMAL,
  expiresAt: '',
  active: true,
};

/** ISO date -> the "YYYY-MM-DDTHH:mm" string a datetime-local input needs, in local time. */
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AnnouncementManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const priorityLabel = {
    NORMAL: t('admin.priorityNormal'),
    IMPORTANT: t('admin.priorityImportant'),
    URGENT: t('admin.priorityUrgent'),
  };
  const priorityTone = {
    NORMAL: 'badge-completed',
    IMPORTANT: 'bg-gold/15 text-gold',
    URGENT: 'bg-live/15 text-live-light',
  };

  const titleOf = (row) => (lang === 'bn' ? row.titleBn || row.titleEn : row.titleEn || row.titleBn);

  const columns = [
    {
      key: 'title',
      label: t('admin.announcements'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{titleOf(row)}</p>
          <p className="truncate text-2xs text-content-muted">
            {lang === 'bn' ? row.titleEn : row.titleBn}
          </p>
        </div>
      ),
    },
    {
      key: 'priority',
      label: t('admin.priority'),
      align: 'center',
      render: (row) => (
        <span className={`badge ${priorityTone[row.priority] ?? 'badge-completed'}`}>
          {priorityLabel[row.priority] ?? row.priority}
        </span>
      ),
    },
    {
      key: 'expiresAt',
      label: t('admin.expiresAt'),
      align: 'center',
      render: (row) => (row.expiresAt ? formatShortDate(row.expiresAt, lang) : '—'),
    },
    {
      key: 'active',
      label: t('admin.active'),
      align: 'center',
      render: (row) => (
        <span className={`badge ${row.active === false ? 'badge-completed' : 'bg-win/15 text-win'}`}>
          {row.active === false ? t('admin.inactive') : t('admin.active')}
        </span>
      ),
    },
  ];

  return (
    <ManagerShell
      resource="announcements"
      title={t('admin.announcements')}
      description={t('admin.announcementsHelp')}
      newLabel={t('admin.newAnnouncement')}
      emptyText={t('admin.noAnnouncements')}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      rowName={titleOf}
      toFormValues={(row) => ({
        titleBn: row.titleBn ?? '',
        titleEn: row.titleEn ?? '',
        bodyBn: row.bodyBn ?? '',
        bodyEn: row.bodyEn ?? '',
        priority: row.priority ?? ANNOUNCEMENT_PRIORITY.NORMAL,
        expiresAt: toLocalInput(row.expiresAt),
        active: row.active !== false,
      })}
      toPayload={(values) => ({
        titleBn: values.titleBn,
        titleEn: values.titleEn,
        bodyBn: values.bodyBn,
        bodyEn: values.bodyEn,
        priority: values.priority,
        // The datetime-local value is the admin's local time; converting it here, on
        // their device, avoids the server reading it as UTC and shifting it by hours.
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
        active: values.active,
      })}
      renderFields={({ register, errors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="titleBn" label={t('admin.titleBn')} required error={errors.titleBn?.message} {...register('titleBn')} />
            <TextField id="titleEn" label={t('admin.titleEn')} required error={errors.titleEn?.message} {...register('titleEn')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextAreaField id="bodyBn" label={t('admin.bodyBn')} required rows={4} error={errors.bodyBn?.message} {...register('bodyBn')} />
            <TextAreaField id="bodyEn" label={t('admin.bodyEn')} required rows={4} error={errors.bodyEn?.message} {...register('bodyEn')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="priority"
              label={t('admin.priority')}
              options={Object.values(ANNOUNCEMENT_PRIORITY).map((value) => ({ value, label: priorityLabel[value] }))}
              error={errors.priority?.message}
              {...register('priority')}
            />
            <TextField
              id="expiresAt"
              type="datetime-local"
              label={t('admin.expiresAt')}
              hint={t('admin.expiresHint')}
              error={errors.expiresAt?.message}
              {...register('expiresAt')}
            />
          </div>
          <CheckboxField id="active" label={t('admin.activeHint')} {...register('active')} />
        </>
      )}
    />
  );
}
