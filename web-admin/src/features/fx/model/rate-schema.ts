import { z } from 'zod';
import { RATE_PATTERN } from '@/lib/services/fx/fx-decimal';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const createRateFormSchema = z.object({
  fromCurrencyCode: z.string().min(1),
  toCurrencyCode: z.string().min(1),
  rateTypeCode: z.string().min(1),
  sourceCode: z.string().min(1),
  rateDate: z.string().regex(DATE_PATTERN),
  rate: z.string().regex(RATE_PATTERN, 'Expected up to 12 integer and 10 decimal digits'),
  sourceReference: z.string().optional(),
  notes: z.string().optional(),
  approveNow: z.boolean().default(false),
});

export const updateRateFormSchema = z.object({
  rateTypeCode: z.string().min(1).optional(),
  sourceCode: z.string().min(1).optional(),
  rateDate: z.string().regex(DATE_PATTERN).optional(),
  rate: z.string().regex(RATE_PATTERN, 'Expected up to 12 integer and 10 decimal digits').optional(),
  sourceReference: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateRateFormValues = z.infer<typeof createRateFormSchema>;
export type UpdateRateFormValues = z.infer<typeof updateRateFormSchema>;
