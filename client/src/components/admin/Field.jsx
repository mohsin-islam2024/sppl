import { forwardRef } from 'react';

/**
 * Form field primitives for the admin panel.
 *
 * Every field forwards its ref to the real DOM element. React Hook Form's
 * `register()` returns a ref that it needs attached to the input it is validating —
 * a wrapper component that swallows the ref leaves the library unable to read the
 * field, and the symptom is exactly what it looks like here: fields that visibly
 * contain a value still failing validation with "Required" or
 * "Expected number, received nan".
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
export const TextField = forwardRef(function TextField(
  { id, label, hint, error, required, type = 'text', ...props },
  ref,
) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <input
        id={id}
        ref={ref}
        type={type}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
});

/** Number input. */
export const NumberField = forwardRef(function NumberField(
  { id, label, hint, error, required, ...props },
  ref,
) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <input
        id={id}
        ref={ref}
        type="number"
        inputMode="numeric"
        className={`${inputClass} tabular`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
});

/** Date and time input. */
export const DateTimeField = forwardRef(function DateTimeField(
  { id, label, hint, error, required, ...props },
  ref,
) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <input
        id={id}
        ref={ref}
        type="datetime-local"
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
});

/** Select. Options are `{ value, label }` pairs. */
export const SelectField = forwardRef(function SelectField(
  { id, label, hint, error, required, options = [], placeholder, ...props },
  ref,
) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <select
        id={id}
        ref={ref}
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
});

/** Checkbox with its label on the same line. */
export const CheckboxField = forwardRef(function CheckboxField(
  { id, label, hint, error, ...props },
  ref,
) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2.5 text-sm text-content-secondary"
      >
        <input
          id={id}
          ref={ref}
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
});

/** Multi-line text. */
export const TextAreaField = forwardRef(function TextAreaField(
  { id, label, hint, error, required, rows = 4, ...props },
  ref,
) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        className={`${inputClass} resize-y`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FieldShell>
  );
});

export default TextField;
