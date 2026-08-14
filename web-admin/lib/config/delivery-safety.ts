/**
 * Staff delivery writes stay closed until POD, route, payment, and workflow
 * mutations share one rollback-safe transaction and the release gates pass.
 */
export const STAFF_DELIVERY_WRITES_ENABLED = false;

export const DELIVERY_HARDENING_ERROR = {
  success: false,
  code: 'DELIVERY_HARDENING_REQUIRED',
  error: 'Staff delivery writes are temporarily unavailable pending safety hardening',
} as const;
