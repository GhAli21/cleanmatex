/**
 * Order payment status helpers for Order Fin.
 *
 * Why:
 * The repo currently contains a mix of legacy lowercase values and newer
 * uppercase Order Fin snapshot values. Centralizing normalization lets the
 * UI, services, and reports compare one canonical contract instead of
 * sprinkling fragile string comparisons across the codebase.
 */

import { ORDER_PAYMENT_STATUS } from '@/lib/constants/order-financial';

/**
 * Minimal order payment context used to disambiguate old `pending` values.
 */
export interface OrderPaymentStatusContext {
  paymentTypeCode?: string | null;
  payOnCollectionAmount?: number | null;
  outstandingAmount?: number | null;
}

/**
 * Canonical normalized order payment status values for active Order Fin logic.
 */
export type NormalizedOrderPaymentStatus =
  | 'UNPAID'
  | 'PENDING_COLLECTION'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERPAID';

/**
 * Normalize legacy and mixed-case order payment status values into the
 * canonical Order Fin snapshot contract used by active financial logic.
 *
 * @param value raw value stored on the order header or returned by older code
 * @param context additional order context used to disambiguate deferred pending states
 * @returns canonical uppercase Order Fin status
 */
export function normalizeOrderPaymentStatus(
  value: string | null | undefined,
  context: OrderPaymentStatusContext = {}
): NormalizedOrderPaymentStatus {
  const raw = String(value ?? '').trim();
  const upper = raw.toUpperCase();

  switch (upper) {
    case ORDER_PAYMENT_STATUS.UNPAID:
      return ORDER_PAYMENT_STATUS.UNPAID;
    case ORDER_PAYMENT_STATUS.PENDING_COLLECTION:
      return ORDER_PAYMENT_STATUS.PENDING_COLLECTION;
    case ORDER_PAYMENT_STATUS.PARTIALLY_PAID:
    case 'PARTIAL':
    case 'PARTIALLY_PAID':
      return ORDER_PAYMENT_STATUS.PARTIALLY_PAID;
    case ORDER_PAYMENT_STATUS.PAID:
      return ORDER_PAYMENT_STATUS.PAID;
    case ORDER_PAYMENT_STATUS.OVERPAID:
      return ORDER_PAYMENT_STATUS.OVERPAID;
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return ORDER_PAYMENT_STATUS.PAID;
    case 'PENDING': {
      const isDeferred =
        context.paymentTypeCode === 'PAY_ON_COLLECTION' ||
        Number(context.payOnCollectionAmount ?? 0) > 0;
      return isDeferred
        ? ORDER_PAYMENT_STATUS.PENDING_COLLECTION
        : ORDER_PAYMENT_STATUS.UNPAID;
    }
    default:
      return ORDER_PAYMENT_STATUS.UNPAID;
  }
}

/**
 * True when the order no longer has any outstanding financial balance.
 *
 * @param value raw or normalized order payment status
 * @param context context used to normalize legacy values safely
 * @returns whether the order should be treated as fully paid or overpaid
 */
export function isOrderPaidStatus(
  value: string | null | undefined,
  context: OrderPaymentStatusContext = {}
): boolean {
  const normalized = normalizeOrderPaymentStatus(value, context);
  return normalized === ORDER_PAYMENT_STATUS.PAID || normalized === ORDER_PAYMENT_STATUS.OVERPAID;
}

/**
 * True when the order still carries an outstanding balance or deferred collection state.
 *
 * @param value raw or normalized order payment status
 * @param context context used to normalize legacy values safely
 * @returns whether the order should be treated as financially outstanding
 */
export function isOrderOutstandingStatus(
  value: string | null | undefined,
  context: OrderPaymentStatusContext = {}
): boolean {
  const normalized = normalizeOrderPaymentStatus(value, context);
  return normalized === ORDER_PAYMENT_STATUS.UNPAID
    || normalized === ORDER_PAYMENT_STATUS.PENDING_COLLECTION
    || normalized === ORDER_PAYMENT_STATUS.PARTIALLY_PAID;
}
