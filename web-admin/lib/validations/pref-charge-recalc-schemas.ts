import { z } from 'zod';

const PREF_CHARGE_RECALC_DEFAULT_LIMIT = 25;
const PREF_CHARGE_RECALC_MAX_LIMIT = 50;

export const prefChargeRecalcRequestSchema = z.object({
  mode: z.enum(['preview', 'confirm']),
  orderIds: z.array(z.string().uuid()).max(PREF_CHARGE_RECALC_MAX_LIMIT).optional(),
  limit: z.number().int().min(1).max(PREF_CHARGE_RECALC_MAX_LIMIT).optional()
    .default(PREF_CHARGE_RECALC_DEFAULT_LIMIT),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export type PrefChargeRecalcRequest = z.infer<typeof prefChargeRecalcRequestSchema>;
