/**
 * Order Number Generator (compatibility module).
 *
 * The implementation lives in `@/lib/services/order-numbering`. This module
 * keeps the old import path working; new code should import from the service.
 *
 * Format: ORD-YYYYMMDD-NNNN (4 digits minimum, 5+ after 9999 per day),
 * sub-orders <root>-S<n>. Numbers come from the DB engine (gapless, per tenant per day).
 */

export {
  generateOrderNumber,
  generateOrderNumberWithTx,
  nextSubOrderNoWithTx,
  isValidOrderNumber,
  parseOrderNumber,
  getOrderNumberPrefix,
  formatSequence,
  extractSequence,
  type OrderNumberResult,
} from '@/lib/services/order-numbering';
