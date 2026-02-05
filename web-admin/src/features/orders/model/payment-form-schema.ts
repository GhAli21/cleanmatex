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

export const paymentFormSchema = z
  .object({
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
  })
  .refine(
    (data) => {
      // If payment method is CHECK, checkNumber is required
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
      // Cannot have both percent and amount discount
      return !(data.percentDiscount > 0 && data.amountDiscount > 0);
    },
    {
      message: 'Cannot apply both percent and amount discount',
      path: ['amountDiscount'],
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
      // If gift card number is provided (non-empty), gift card amount should be provided
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
 * Type inference for payment form
 */
export type PaymentFormData = z.infer<typeof paymentFormSchema>;

