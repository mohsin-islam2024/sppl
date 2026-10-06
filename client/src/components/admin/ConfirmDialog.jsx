import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Confirmation dialog for destructive actions.
 *
 * Built on the native `<dialog>` element, which gives three things for free that a
 * hand-rolled modal usually gets wrong: focus trapping, Escape-to-close, and the
 * inert background for screen readers. `showModal()` is what enables all three.
 *
 * The confirm button is never focused by default. An admin who presses Enter out of
 * habit should not delete a season — they have to move to the button deliberately.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  details = null,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  // Native <dialog> needs an explicit showModal()/close() — the `open` prop only
  // reflects state, it does not open the modal layer.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Focus the cancel button, not the destructive one.
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Escape and the browser's built-in close both fire `close`; keep React's state
  // in step so the caller does not think the dialog is still open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleClose = () => {
      if (open) onCancel?.();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [open, onCancel]);

  const confirmClass =
    tone === 'danger'
      ? 'bg-live hover:bg-live-dark'
      : 'bg-brand hover:bg-brand-dark';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      className="w-[min(28rem,calc(100vw-2rem))] rounded-card border border-surface-border bg-surface-raised p-0 text-content-primary shadow-raised backdrop:bg-navy-950/70"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="font-display text-base font-bold">
          {title ?? t('admin.confirmTitle')}
        </h2>

        <p id="confirm-message" className="mt-2 text-sm text-content-secondary">
          {message ?? t('admin.confirmBody')}
        </p>

        {/* Details spell out exactly what will be destroyed — a cascade delete is
            much easier to accept when the numbers are on screen. */}
        {details && (
          <div className="mt-4 rounded-lg border border-live/25 bg-live/5 px-3.5 py-3 text-sm">
            {details}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-pill border border-surface-border px-4 py-2.5 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-60"
          >
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-pill px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? t('common.loading') : (confirmLabel ?? t('common.delete'))}
          </button>
        </div>
      </div>
    </dialog>
  );
}
