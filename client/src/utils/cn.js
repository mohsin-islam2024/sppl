/**
 * Join class names, dropping falsy values.
 *
 * Written by hand rather than pulled in as `clsx`: the entire need here is "apply
 * this class only when the condition holds", and a dependency for one eight-line
 * function is not worth the install.
 *
 * @param {...(string|false|null|undefined|0)} classes
 * @returns {string}
 *
 * @example
 * cn('rounded-xl py-4', isFour && 'bg-brand', isSix && 'bg-gold')
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default cn;
