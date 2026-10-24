/** Bounded inputs for an authenticated, non-posting payment quote. */
import { z } from 'zod';
import { previewPaymentRequestSchema } from './new-order-payment-schemas';

/** Transport/work limits prevent accidental fan-out while supporting large cashier orders. */
export const PAYMENT_QUOTE_LIMITS = {
  // One MiB bounds JSON allocation independently of an untrusted Content-Length header.
  MAX_BODY_BYTES: 1024 * 1024,
  // Cap line-level pricing fan-out while allowing large cashier orders.
  MAX_ITEMS: 1000,
  // Bound the HTTP response wait; this does not cancel already-running database work.
  SERVER_TIMEOUT_MS: 15_000,
} as const;

const optionalContextId = z.preprocess(
  (value) => value === '' || value == null ? undefined : value,
  z.string().uuid().optional(),
);

/** Reuses the existing commercial contract; identity is always resolved server-side. */
export const paymentQuoteRequestSchema = previewPaymentRequestSchema.extend({
  // Correlation remains bounded and transport-safe; it grants no access to persisted resources.
  requestId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9:_-]+$/),
  items: previewPaymentRequestSchema.shape.items.max(PAYMENT_QUOTE_LIMITS.MAX_ITEMS),
  branchId: optionalContextId,
  customerId: optionalContextId,
  serviceCategories: z.array(z.string().max(100)).max(1000).optional(),
  taxProfileIds: z.array(z.string().uuid()).max(100).optional(),
  promoCode: z.string().max(200).optional(),
  giftCardNumber: z.string().max(200).optional(),
});
