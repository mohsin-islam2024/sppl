import { useTranslation } from 'react-i18next';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * A bottom sheet for choosing a batter or a bowler.
 *
 * A sheet rather than a `<select>` because the list is long — a squad has nine to
 * eighteen names — and a native dropdown on a phone shows three of them at a time.
 * Opening the picker from the card it applies to also makes it obvious which slot is
 * being changed.
 *
 * The `unavailable` set carries the ids that cannot be picked in this slot: the
 * player already at the other end, and anyone already dismissed.
 */
export default function PlayerPickerSheet({
  open,
  title,
  players = [],
  unavailable = [],
  selectedId = null,
  onPick,
  onClose,
}) {
  const { t } = useTranslation();

  if (!open) return null;

  const blocked = new Set(unavailable.map(String).filter(Boolean));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/70 sm:items-center"
    >
      {/* Backdrop — tapping it closes the sheet, which is the gesture people try first. */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-raised p-4 sm:rounded-card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-content-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition hover:bg-surface-sunken"
          >
            ✕
          </button>
        </div>

        {players.length === 0 ? (
          <p className="mt-4 text-sm text-content-muted">{t('scoring.noPlayersAvailable')}</p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {players.map((player) => {
              const id = player.id ?? player._id;
              const isBlocked = blocked.has(String(id));
              const isSelected = selectedId && String(selectedId) === String(id);

              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={isBlocked}
                    onClick={() => onPick(id)}
                    aria-pressed={Boolean(isSelected)}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition',
                      isBlocked
                        ? 'cursor-not-allowed border-surface-border bg-surface-sunken opacity-50'
                        : isSelected
                          ? 'border-brand bg-brand/10'
                          : 'border-surface-border bg-surface-raised hover:bg-surface-sunken',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'tabular flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold',
                        isSelected ? 'bg-brand text-white' : 'bg-surface-sunken text-content-muted',
                      ].join(' ')}
                    >
                      {toBengaliDigits(player.jerseyNo)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-content-primary">
                        {player.jerseyName || player.fullName}
                      </span>
                      {player.fullName && player.fullName !== player.jerseyName && (
                        <span className="block truncate text-2xs text-content-muted">
                          {player.fullName}
                        </span>
                      )}
                    </span>

                    {isBlocked && (
                      <span className="shrink-0 text-2xs text-content-muted">
                        {t('scoring.unavailable')}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
