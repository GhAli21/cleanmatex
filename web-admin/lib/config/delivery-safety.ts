/**
 * Staff route writes are enabled only after the transactional route-command
 * service, database race backstop, and operator S10 evidence were accepted.
 * The retired legacy POD/OTP path is not reopened by this flag.
 */
export const STAFF_DELIVERY_WRITES_ENABLED = true;

/**
 * The isolated completion path (evidence upload + stop complete) is enabled.
 * Staff S10 canary still requires database-backed assurance and an explicit
 * rollout decision; public confirm-received is a separate customer contract.
 */
export const STAFF_DELIVERY_COMPLETION_ENABLED = true;

/**
 * Stable fail-closed response retained for delivery surfaces that are not yet
 * covered by the accepted staff-write safety boundary.
 */
export const DELIVERY_HARDENING_ERROR = {
  success: false,
  code: 'DELIVERY_HARDENING_REQUIRED',
  error: 'Staff delivery writes are temporarily unavailable pending safety hardening',
} as const;
