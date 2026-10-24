import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ManagerShell from '../../components/admin/ManagerShell.jsx';
import { requestSignature, uploadToCloudinary } from '../../components/admin/ImageUploader.jsx';
import { useContentMutations } from '../../hooks/useAdminContent.js';
import { TextField, NumberField, CheckboxField } from '../../components/admin/Field.jsx';

/**
 * Gallery.
 *
 * Photos are added in bulk: pick as many as you like, and each is uploaded to
 * Cloudinary and saved as a gallery item. The form below the table is for editing
 * an item afterwards (caption, order, hide), so there is no "new" button.
 *
 * A batch asks the server for ONE upload signature and reuses it. Signing is rate
 * limited, and asking per photo would stop a 40-photo batch after thirty.
 */

const schema = z.object({
  captionBn: z.string().trim().max(300).optional(),
  captionEn: z.string().trim().max(300).optional(),
  order: z.coerce.number().int().min(0).max(9999).catch(0),
  active: z.boolean().catch(true),
});

const EMPTY = { captionBn: '', captionEn: '', order: 0, active: true };

function PhotoUploader({ season }) {
  const { t } = useTranslation();
  const { create } = useContentMutations('gallery');
  const inputRef = useRef(null);
  const nextId = useRef(0);
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);

  const patch = (id, change) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));

  const onPick = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const entries = files.map((file) => ({ id: nextId.current++, file }));
    setItems((list) => [
      ...list,
      ...entries.map(({ id, file }) => ({ id, name: file.name, status: 'waiting', progress: 0 })),
    ]);
    setRunning(true);

    let signature;
    try {
      signature = await requestSignature('gallery');
    } catch (err) {
      entries.forEach(({ id }) => patch(id, { status: 'error', error: err?.message }));
      setRunning(false);
      return;
    }

    // One at a time: parallel uploads over a weak mobile connection slow each other
    // down and make progress look stuck.
    for (const { id, file } of entries) {
      patch(id, { status: 'uploading' });
      try {
        const asset = await uploadToCloudinary(file, {
          folder: 'gallery',
          signature,
          onProgress: (progress) => patch(id, { progress }),
        });
        await create.mutateAsync({
          seasonId: season.id,
          type: 'PHOTO',
          url: asset.url,
          publicId: asset.publicId,
          width: asset.width,
          height: asset.height,
        });
        patch(id, { status: 'done', progress: 100 });
      } catch (err) {
        patch(id, { status: 'error', error: err?.message });
      }
    }
    setRunning(false);
  };

  const done = items.filter((item) => item.status === 'done').length;

  return (
    <div className="card mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-content-primary">{t('admin.uploadPhotos')}</h2>
          <p className="mt-0.5 text-sm text-content-muted">{t('admin.uploadPhotosHint')}</p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => inputRef.current?.click()}
          className="rounded-pill bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-light disabled:opacity-60"
        >
          {running ? t('admin.uploading') : `+ ${t('admin.uploadPhotos')}`}
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onPick} className="hidden" />

      {items.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <ul className="space-y-1.5 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-content-secondary">{item.name}</span>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    item.status === 'error' ? 'text-live' : item.status === 'done' ? 'text-win' : 'text-content-muted'
                  }`}
                >
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'done' && '✓'}
                  {item.status === 'waiting' && '…'}
                  {item.status === 'error' && (item.error ?? '✕')}
                </span>
              </li>
            ))}
          </ul>
          {!running && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-content-muted">{t('admin.photosUploaded', { count: done })}</p>
              <button
                type="button"
                onClick={() => setItems([])}
                className="text-xs font-semibold text-brand-light hover:underline"
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GalleryManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const captionOf = (row) =>
    (lang === 'bn' ? row.captionBn || row.captionEn : row.captionEn || row.captionBn) || '—';

  const columns = [
    {
      key: 'photo',
      label: t('admin.gallery'),
      className: 'w-24',
      render: (row) => (
        <img
          src={row.thumbnailUrl || row.url}
          alt=""
          loading="lazy"
          className="h-12 w-16 rounded object-cover"
        />
      ),
    },
    {
      key: 'caption',
      label: t('admin.caption'),
      render: (row) => <span className="line-clamp-2 text-content-primary">{captionOf(row)}</span>,
    },
    { key: 'order', label: t('admin.displayOrder'), align: 'center', render: (row) => row.order ?? 0 },
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
      resource="gallery"
      title={t('admin.gallery')}
      description={t('admin.galleryHelp')}
      emptyText={t('admin.noPhotos')}
      canCreate={false}
      topSlot={({ season }) => <PhotoUploader season={season} />}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      rowName={captionOf}
      toFormValues={(row) => ({
        captionBn: row.captionBn ?? '',
        captionEn: row.captionEn ?? '',
        order: row.order ?? 0,
        active: row.active !== false,
      })}
      toPayload={(values) => ({
        captionBn: values.captionBn ?? '',
        captionEn: values.captionEn ?? '',
        order: values.order,
        active: values.active,
      })}
      renderFields={({ register, errors, editing }) => (
        <>
          {editing && (
            <img
              src={editing.thumbnailUrl || editing.url}
              alt=""
              className="h-32 w-auto max-w-full rounded-lg border border-surface-border object-contain"
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="captionBn" label={t('admin.captionBn')} error={errors.captionBn?.message} {...register('captionBn')} />
            <TextField id="captionEn" label={t('admin.captionEn')} error={errors.captionEn?.message} {...register('captionEn')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="order" label={t('admin.displayOrder')} error={errors.order?.message} {...register('order')} />
          </div>
          <CheckboxField id="active" label={t('admin.activeHint')} {...register('active')} />
        </>
      )}
    />
  );
}
