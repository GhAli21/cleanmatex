import { z } from 'zod';
import { SALES_PRICING_MODE } from '@/lib/constants/currency-fx';

const NONE_VALUE = '__none__';

/** Coerces the dialog's "None" sentinel option back to null for optional catalog-code selects. */
const optionalCodeSelect = z
  .string()
  .optional()
  .transform((v) => (v && v !== NONE_VALUE ? v : null));

export const currencyContextSchema = z.object({
  allowSales: z.boolean().default(false),
  allowPayments: z.boolean().default(false),
  allowCash: z.boolean().default(false),
  allowAr: z.boolean().default(false),
});

export const currencyPolicySchema = z.object({
  salesPricingMode: z.literal(SALES_PRICING_MODE.CONVERT_FROM_BASE).default(SALES_PRICING_MODE.CONVERT_FROM_BASE),
  defaultRateTypeCode: optionalCodeSelect,
  defaultRateSourceCode: optionalCodeSelect,
  rateMaxAgeDays: z.coerce.number().int().positive().nullable().optional(),
  allowManualFxRate: z.boolean().default(false),
  manualFxRequiresApproval: z.boolean().default(true),
  manualRateTolerancePct: z.coerce.number().min(0).max(100).nullable().optional(),
  taxRateSourceCode: optionalCodeSelect,
});

export const addCurrencyFormSchema = z
  .object({ currencyCode: z.string().min(1) })
  .merge(currencyContextSchema)
  .merge(currencyPolicySchema);

export const editCurrencyFormSchema = currencyContextSchema.merge(currencyPolicySchema);

export type AddCurrencyFormValues = z.infer<typeof addCurrencyFormSchema>;
export type EditCurrencyFormValues = z.infer<typeof editCurrencyFormSchema>;

export { NONE_VALUE };
