/**
 * Payment Form Schema
 * Zod validation schemas for payment processing
 */

import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';

/**
 * Payment method schema
 * Includes all payment methods used in the payment modal
 */
const paymentMethodSchema = z.enum([
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.CHECK,
  PAYMENT_METHODS.GIFT_CARD,
  PAYMENT_METHODS.PROMO_CODE,
  PAYMENT_METHODS.PAY_ON_COLLECTION,
  PAYMENT_METHODS.BANK_TRANSFER,
  PAYMENT_METHODS.MOBILE_PAYMENT,
  PAYMENT_METHODS.HYPERPAY,
  PAYMENT_METHODS.PAYTABS,
  PAYMENT_METHODS.STRIPE,
  PAYMENT_METHODS.INVOICE, // Invoice payment
   //'pay_on_collection', // Pay on collection/delivery
   //'invoice', // Invoice payment
]);

/**
 * Payment form schema
 */
// Helper to normalize empty strings to undefined
const emptyStringToUndefined = z.preprocess(
  (val) => (val === '' || (typeof val === 'string' && val.trim() === '') ? undefined : val),
  z.string().optional()
);

const paymentFormBaseSchema = z.object({
  paymentMethod: paymentMethodSchema,
  checkNumber: z.string().optional(),
  checkBank: z.string().optional(),
  checkDate: z.string().optional(), // ISO date string from input[type="date"]
  percentDiscount: z.number().min(0).max(100).default(0),
  amountDiscount: z.number().nonnegative().default(0),
  promoCode: emptyStringToUndefined,
  promoCodeId: z.string().uuid().optional().or(z.literal('')),
  promoDiscount: z.number().nonnegative().optional(),
  giftCardNumber: emptyStringToUndefined,
  giftCardAmount: z.number().nonnegative().optional(),
  payAllOrders: z.boolean().default(false),
});

/**
 * Base schema (no subtotal-dependent validation).
 * Use getPaymentFormSchema(subtotal) when subtotal is available for discount validation.
 */
export const paymentFormSchema = paymentFormBaseSchema
  .refine(
    (data) => {
      if (data.paymentMethod === PAYMENT_METHODS.CHECK) {
        return !!data.checkNumber && data.checkNumber.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Check number is required when payment method is check',
      path: ['checkNumber'],
    }
  )
  .refine(
    (data) => {
      // If promo code is provided (non-empty), promoCodeId should be provided
      const hasPromoCode = data.promoCode && data.promoCode.trim().length > 0;
      if (hasPromoCode && !data.promoCodeId) {
        return false;
      }
      return true;
    },
    {
      message: 'Promo code ID is required when promo code is provided',
      path: ['promoCodeId'],
    }
  )
  .refine(
    (data) => {
      const hasGiftCard = data.giftCardNumber && data.giftCardNumber.trim().length > 0;
      if (hasGiftCard && !data.giftCardAmount) {
        return false;
      }
      return true;
    },
    {
      message: 'Gift card amount is required when gift card number is provided',
      path: ['giftCardAmount'],
    }
  );

/**
 * Payment form schema with discount validation against subtotal.
 * Use this when subtotal is available (e.g. in payment modal).
 * @param subtotal Order subtotal (before discount)
 * @param message Optional i18n message (default: "Discount cannot exceed order total")
 */
export function getPaymentFormSchema(
  subtotal: number,
  message = 'Discount cannot exceed order total'
) {
  return paymentFormSchema.refine(
    (data) => {
      const effectiveDiscount =
        data.percentDiscount > 0
          ? (subtotal * data.percentDiscount) / 100
          : data.amountDiscount;
      return effectiveDiscount <= Math.max(0, subtotal);
    },
    {
      message,
      path: ['amountDiscount'],
    }
  );
}

/**
 * Type inference for payment form
 */
export type PaymentFormData = z.infer<typeof paymentFormSchema>;

