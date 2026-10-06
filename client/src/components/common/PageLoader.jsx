/**
 * Full-page loading state.
 *
 * The markup is deliberately minimal: it renders during route chunk downloads, so
 * anything elaborate here would compete with the code it is waiting for. The crest
 * mark is inlined — a spinner built from CSS costs nothing and cannot arrive late.
 */
export default function PageLoader({ label = 'লোড হচ্ছে...' }) {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/30" />
        <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark shadow-gold">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9 4.5 L9 19.5 M15 4.5 L15 19.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      </span>
      <span className="text-sm text-content-muted">{label}</span>
    </div>
  );
}
