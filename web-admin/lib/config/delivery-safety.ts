/**
 * Legacy staff delivery writes stay closed until an explicit rollout decision
 * reopens route creation, assign, and capturePOD. Those paths do not share the
 * atomic completion transaction.
 */
export const STAFF_DELIVERY_WRITES_ENABLED = false;

/**
 * The isolated completion path (evidence upload + stop complete) is enabled.
 * Staff S10 canary still requires database-backed assurance and an explicit
 * rollout decision; public confirm-received is a separate customer contract.
 */
export const STAFF_DELIVERY_COMPLETION_ENABLED = true;

export const DELIVERY_HARDENING_ERROR = {
  success: false,
  code: 'DELIVERY_HARDENING_REQUIRED',
  error: 'Staff delivery writes are temporarily unavailable pending safety hardening',
} as const;
