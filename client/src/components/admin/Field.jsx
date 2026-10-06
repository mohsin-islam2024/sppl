import { useTranslation } from 'react-i18next';

/**
 * Form field primitives for the admin panel.
 *
 * These are thin wrappers over native inputs, not a form library. React Hook Form's
 * `register()` works on the real DOM element, so a wrapper has to forward the ref —
 * which these do via `{...props}` on the input itself.
 *
 * Every field renders a label, an optional hint, and an error slot wired with
 * `aria-describedby`, so a screen reader reads the error with the field rather than
 * announcing a floating message nobody connects to it.
 */

const inputClass =
  'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-content-primary placeholder:text-content-muted transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60';

const labelClass = 'mb-1.5 block text-sm font-medium text-content-secondary';
const errorClass = 'mt-1.5 text-xs font-medium text-live';
const hintClass = 'mt-1 text-2xs text-content-muted';

/** Wraps any control with its label, hint and error. */
export function FieldShell({ label, htmlFor, hint, error, required = false, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
          {required && (
            <span className="ml-0.5 text-live" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && !error && <p className={hintClass}>{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Text input. */
export function TextField({ id, label, hint, error, required, type = 'text', ...props }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <input
        id={id}
        type={type}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

/** Number input. Values arrive as strings from a form, so callers coerce. */
export function NumberField({ id, label, hint, error, required, ...props }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className={`${inputClass} tabular`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

/**
 * Date and time input.
 *
 * A native `datetime-local` rather than a picker library: it opens the phone's own
 * date wheel, costs no JavaScript, and is what this audience already knows how to
 * use. The value is a local string; the caller converts it to an ISO date before
 * sending, since the API stores UTC.
 */
export function DateTimeField({ id, label, hint, error, required, ...props }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <input
        id={id}
        type="datetime-local"
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

/** Select. Options are `{ value, label }` pairs. */
export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  options = [],
  placeholder,
  ...props
}) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <select
        id={id}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Checkbox with its label on the same line. */
export function CheckboxField({ id, label, hint, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm text-content-secondary">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-surface-border text-brand focus:ring-brand"
          {...props}
        />
        {label}
      </label>
      {hint && !error && <p className={hintClass}>{hint}</p>}
      {error && (
        <p id={`${id}-error`} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Multi-line text. */
export function TextAreaField({ id, label, hint, error, required, rows = 4, ...props }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        rows={rows}
        className={`${inputClass} resize-y`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export default TextField;
