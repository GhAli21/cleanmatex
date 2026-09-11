/**
 * Order Editability Utilities
 * Business rules for determining if an order can be edited or deleted
 *
 * PRD: Edit Order Feature
 * Rules:
 * - Orders can be edited in draft, intake, or preparation (`preparing` is the
 *   live profile status; `preparation` is the legacy alias)
 * - Preparation must not be completed (preparation_status != 'completed')
 * - Split orders cannot be edited (only parent)
 * - Orders that have started processing (SORTING+) cannot be edited
 */

import type { OrderStatus } from '@/lib/types/workflow';

const EDITABLE_STATUS_CODES = [
  'processing',
  'draft',
  'intake',
  'preparation',
  'preparing',
] as const;

const PREP_STATUSES = new Set(['preparation', 'preparing']);

// Processing has started - cannot edit
const PROCESSING_STARTED_STATUSES: OrderStatus[] = [
  'sorting',
  'washing',
  'drying',
  'finishing',
  'assembly',
  'qa',
  'packing',
  'ready',
  'out_for_delivery',
  'delivered',
  'closed',
  'cancelled',
];

/**
 *
 */
export interface EditabilityCheckResult {
  canEdit: boolean;
  reason?: string;
  blockers?: string[];
}

/**
 *
 */
export interface OrderForEditabilityCheck {
  current_status?: string | null;
  preparation_status?: string | null;
  has_split?: boolean | null;
  is_retail?: boolean | null;
  order_subtype?: string | null;
}

/**
 *
 */
export interface OrderForDeleteCheck {
  current_status?: string | null;
  paid_amount?: number | null;
  has_split?: boolean | null;
  order_subtype?: string | null;
}

/**
 * Determines if an order can be edited based on business rules
 *
 * @param order - Order object with status and metadata
 * @returns EditabilityCheckResult with canEdit flag, reason, and blockers
 */
export function isOrderEditable(order: OrderForEditabilityCheck): EditabilityCheckResult {
  const blockers: string[] = [];

  // Check 1: Order must have a valid status
  if (!order.current_status) {
    blockers.push('Order status is unknown or missing');
    return { canEdit: false, reason: blockers[0], blockers };
  }

  // Check 2: Status must be editable
  if (!(EDITABLE_STATUS_CODES as readonly string[]).includes(order.current_status)) {
    if (PROCESSING_STARTED_STATUSES.includes(order.current_status as OrderStatus)) {
      blockers.push('Order has started processing and cannot be edited');
    } else {
      blockers.push(`Order status '${order.current_status}' is not editable`);
    }
  }

  // Check 3: Preparation must not be completed
  if (
    PREP_STATUSES.has(order.current_status) &&
    order.preparation_status === 'completed'
  ) {
    blockers.push('Order preparation is completed and items may already be tagged');
  }

  // Check 4: Cannot edit split orders (edit parent only)
  if (order.has_split) {
    blockers.push('Cannot edit split orders. Edit the original order instead.');
  }

  // Check 5: Cannot edit split child orders
  if (order.order_subtype === 'split_child') {
    blockers.push('Cannot edit split child orders. Edit the parent order instead.');
  }

  // Check 6: Retail orders closed immediately (optional strictness)
  if (
    order.is_retail &&
    order.current_status === 'closed'
  ) {
    blockers.push('Retail orders cannot be edited after completion');
  }

  return blockers.length > 0
    ? { canEdit: false, reason: blockers[0], blockers }
    : { canEdit: true };
}

/**
 * Determines if an order can be deleted
 *
 * @param order - Order object with status, payments, and metadata
 * @returns EditabilityCheckResult with canEdit flag, reason, and blockers
 */
export function canDeleteOrder(order: OrderForDeleteCheck): EditabilityCheckResult {
  const blockers: string[] = [];

  // Check 1: Order must have a valid status
  if (!order.current_status) {
    blockers.push('Order status is unknown or missing');
    return { canEdit: false, reason: blockers[0], blockers };
  }

  // Check 2: Can only delete draft or intake orders
  if (order.current_status !== 'draft' && order.current_status !== 'intake') {
    blockers.push('Only draft or intake orders can be deleted');
  }

  // Check 3: Cannot delete if payments exist
  if (order.paid_amount && order.paid_amount > 0) {
    blockers.push('Cannot delete order with payments. Refund payments first.');
  }

  // Check 4: Cannot delete split orders
  if (order.has_split) {
    blockers.push('Cannot delete split orders');
  }

  // Check 5: Cannot delete split child orders
  if (order.order_subtype === 'split_child') {
    blockers.push('Cannot delete split child orders. Delete the parent order instead.');
  }

  return blockers.length > 0
    ? { canEdit: false, reason: blockers[0], blockers }
    : { canEdit: true };
}

/**
 * Quick status check for Edit order.
 * Live Preparation uses `preparing`; `preparation` is the legacy alias.
 *
 * @param status - order current_status
 */
export function isEditableStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (EDITABLE_STATUS_CODES as readonly string[]).includes(status);
}

/**
 * Helper to check if processing has started
 * @param status
 */
export function hasProcessingStarted(status: string | null | undefined): boolean {
  if (!status) return false;
  return PROCESSING_STARTED_STATUSES.includes(status as OrderStatus);
}

/**
 * Get human-readable message for why order cannot be edited
 * @param order
 * @param locale
 */
export function getEditabilityMessage(
  order: OrderForEditabilityCheck,
  locale: 'en' | 'ar' = 'en'
): string {
  const check = isOrderEditable(order);

  if (check.canEdit) {
    return locale === 'ar'
      ? 'يمكن تعديل هذا الطلب'
      : 'This order can be edited';
  }

  return check.reason || (locale === 'ar'
    ? 'لا يمكن تعديل هذا الطلب'
    : 'This order cannot be edited');
}
