/**
 * Domain error of the POS-session services. Lives in its own module so the services that the
 * session service itself calls (shift reports, rollover) can throw it without an import cycle.
 * Re-exported from `pos-session.service` for existing importers.
 */

/** Domain error that maps expected POS lifecycle failures to safe HTTP responses. */
export class PosSessionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 422,
    /** Actionable payload for the client (e.g. what it can offer instead of failing). */
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PosSessionError';
  }
}
