/**
 * Minimal structured logger. Kept dependency-free on purpose — Render captures
 * stdout/stderr, so plain lines with a level prefix are enough and stay readable
 * in the dashboard log viewer.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

const stamp = () => new Date().toISOString();

const write = (level, args) => {
  if (LEVELS[level] > currentLevel) return;
  const sink =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  sink(`${stamp()} [${level.toUpperCase()}]`, ...args);
};

const logger = {
  error: (...args) => write("error", args),
  warn: (...args) => write("warn", args),
  info: (...args) => write("info", args),
  debug: (...args) => write("debug", args),
};

export default logger;
