/**
 * Speed Pricing requests (Line-Level P7-01, PLAN §7, §10.1). Mirrors every
 * `org_speed_price_rules_cf` CHECK so a bad rule is refused before save:
 * one value column per type, `price_basis` only on FIXED_AMOUNT, no STANDARD
 * rule, non-negative amounts, `effective_to >= effective_from`. The speed code
 * itself is checked against `sys_service_speed_cd` by the service.
 */
import { z } from 'zod';

import { PRICE_BASIS, SERVICE_SPEEDS, SPEED_PRICE_TYPES } from '@/lib/constants/commercial';

const money = z.string().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Amount with up to 4 decimals');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const types = Object.values(SPEED_PRICE_TYPES) as [string, ...string[]];
const bases = Object.values(PRICE_BASIS) as [string, ...string[]];

const ruleFields = z.object({
  serviceSpeed: z.string().min(1).max(40).refine((v) => v !== SERVICE_SPEEDS.STANDARD, 'STANDARD has no premium'),
  branchId: z.string().uuid().nullable(),
  serviceCategoryCode: z.string().min(1).max(60).nullable(),
  productId: z.string().uuid().nullable(),
  speedPriceType: z.enum(types),
  defaultSpeedSellPrice: money.nullable().optional(),
  multiplierSpeed: z.string().regex(/^\d{1,4}(\.\d{1,4})?$/).nullable().optional(),
  speedExtraAmount: money.nullable().optional(),
  priceBasis: z.enum(bases).nullable().optional(),
  turnaroundHhSpeed: z.string().regex(/^\d{1,4}(\.\d{1,2})?$/).nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  name2: z.string().max(200).nullable().optional(),
  effectiveFrom: date,
  effectiveTo: date.nullable().optional(),
  isActive: z.boolean().optional(),
});

/** The value columns must match the type exactly (CHECK `chk_org_spd_price_rules_value_cols`). */
function checkValues(v: z.infer<typeof ruleFields>, ctx: z.RefinementCtx) {
  const set = (x: unknown) => x !== undefined && x !== null && x !== '';
  const need = {
    SELL_PRICE: 'defaultSpeedSellPrice',
    MULTIPLIER: 'multiplierSpeed',
    FIXED_AMOUNT: 'speedExtraAmount',
  } as const;
  for (const [type, field] of Object.entries(need)) {
    const present = set(v[field]);
    if (v.speedPriceType === type && !present) ctx.addIssue({ code: 'custom', path: [field], message: 'Required for this price type' });
    if (v.speedPriceType !== type && present) ctx.addIssue({ code: 'custom', path: [field], message: 'Not used by this price type' });
  }
  if (set(v.priceBasis) && v.speedPriceType !== SPEED_PRICE_TYPES.FIXED_AMOUNT) {
    ctx.addIssue({ code: 'custom', path: ['priceBasis'], message: 'Only for a fixed amount' });
  }
  if (v.effectiveTo && v.effectiveTo < v.effectiveFrom) {
    ctx.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Ends before it starts' });
  }
}

/** POST body. */
export const speedRuleCreateSchema = ruleFields.superRefine(checkValues);
export type SpeedRuleCreateInput = z.infer<typeof speedRuleCreateSchema>;

/**
 * PATCH body: the full rule as it should be after the edit (scope, type and
 * values are validated together), so a partial change can never leave the
 * value columns inconsistent.
 */
export const speedRuleUpdateSchema = speedRuleCreateSchema;

/** POST bulk body: one product rule per product of this category. */
export const speedRuleBulkSchema = ruleFields
  .extend({ serviceCategoryCode: z.string().min(1).max(60), productId: z.null().default(null) })
  .superRefine(checkValues);
export type SpeedRuleBulkInput = z.infer<typeof speedRuleBulkSchema>;

/** GET list filters. */
export const speedRuleListQuerySchema = z.object({
  serviceSpeed: z.string().max(40).optional(),
  branchId: z.string().uuid().optional(),
  serviceCategoryCode: z.string().max(60).optional(),
  productId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET resolve: which rule would price this product at this speed, branch and date. */
export const speedRuleResolveQuerySchema = z.object({
  serviceSpeed: z.string().min(1).max(40),
  productId: z.string().uuid().optional(),
  serviceCategoryCode: z.string().max(60).optional(),
  branchId: z.string().uuid().optional(),
  date: date.optional(),
});
