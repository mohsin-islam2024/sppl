import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ManagerShell from '../../components/admin/ManagerShell.jsx';
import ImageUploader from '../../components/admin/ImageUploader.jsx';
import { TextField, NumberField, SelectField, CheckboxField } from '../../components/admin/Field.jsx';
import { SPONSOR_TIER } from '@sppl/shared/constants/tournament.js';

/**
 * Sponsors.
 *
 * The logo is uploaded to Cloudinary, which returns a URL and a public id. The
 * public id is kept so deleting the sponsor (or replacing the logo) also removes the
 * old file from Cloudinary. A logo URL can still be typed in by hand, for crests that
 * ship inside the site's own /public folder; typing clears the stored public id,
 * because a hand-typed URL is no longer the uploaded file.
 */

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(120),
  tier: z.enum(Object.values(SPONSOR_TIER)),
  logoUrl: z.string().trim().min(1, 'A logo is required'),
  publicId: z.string().optional(),
  website: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  order: z.coerce.number().int().min(0).max(999).catch(0),
  active: z.boolean().catch(true),
});

const EMPTY = {
  name: '',
  tier: SPONSOR_TIER.PARTNER,
  logoUrl: '',
  publicId: '',
  website: '',
  phone: '',
  address: '',
  order: 0,
  active: true,
};

export default function SponsorManager() {
  const { t } = useTranslation();

  const tierLabel = {
    TITLE: t('admin.tierTitle'),
    PLATINUM: t('admin.tierPlatinum'),
    GOLD: t('admin.tierGold'),
    PARTNER: t('admin.tierPartner'),
  };

  const columns = [
    {
      key: 'logo',
      label: t('admin.logo'),
      className: 'w-16',
      render: (row) =>
        row.logoUrl ? (
          <img src={row.logoUrl} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded object-contain" />
        ) : null,
    },
    {
      key: 'name',
      label: t('admin.sponsorName'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{row.name}</p>
          {row.website && <p className="truncate text-2xs text-content-muted">{row.website}</p>}
        </div>
      ),
    },
    {
      key: 'tier',
      label: t('admin.tier'),
      align: 'center',
      render: (row) => <span className="badge bg-brand/15 text-brand-light">{tierLabel[row.tier] ?? row.tier}</span>,
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
      resource="sponsors"
      title={t('admin.sponsors')}
      description={t('admin.sponsorsHelp')}
      newLabel={t('admin.newSponsor')}
      emptyText={t('admin.noSponsors')}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      rowName={(row) => row.name}
      toFormValues={(row) => ({
        name: row.name ?? '',
        tier: row.tier ?? SPONSOR_TIER.PARTNER,
        logoUrl: row.logoUrl ?? '',
        publicId: row.publicId ?? '',
        website: row.website ?? '',
        phone: row.phone ?? '',
        address: row.address ?? '',
        order: row.order ?? 0,
        active: row.active !== false,
      })}
      toPayload={(values) => ({
        name: values.name,
        tier: values.tier,
        logoUrl: values.logoUrl,
        // The API rejects an empty public id, so it is only sent when there is one.
        ...(values.publicId ? { publicId: values.publicId } : {}),
        website: values.website ?? '',
        phone: values.phone ?? '',
        address: values.address ?? '',
        order: values.order,
        active: values.active,
      })}
      renderFields={({ register, errors, setValue, watch }) => (
        <>
          <ImageUploader
            folder="sponsors"
            label={t('admin.logo')}
            value={watch('logoUrl')}
            onUploaded={(asset) => {
              setValue('logoUrl', asset.url, { shouldDirty: true });
              setValue('publicId', asset.publicId, { shouldDirty: true });
            }}
            onClear={() => {
              setValue('logoUrl', '', { shouldDirty: true });
              setValue('publicId', '', { shouldDirty: true });
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField id="name" label={t('admin.sponsorName')} required error={errors.name?.message} {...register('name')} />
            <SelectField
              id="tier"
              label={t('admin.tier')}
              options={Object.values(SPONSOR_TIER).map((value) => ({ value, label: tierLabel[value] }))}
              error={errors.tier?.message}
              {...register('tier')}
            />
            <NumberField id="order" label={t('admin.displayOrder')} error={errors.order?.message} {...register('order')} />
          </div>
          <TextField
            id="logoUrl"
            label={t('admin.logoUrl')}
            hint={t('admin.logoUrlHint')}
            error={errors.logoUrl?.message}
            {...register('logoUrl', { onChange: () => setValue('publicId', '') })}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField id="website" label={t('admin.website')} placeholder="https://" error={errors.website?.message} {...register('website')} />
            <TextField id="phone" label={t('admin.phone')} error={errors.phone?.message} {...register('phone')} />
            <TextField id="address" label={t('admin.address')} error={errors.address?.message} {...register('address')} />
          </div>
          <CheckboxField id="active" label={t('admin.activeHint')} {...register('active')} />
        </>
      )}
    />
  );
}
