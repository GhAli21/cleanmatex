import { z } from 'zod';

import { CASH_TRANSIT_STATUS } from '@/lib/constants/cash-drawer';
import { pageQuerySchema } from '@/lib/validations/cash-drawer/list-schemas';

/**
 * Request schemas for in-transit cash transfers (D1-4). The amount is an exact decimal string —
 * never a JS number — so what the user typed is what is booked, to the 4 stored decimals.
 */

/** Positive decimal with at most 4 fraction digits, e.g. `12`, `12.5`, `0.0050`. */
export const transitAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, 'Expected a positive decimal amount with at most 4 decimals')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero');

export const sendTransitRequestSchema = z.object({
  sourceDrawerId: z.string().uuid(),
  destDrawerId: z.string().uuid(),
  amount: transitAmountSchema,
  notes: z.string().trim().max(1000).optional(),
  carriedByUserId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export const cancelTransitRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const transitListQuerySchema = pageQuerySchema.extend({
  status: z.enum([...Object.values(CASH_TRANSIT_STATUS), 'ALL'] as unknown as [string, ...string[]]).default(CASH_TRANSIT_STATUS.IN_TRANSIT),
});

export type SendTransitRequest = z.infer<typeof sendTransitRequestSchema>;
export type CancelTransitRequest = z.infer<typeof cancelTransitRequestSchema>;
