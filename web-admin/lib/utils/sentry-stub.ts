/**
 * Sentry Stub
 * Empty stub for @sentry/nextjs when the package is not installed
 * This allows the logger to work without Sentry being installed
 */

export default {
  captureException: () => {},
  captureMessage: () => {},
  init: () => {},
};

