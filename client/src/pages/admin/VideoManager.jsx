import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ManagerShell from '../../components/admin/ManagerShell.jsx';
import { TextField, NumberField, CheckboxField } from '../../components/admin/Field.jsx';
import { formatShortDate } from '../../utils/format.js';

/**
 * Videos.
 *
 * The site does not host footage: an admin pastes a YouTube or Facebook link. The
 * server works out the provider, the embed id and the thumbnail from that link, so
 * the link is the only thing to get right. A video stays hidden until "published"
 * is ticked.
 */

const schema = z.object({
  titleBn: z.string().trim().min(1, 'Required').max(200),
  titleEn: z.string().trim().min(1, 'Required').max(200),
  url: z.string().trim().url('Paste a full link, starting with https://'),
  order: z.coerce.number().int().min(0).max(9999).catch(0),
  published: z.boolean().catch(false),
});

const EMPTY = { titleBn: '', titleEn: '', url: '', order: 0, published: false };

export default function VideoManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const titleOf = (row) => (lang === 'bn' ? row.titleBn || row.titleEn : row.titleEn || row.titleBn);

  const columns = [
    {
      key: 'thumb',
      label: t('admin.videos'),
      className: 'w-24',
      render: (row) =>
        row.thumbnailUrl ? (
          <img src={row.thumbnailUrl} alt="" loading="lazy" className="h-12 w-20 rounded object-cover" />
        ) : (
          <span className="text-xl" aria-hidden="true">
            🎬
          </span>
        ),
    },
    {
      key: 'title',
      label: t('admin.titleEn'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{titleOf(row)}</p>
          <p className="truncate text-2xs text-content-muted">{row.url}</p>
        </div>
      ),
    },
    {
      key: 'provider',
      label: t('admin.videoSource'),
      align: 'center',
      render: (row) => <span className="badge badge-completed">{row.provider}</span>,
    },
    {
      key: 'published',
      label: t('admin.status'),
      align: 'center',
      render: (row) => (
        <span className={`badge ${row.published ? 'bg-win/15 text-win' : 'badge-completed'}`}>
          {row.published ? t('admin.published') : t('admin.draft')}
        </span>
      ),
    },
    {
      key: 'publishedAt',
      label: t('admin.publishedOn'),
      align: 'center',
      render: (row) => (row.publishedAt ? formatShortDate(row.publishedAt, lang) : '—'),
    },
  ];

  return (
    <ManagerShell
      resource="videos"
      title={t('admin.videos')}
      description={t('admin.videosHelp')}
      newLabel={t('admin.newVideo')}
      emptyText={t('admin.noVideos')}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      rowName={titleOf}
      toFormValues={(row) => ({
        titleBn: row.titleBn ?? '',
        titleEn: row.titleEn ?? '',
        url: row.url ?? '',
        order: row.order ?? 0,
        published: Boolean(row.published),
      })}
      toPayload={(values) => ({
        titleBn: values.titleBn,
        titleEn: values.titleEn,
        url: values.url,
        order: values.order,
        published: values.published,
      })}
      renderFields={({ register, errors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="titleBn" label={t('admin.titleBn')} required error={errors.titleBn?.message} {...register('titleBn')} />
            <TextField id="titleEn" label={t('admin.titleEn')} required error={errors.titleEn?.message} {...register('titleEn')} />
          </div>
          <TextField
            id="url"
            label={t('admin.videoUrl')}
            hint={t('admin.videoUrlHint')}
            placeholder="https://www.youtube.com/watch?v="
            required
            error={errors.url?.message}
            {...register('url')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="order" label={t('admin.displayOrder')} error={errors.order?.message} {...register('order')} />
          </div>
          <CheckboxField id="published" label={t('admin.publishHint')} {...register('published')} />
        </>
      )}
    />
  );
}
