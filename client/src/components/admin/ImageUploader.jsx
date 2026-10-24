import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../config/axios.js';

/**
 * Direct-to-Cloudinary image upload.
 *
 * The browser asks our server for a signature, then posts the file straight to
 * Cloudinary — the image never passes through Render. Only the parameters the server
 * signed (folder, timestamp) may be sent alongside the file; adding any other
 * parameter, such as `eager`, makes Cloudinary reject the upload as an invalid
 * signature.
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Ask the server to sign an upload into `folder`.
 *
 * A signature stays valid for about an hour and can be reused, so a batch of photos
 * should request ONE signature and share it. The signing endpoint is rate limited
 * (30 per hour), and one request per photo would run out after thirty pictures.
 */
export async function requestSignature(folder, resourceType = 'image') {
  const { data } = await api.post('/upload/sign', { folder, resourceType });
  return data.data;
}

/**
 * Shrink big phone photos before uploading. A 6 MB JPEG becomes a few hundred KB,
 * which matters on a village mobile connection. Anything that is not a large JPEG
 * (logos, PNGs with transparency) is sent untouched.
 */
async function downscale(file, maxDimension = 2000) {
  if (
    file.type !== 'image/jpeg' ||
    file.size < 1.2 * 1024 * 1024 ||
    typeof createImageBitmap !== 'function'
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < file.size
      ? new File([blob], file.name, { type: 'image/jpeg' })
      : file;
  } catch {
    return file;
  }
}

/**
 * Upload one file.
 *
 * @param {File} file
 * @param {object} options
 * @param {string} options.folder         key of the server's UPLOAD_FOLDERS
 * @param {object} [options.signature]    a signature from requestSignature(); fetched if omitted
 * @param {(percent:number) => void} [options.onProgress]
 * @returns {Promise<{url:string, publicId:string, width:number, height:number}>}
 */
export async function uploadToCloudinary(file, { folder, signature, onProgress } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  if (file.size > MAX_IMAGE_BYTES * 2) {
    throw new Error('This image is too large (over 20 MB)');
  }

  const prepared = await downscale(file);
  if (prepared.size > MAX_IMAGE_BYTES) {
    throw new Error('This image is larger than 10 MB');
  }

  const sig = signature ?? (await requestSignature(folder));

  const form = new FormData();
  form.append('file', prepared);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Falls through to the generic error below.
      }

      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) {
        resolve({
          url: body.secure_url,
          publicId: body.public_id,
          width: body.width,
          height: body.height,
        });
      } else {
        reject(new Error(body?.error?.message ?? `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.send(form);
  });
}

/**
 * A single-image field: preview, choose / replace, remove, with upload progress.
 *
 * It does not own the value. The parent form keeps the URL and public id, and this
 * component reports changes through `onUploaded` and `onClear`.
 */
export default function ImageUploader({
  folder,
  value,
  onUploaded,
  onClear,
  label,
  hint,
  disabled = false,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const busy = progress !== null;

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setProgress(0);
    try {
      const asset = await uploadToCloudinary(file, { folder, onProgress: setProgress });
      onUploaded?.(asset);
    } catch (err) {
      setError(err?.message ?? t('admin.saveFailed'));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-content-secondary">{label}</span>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-surface-sunken">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-2xl text-content-muted" aria-hidden="true">
              🖼
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-pill border border-surface-border px-3.5 py-2 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-60"
            >
              {busy ? `${t('admin.uploading')} ${progress}%` : value ? t('admin.replaceImage') : t('admin.chooseImage')}
            </button>
            {value && !busy && (
              <button
                type="button"
                disabled={disabled}
                onClick={onClear}
                className="rounded-pill px-3.5 py-2 text-sm font-semibold text-live transition hover:bg-live/10"
              >
                {t('admin.removeImage')}
              </button>
            )}
          </div>
          <p className="text-2xs text-content-muted">{hint ?? t('admin.imageHint')}</p>
          {error && (
            <p role="alert" className="text-xs font-medium text-live">
              {error}
            </p>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}
