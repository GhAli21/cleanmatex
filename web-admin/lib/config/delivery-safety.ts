/**
 * Staff delivery writes stay closed until POD, route, payment, and workflow
 * mutations share one rollback-safe transaction and the release gates pass.
 */
export const STAFF_DELIVERY_WRITES_ENABLED = false;

/**
 * The new completion path is isolated from legacy delivery writes. It is safe
 * to enable because proof receipts, payment checks, route updates, and the
 * workflow transition commit in one tenant-scoped transaction.
 */
export const STAFF_DELIVERY_COMPLETION_ENABLED = true;

export const DELIVERY_HARDENING_ERROR = {
  success: false,
  code: 'DELIVERY_HARDENING_REQUIRED',
  error: 'Staff delivery writes are temporarily unavailable pending safety hardening',
} as const;
