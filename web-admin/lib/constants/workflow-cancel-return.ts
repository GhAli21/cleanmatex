/**
 * Cancel / return / hold eligibility — ADR_CANCEL_RETURN_RULES (Accepted 2026-07-25).
 * @see docs/features/Workflow_Order_Advance/ADR_CANCEL_RETURN_RULES.md
 * @see docs/features/Workflow_Order_Advance/04_Status_and_Vocabulary.md §5
 */

/** Statuses that may CANCEL_ORDER when prep rules allow. */
export const CANCEL_ALLOWED_STATUSES = [
  'draft',
  'intake',
  'preparing',
  'preparation', // legacy synonym
] as const;

/**
 * Return sub-order is V1.1. Until then `canReturnOrder` is always false;
 * operators create a normal order with discount/notes.
 */
export const RETURN_ALLOWED_STATUSES = ['delivered', 'closed'] as const;

/** Terminal / blocked for cancel. */
export const CANCEL_RETURN_BLOCKED_STATUSES = [
  'cancelled',
  'returned',
  'stopped',
] as const;

export type CancelAllowedStatus = (typeof CANCEL_ALLOWED_STATUSES)[number];
export type ReturnAllowedStatus = (typeof RETURN_ALLOWED_STATUSES)[number];

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

/**
 * Cancel allowlist: draft + intake + preparing only if preparation is not completed.
 */
export function canCancelOrder(
  status: string | null | undefined,
  preparationStatus?: string | null | undefined,
): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  if ((CANCEL_RETURN_BLOCKED_STATUSES as readonly string[]).includes(s)) return false;
  if (s === 'draft' || s === 'intake') return true;
  if (s === 'preparing' || s === 'preparation') {
    return normalizeStatus(preparationStatus) !== 'completed';
  }
  return false;
}

/**
 * V1.0: always false (return sub-order deferred to V1.1).
 * Kept for callers; do not use RETURN_ALLOWED_STATUSES for UI until V1.1.
 */
export function canReturnOrder(_status?: string | null | undefined): boolean {
  return false;
}

/** True when status is in the historical return set (for V1.1 / docs). */
export function isReturnEligibleStatus(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return (RETURN_ALLOWED_STATUSES as readonly string[]).includes(s);
}

export function canHoldOrderWork(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return (
    s === 'preparing' ||
    s === 'preparation' ||
    s === 'processing' ||
    s === 'assembly' ||
    s === 'qa' ||
    s === 'packing' ||
    s === 'ready' ||
    s === 'out_for_delivery'
  );
}

export function canResumeOrderWork(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'on_hold';
}

export function canStopOrderWork(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return canHoldOrderWork(s) || s === 'on_hold';
}
