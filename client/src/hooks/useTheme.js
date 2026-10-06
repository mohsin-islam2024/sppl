import { useThemeContext } from "../context/ThemeContext.jsx";

/**
 * Theme hook.
 *
 * Re-exported through a named function rather than re-exporting the context's
 * default. `ThemeContext.jsx` exports the CONTEXT OBJECT as its default — that is
 * what `createContext()` returns — so re-exporting that default as `useTheme` would
 * hand callers an object and the first `useTheme()` call would throw
 * "X is not a function".
 */
export const useTheme = useThemeContext;

export default useTheme;
