import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ManagerShell from '../../components/admin/ManagerShell.jsx';
import ImageUploader from '../../components/admin/ImageUploader.jsx';
import { TextField, TextAreaField, CheckboxField } from '../../components/admin/Field.jsx';
import { formatShortDate } from '../../utils/format.js';

/**
 * News.
 *
 * An article is a draft until "published" is ticked. The slug is optional: left
 * empty, the server builds it from the English title, which is what almost every
 * article wants. Tags are typed as one comma-separated line and sent as an array.
 */

const optionalText = (max) => z.string().trim().max(max).optional();

const schema = z.object({
  titleBn: z.string().trim().min(1, 'Required').max(200),
  titleEn: z.string().trim().min(1, 'Required').max(200),
  excerptBn: optionalText(500),
  excerptEn: optionalText(500),
  bodyBn: z.string().trim().min(1, 'Required').max(20000),
  bodyEn: z.string().trim().min(1, 'Required').max(20000),
  coverUrl: z.string().optional(),
  coverPublicId: z.string().optional(),
  tagsText: optionalText(400),
  slug: z
    .string()
    .trim()
    .regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'Lowercase letters, numbers and dashes only')
    .optional(),
  published: z.boolean().catch(false),
});

const EMPTY = {
  titleBn: '',
  titleEn: '',
  excerptBn: '',
  excerptEn: '',
  bodyBn: '',
  bodyEn: '',
  coverUrl: '',
  coverPublicId: '',
  tagsText: '',
  slug: '',
  published: false,
};

/** "a, b ,, c" -> ["a", "b", "c"], within the API's limits (10 tags, 40 characters each). */
function parseTags(text = '') {
  return text
    .split(',')
    .map((tag) => tag.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);
}

export default function NewsManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const titleOf = (row) => (lang === 'bn' ? row.titleBn || row.titleEn : row.titleEn || row.titleBn);

  const columns = [
    {
      key: 'cover',
      label: t('admin.cover'),
      className: 'w-20',
      render: (row) =>
        row.coverUrl ? (
          <img src={row.coverUrl} alt="" loading="lazy" className="h-10 w-14 rounded object-cover" />
        ) : (
          <span className="text-content-muted">—</span>
        ),
    },
    {
      key: 'title',
      label: t('admin.news'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{titleOf(row)}</p>
          <p className="truncate text-2xs text-content-muted">{row.slug}</p>
        </div>
      ),
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
      resource="news"
      title={t('admin.news')}
      description={t('admin.newsHelp')}
      newLabel={t('admin.newNews')}
      emptyText={t('admin.noNews')}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      rowName={titleOf}
      toFormValues={(row) => ({
        titleBn: row.titleBn ?? '',
        titleEn: row.titleEn ?? '',
        excerptBn: row.excerptBn ?? '',
        excerptEn: row.excerptEn ?? '',
        bodyBn: row.bodyBn ?? '',
        bodyEn: row.bodyEn ?? '',
        coverUrl: row.coverUrl ?? '',
        coverPublicId: row.coverPublicId ?? '',
        tagsText: (row.tags ?? []).join(', '),
        slug: row.slug ?? '',
        published: Boolean(row.published),
      })}
      toPayload={(values) => ({
        titleBn: values.titleBn,
        titleEn: values.titleEn,
        excerptBn: values.excerptBn ?? '',
        excerptEn: values.excerptEn ?? '',
        bodyBn: values.bodyBn,
        bodyEn: values.bodyEn,
        coverUrl: values.coverUrl ?? '',
        // An empty public id is rejected by the API; it is only sent with an upload.
        ...(values.coverPublicId ? { coverPublicId: values.coverPublicId } : {}),
        tags: parseTags(values.tagsText),
        ...(values.slug ? { slug: values.slug } : {}),
        published: values.published,
      })}
      renderFields={({ register, errors, setValue, watch }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="titleBn" label={t('admin.titleBn')} required error={errors.titleBn?.message} {...register('titleBn')} />
            <TextField id="titleEn" label={t('admin.titleEn')} required error={errors.titleEn?.message} {...register('titleEn')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextAreaField id="excerptBn" label={t('admin.excerptBn')} rows={2} error={errors.excerptBn?.message} {...register('excerptBn')} />
            <TextAreaField id="excerptEn" label={t('admin.excerptEn')} rows={2} error={errors.excerptEn?.message} {...register('excerptEn')} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextAreaField id="bodyBn" label={t('admin.bodyBn')} required rows={9} error={errors.bodyBn?.message} {...register('bodyBn')} />
            <TextAreaField id="bodyEn" label={t('admin.bodyEn')} required rows={9} error={errors.bodyEn?.message} {...register('bodyEn')} />
          </div>
          <ImageUploader
            folder="news"
            label={t('admin.cover')}
            value={watch('coverUrl')}
            onUploaded={(asset) => {
              setValue('coverUrl', asset.url, { shouldDirty: true });
              setValue('coverPublicId', asset.publicId, { shouldDirty: true });
            }}
            onClear={() => {
              setValue('coverUrl', '', { shouldDirty: true });
              setValue('coverPublicId', '', { shouldDirty: true });
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="tagsText" label={t('admin.tags')} hint={t('admin.tagsHint')} error={errors.tagsText?.message} {...register('tagsText')} />
            <TextField id="slug" label={t('admin.slug')} hint={t('admin.slugAutoHint')} placeholder="opening-day" error={errors.slug?.message} {...register('slug')} />
          </div>
          <CheckboxField id="published" label={t('admin.publishHint')} {...register('published')} />
        </>
      )}
    />
  );
}
