/**
 * Cancel vs return eligibility — mirrors Workflow Order Advance vocabulary.
 * @see docs/features/Workflow_Order_Advance/04_Status_and_Vocabulary.md §5
 */

/** Operational statuses that may CANCEL_ORDER → `cancelled`. */
export const CANCEL_ALLOWED_STATUSES = [
  'draft',
  'intake',
  'preparing',
  'preparation', // legacy synonym; engine membership uses preparing
  'processing',
  'assembly',
  'qa',
  'packing',
  'ready',
  'on_hold',
  'out_for_delivery',
] as const;

/** Fulfilled / closed statuses that may RETURN_ORDER → `returned`. */
export const RETURN_ALLOWED_STATUSES = ['delivered', 'closed'] as const;

/** Terminal statuses — neither cancel nor return. */
export const CANCEL_RETURN_BLOCKED_STATUSES = [
  'cancelled',
  'returned',
] as const;

export type CancelAllowedStatus = (typeof CANCEL_ALLOWED_STATUSES)[number];
export type ReturnAllowedStatus = (typeof RETURN_ALLOWED_STATUSES)[number];

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

/**
 * True when the order may be cancelled (not yet fulfilled / not already terminal).
 */
export function canCancelOrder(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  if ((CANCEL_RETURN_BLOCKED_STATUSES as readonly string[]).includes(s)) return false;
  if ((RETURN_ALLOWED_STATUSES as readonly string[]).includes(s)) return false;
  return (CANCEL_ALLOWED_STATUSES as readonly string[]).includes(s);
}

/**
 * True when the order may be customer-returned (delivered or closed only).
 */
export function canReturnOrder(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  if ((CANCEL_RETURN_BLOCKED_STATUSES as readonly string[]).includes(s)) return false;
  return (RETURN_ALLOWED_STATUSES as readonly string[]).includes(s);
}
