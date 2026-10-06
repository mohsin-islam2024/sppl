/**
 * Wrap an async route handler so rejected promises reach the error middleware.
 * Without this every async controller needs its own try/catch.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
