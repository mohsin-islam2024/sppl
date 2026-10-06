/**
 * Minimal SVG mark used while assets load.
 *
 * Inlined rather than served as a file so it can never be the thing that is missing
 * from a cold cache on a slow connection.
 */
export default function LoadingMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <path
        d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
