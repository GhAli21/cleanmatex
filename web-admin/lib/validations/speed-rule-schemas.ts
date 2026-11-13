/**
 * Speed Pricing requests (Line-Level P7-01, PLAN §7, §10.1). Mirrors every
 * `org_speed_price_rules_cf` CHECK so a bad rule is refused before save:
 * one value column per type, `price_basis` only on FIXED_AMOUNT, no STANDARD
 * rule, `effective_to >= effective_from`, turnaround unit <=> value
 * (`chk_org_spd_price_rules_turn_unit`), multiplier > -1. A negative multiplier
 * or amount (a discount) is accepted here; the service allows it only for a
 * speed ranked below STANDARD (ECONOMY, `DISCOUNT_NOT_ALLOWED`) and checks the
 * speed code against `sys_service_speed_cd`. Hours with no unit read as HOURS.
 */
import { z } from 'zod';

import { PRICE_BASIS, SERVICE_SPEEDS, SPEED_PRICE_TYPES, TURNAROUND_UNITS } from '@/lib/constants/commercial';
import { isoDateSchema } from '@/lib/validations/iso-date';

/** Longest turnaround a rule may ask for: the calendar engine scans 400 days, so more would never resolve. */
export const MAX_TURNAROUND_WORKING_DAYS = 60;
/** Longest HOURS turnaround (about three working weeks of 24 h). */
export const MAX_TURNAROUND_HOURS = 500;

const money = z.string().regex(/^\d{1,15}(\.\d{1,4})?$/, 'Amount with up to 4 decimals');
/** A premium that may be a discount (negative): allowed by rank in the service. */
const signedMoney = z.string().regex(/^-?\d{1,15}(\.\d{1,4})?$/, 'Amount with up to 4 decimals');
const units = Object.values(TURNAROUND_UNITS) as [string, ...string[]];
const date = isoDateSchema;
const types = Object.values(SPEED_PRICE_TYPES) as [string, ...string[]];
const bases = Object.values(PRICE_BASIS) as [string, ...string[]];

const ruleFields = z.object({
  serviceSpeed: z.string().min(1).max(40).refine((v) => v !== SERVICE_SPEEDS.STANDARD, 'STANDARD has no premium'),
  branchId: z.string().guid().nullable(),
  serviceCategoryCode: z.string().min(1).max(60).nullable(),
  productId: z.string().guid().nullable(),
  speedPriceType: z.enum(types),
  defaultSpeedSellPrice: money.nullable().optional(),
  multiplierSpeed: z.string().regex(/^-?\d{1,4}(\.\d{1,4})?$/).nullable().optional(),
  speedExtraAmount: signedMoney.nullable().optional(),
  priceBasis: z.enum(bases).nullable().optional(),
  turnaroundHhSpeed: z.string().regex(/^\d{1,4}(\.\d{1,2})?$/)
    .refine((v) => Number(v) <= MAX_TURNAROUND_HOURS, `At most ${MAX_TURNAROUND_HOURS} hours`).nullable().optional(),
  turnaroundUnit: z.enum(units).nullable().optional(),
  /** WORKING_DAYS only: 0 = same day (before the cut-off). */
  turnaroundDaysSpeed: z.number().int().min(0).max(MAX_TURNAROUND_WORKING_DAYS).nullable().optional(),
  /** `HH:MM`: this speed's own last drop-off time; null = the branch's cut-off. */
  cutoffTimeSpeed: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM').nullable().optional(),
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
  if (set(v.multiplierSpeed) && Number(v.multiplierSpeed) <= -1) {
    ctx.addIssue({ code: 'custom', path: ['multiplierSpeed'], message: 'A discount must be less than 100%' });
  }
  // Unit <=> value (chk_org_spd_price_rules_turn_unit); hours with no unit are HOURS.
  const hours = set(v.turnaroundHhSpeed);
  const days = set(v.turnaroundDaysSpeed);
  const unit = v.turnaroundUnit ?? (hours ? TURNAROUND_UNITS.HOURS : null);
  if (unit === TURNAROUND_UNITS.HOURS && (!hours || days)) {
    ctx.addIssue({ code: 'custom', path: [hours ? 'turnaroundDaysSpeed' : 'turnaroundHhSpeed'], message: 'Hours only for an HOURS turnaround' });
  }
  if (unit === TURNAROUND_UNITS.WORKING_DAYS && (!days || hours)) {
    ctx.addIssue({ code: 'custom', path: [days ? 'turnaroundHhSpeed' : 'turnaroundDaysSpeed'], message: 'Days only for a WORKING_DAYS turnaround' });
  }
  if (unit == null && days) {
    ctx.addIssue({ code: 'custom', path: ['turnaroundUnit'], message: 'Choose the turnaround unit' });
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

/** POST bulk status: retires or restores the product rules of a speed; `dryRun` only counts. */
export const speedRuleBulkStatusSchema = z.object({
  serviceSpeed: z.string().min(1).max(40),
  serviceCategoryCode: z.string().min(1).max(60).nullable().default(null),
  isActive: z.boolean(),
  dryRun: z.boolean().default(false),
});
export type SpeedRuleBulkStatusInput = z.infer<typeof speedRuleBulkStatusSchema>;

/** GET list filters. */
export const speedRuleListQuerySchema = z.object({
  serviceSpeed: z.string().max(40).optional(),
  branchId: z.string().guid().optional(),
  serviceCategoryCode: z.string().max(60).optional(),
  productId: z.string().guid().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET resolve: which rule would price this product at this speed, branch and date. */
export const speedRuleResolveQuerySchema = z.object({
  serviceSpeed: z.string().min(1).max(40),
  productId: z.string().guid().optional(),
  serviceCategoryCode: z.string().max(60).optional(),
  branchId: z.string().guid().optional(),
  date: date.optional(),
});
