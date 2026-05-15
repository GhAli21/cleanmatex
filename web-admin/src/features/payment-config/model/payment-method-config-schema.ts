import { z } from 'zod';
import { PAYMENT_NATURE, FEE_TYPES } from '@/lib/constants/payment';

const paymentMethodConfigBaseSchema = z.object({
  payment_method_code: z.string().min(1),
  gateway_code: z.string().optional(),
  display_name: z.string().min(1).max(250),
  display_name2: z.string().max(250).optional(),
  description: z.string().optional(),
  description2: z.string().optional(),
  payment_nature: z.enum([
    PAYMENT_NATURE.REAL_PAYMENT,
    PAYMENT_NATURE.CREDIT_APPLICATION,
    PAYMENT_NATURE.AR_ALLOCATION,
    PAYMENT_NATURE.DEFERRED_SETTLEMENT,
    PAYMENT_NATURE.INTERNAL_ADJUSTMENT,
  ]),
  allowed_in_pos: z.boolean().optional(),
  allowed_in_customer_app: z.boolean().optional(),
  allowed_in_staff_app: z.boolean().optional(),
  allowed_in_admin_app: z.boolean().optional(),
  allowed_for_pay_now: z.boolean().optional(),
  allowed_for_pay_on_collection: z.boolean().optional(),
  allowed_for_invoice_payment: z.boolean().optional(),
  allowed_for_refund: z.boolean().optional(),
  supports_partial_payment: z.boolean().optional(),
  supports_overpayment: z.boolean().optional(),
  supports_change_return: z.boolean().optional(),
  requires_reference: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  min_amount: z.number().nonnegative().optional(),
  max_amount: z.number().nonnegative().optional(),
  currency_code: z.string().length(3).optional(),
  fee_type: z.enum([FEE_TYPES.NONE, FEE_TYPES.FIXED, FEE_TYPES.PERCENTAGE]).optional(),
  fee_amount: z.number().nonnegative().optional(),
  fee_rate: z.number().nonnegative().optional(),
  display_order: z.number().int().nonnegative().optional(),
});

/** Create form schema keeps cross-field validation outside the reusable base object. */
export const createPaymentMethodConfigSchema = paymentMethodConfigBaseSchema.refine(
  (d) => d.max_amount == null || d.min_amount == null || d.max_amount >= d.min_amount,
  { message: 'Max amount must be >= min amount', path: ['max_amount'] }
);

/** Update form schema must partialize before refine because refined Zod schemas cannot be partialized. */
export const updatePaymentMethodConfigSchema = paymentMethodConfigBaseSchema
  .omit({ payment_method_code: true })
  .partial()
  .refine(
    (d) => d.max_amount == null || d.min_amount == null || d.max_amount >= d.min_amount,
    { message: 'Max amount must be >= min amount', path: ['max_amount'] }
  );

export const hyperPayGatewayConfigSchema = z.object({
  entityId: z.string().min(1),
  apiKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  testMode: z.boolean(),
  supportedBrands: z.array(z.string()),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const stripeGatewayConfigSchema = z.object({
  publishableKey: z.string().min(1),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  testMode: z.boolean(),
  supportedBrands: z.array(z.string()),
});

export const payTabsGatewayConfigSchema = z.object({
  entityId: z.string().min(1),
  apiKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  testMode: z.boolean(),
  supportedBrands: z.array(z.string()),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreatePaymentMethodConfigFormValues = z.infer<typeof createPaymentMethodConfigSchema>;
export type UpdatePaymentMethodConfigFormValues = z.infer<typeof updatePaymentMethodConfigSchema>;
