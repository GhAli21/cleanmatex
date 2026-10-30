/**
 * Speed premium resolution (PLAN.md §7, ADR-060 §5 step 3, L1/L2/L9/L20).
 *
 * Why: the premium comes from `org_speed_price_rules_cf` and is added on top
 * of the standard price whatever the customer list (PF-08: B2B/VIP express
 * lost the premium). `service_speed` is the only speed signal (PF-09).
 *
 * Pure: the loader passes the tenant's candidate rules; nothing is fetched.
 */
import {
  PRICE_BASIS,
  SERVICE_SPEEDS,
  SPEED_PRICE_TYPES,
  type PriceBasis,
  type SpeedPriceType,
} from '@/lib/constants/commercial';
import { ZERO, toMoney, type Money, type MoneyInput } from './money';

/**
 * Rule specificity, most specific first (PLAN.md §7). Product beats
 * category beats tenant; within each, the branch rule beats the general one.
 */
export const SPEED_RULE_LEVELS = [
  'PRODUCT_BRANCH',
  'PRODUCT',
  'CATEGORY_BRANCH',
  'CATEGORY',
  'TENANT_BRANCH',
  'TENANT',
] as const;
/** One of the six specificity levels. */
export type SpeedRuleLevel = (typeof SPEED_RULE_LEVELS)[number];

/** One `org_speed_price_rules_cf` row, as the loader passes it. */
export interface SpeedRuleCandidate {
  id: string;
  /** `sys_service_speed_cd.code`; open string so new DB speeds need no code change. */
  serviceSpeed: string;
  branchId: string | null;
  serviceCategoryCode: string | null;
  productId: string | null;
  speedPriceType: SpeedPriceType;
  defaultSpeedSellPrice: MoneyInput | null;
  multiplierSpeed: MoneyInput | null;
  speedExtraAmount: MoneyInput | null;
  /** FIXED_AMOUNT only; NULL means PER_UNIT. */
  priceBasis: PriceBasis | null;
  turnaroundHhSpeed: MoneyInput | null;
  /** `YYYY-MM-DD`. */
  effectiveFrom: string;
  effectiveTo: string | null;
  /** False when `is_active` is false or `rec_status` is not 1. */
  isActive: boolean;
}

/** The row being priced. */
export interface SpeedContext {
  serviceSpeed: string;
  branchId: string | null;
  serviceCategoryCode: string | null;
  /** Null for a custom item: only category and tenant rules can apply. */
  productId: string | null;
  /** Business date in the tenant's time zone, `YYYY-MM-DD`. */
  businessDate: string;
}

/** The winning rule and the level it matched at. */
export interface SelectedSpeedRule {
  rule: SpeedRuleCandidate;
  level: SpeedRuleLevel;
}

const levelOf = (rule: SpeedRuleCandidate): SpeedRuleLevel => {
  const branch = rule.branchId != null;
  if (rule.productId != null) return branch ? 'PRODUCT_BRANCH' : 'PRODUCT';
  if (rule.serviceCategoryCode != null) return branch ? 'CATEGORY_BRANCH' : 'CATEGORY';
  return branch ? 'TENANT_BRANCH' : 'TENANT';
};

// Every scope a rule sets must match the row; an unset scope matches anything.
const matches = (rule: SpeedRuleCandidate, ctx: SpeedContext): boolean =>
  rule.isActive
  && rule.serviceSpeed === ctx.serviceSpeed
  && rule.effectiveFrom <= ctx.businessDate
  && (rule.effectiveTo == null || rule.effectiveTo >= ctx.businessDate)
  && (rule.branchId == null || rule.branchId === ctx.branchId)
  && (rule.serviceCategoryCode == null || rule.serviceCategoryCode === ctx.serviceCategoryCode)
  && (rule.productId == null || rule.productId === ctx.productId);

/**
 * Picks the most specific active, effective rule for the row.
 *
 * The scope unique index includes `effective_from`, so two rules at the same
 * scope can overlap in time. The later `effective_from` wins (it supersedes
 * the older rule), then the lower id, so the choice is always deterministic.
 * @param ctx the row's speed, branch, category, product and business date
 * @param rules the tenant's candidate rules (any speed, any scope)
 * @returns the winning rule and its level, or null when none applies
 * @example
 * selectSpeedRule({ serviceSpeed: 'EXPRESS', branchId: null, serviceCategoryCode: 'DRY',
 *   productId: 'p1', businessDate: '2026-10-24' }, rules)?.level; // 'PRODUCT'
 */
export function selectSpeedRule(
  ctx: SpeedContext,
  rules: readonly SpeedRuleCandidate[],
): SelectedSpeedRule | null {
  let best: SelectedSpeedRule | null = null;
  for (const rule of rules) {
    if (!matches(rule, ctx)) continue;
    const level = levelOf(rule);
    if (!best) {
      best = { rule, level };
      continue;
    }
    const rank = SPEED_RULE_LEVELS.indexOf(level) - SPEED_RULE_LEVELS.indexOf(best.level);
    const better = rank < 0
      || (rank === 0 && (rule.effectiveFrom > best.rule.effectiveFrom
        || (rule.effectiveFrom === best.rule.effectiveFrom && rule.id < best.rule.id)));
    if (better) best = { rule, level };
  }
  return best;
}

/** Why the premium is what it is; the UI explains each outcome (rule #15). */
export const SPEED_PRICING_OUTCOMES = {
  /** The row is at standard speed: no premium by definition. */
  STANDARD_SPEED: 'STANDARD_SPEED',
  /** A rule priced the premium. */
  RULE_APPLIED: 'RULE_APPLIED',
  /** A non-standard speed with no rule: no premium, and the cart says so. */
  NO_RULE: 'NO_RULE',
  /** Order Edit kept the line's stored premium: its speed and price did not change (L24). */
  RECORDED: 'RECORDED',
} as const;
/** Derived union of the speed pricing outcomes. */
export type SpeedPricingOutcome = (typeof SPEED_PRICING_OUTCOMES)[keyof typeof SPEED_PRICING_OUTCOMES];

/** Configuration problems the resolver survives but the UI must show. */
export const SPEED_PRICING_WARNINGS = {
  /** A SELL_PRICE rule is below the product's normal price; the premium is held at 0. */
  SELL_PRICE_BELOW_STANDARD: 'SELL_PRICE_BELOW_STANDARD',
} as const;
/** Derived union of the speed pricing warnings. */
export type SpeedPricingWarning = (typeof SPEED_PRICING_WARNINGS)[keyof typeof SPEED_PRICING_WARNINGS];

/** Inputs for one row's speed premium. */
export interface SpeedPricingInput extends SpeedContext {
  /** Standard unit price from `resolveStandardPrice` (the customer's price). */
  standardUnitPrice: MoneyInput;
  /**
   * The price a SELL_PRICE rule was authored against: the product's default
   * sell price. Null for a custom item, which falls back to `standardUnitPrice`.
   */
  referenceUnitPrice: MoneyInput | null;
  /** Line quantity (may be fractional, e.g. kilograms). */
  quantity: MoneyInput;
  rules: readonly SpeedRuleCandidate[];
}

/** The premium for one row, split so the writer can explain it. */
export interface SpeedPricingResult {
  outcome: SpeedPricingOutcome;
  serviceSpeed: string;
  ruleId: string | null;
  ruleLevel: SpeedRuleLevel | null;
  speedPriceType: SpeedPriceType | null;
  /** Premium inside each unit (L2). */
  unitPremium: Money;
  /** A FIXED_AMOUNT PER_LINE premium, added once to the line gross. */
  linePremium: Money;
  /** `standardUnitPrice + unitPremium`, before any override or modifier. */
  unitPrice: Money;
  /** `unitPremium × quantity + linePremium`: the line's `speed_premium_amount`. */
  premiumAmount: Money;
  /** Hours at this speed from the rule; null means the caller's standard turnaround. */
  turnaroundHours: Money | null;
  warnings: SpeedPricingWarning[];
}

const requireValue = (value: MoneyInput | null, rule: SpeedRuleCandidate): Money => {
  if (value == null) {
    throw new Error(`Speed rule ${rule.id} (${rule.speedPriceType}) has no value for its price type.`);
  }
  return toMoney(value);
};

/**
 * Prices one row's speed premium on top of its standard price.
 *
 * - SELL_PRICE: premium = rule price − reference price (never below 0).
 * - MULTIPLIER: premium = standard price × multiplier (L20: 10 × 0.30 → +3).
 * - FIXED_AMOUNT: premium = the amount, per unit or once per line.
 * @param input the row context, its standard and reference prices, quantity and candidate rules
 * @returns the premium split into unit and line parts, with the rule that set it
 * @throws Error when the chosen rule lacks the value its price type needs
 * @example
 * resolveSpeedPricing({ ...ctx, standardUnitPrice: '10', referenceUnitPrice: '10',
 *   quantity: 2, rules: [multiplierRule030] }).premiumAmount.toString(); // '6'
 */
export function resolveSpeedPricing(input: SpeedPricingInput): SpeedPricingResult {
  const standard = toMoney(input.standardUnitPrice);
  const quantity = toMoney(input.quantity);
  const base = {
    serviceSpeed: input.serviceSpeed,
    unitPremium: ZERO,
    linePremium: ZERO,
    unitPrice: standard,
    premiumAmount: ZERO,
    turnaroundHours: null,
    warnings: [] as SpeedPricingWarning[],
  };
  const none = (outcome: SpeedPricingOutcome): SpeedPricingResult => ({
    ...base, outcome, ruleId: null, ruleLevel: null, speedPriceType: null,
  });

  if (input.serviceSpeed === SERVICE_SPEEDS.STANDARD) return none(SPEED_PRICING_OUTCOMES.STANDARD_SPEED);
  const selected = selectSpeedRule(input, input.rules);
  if (!selected) return none(SPEED_PRICING_OUTCOMES.NO_RULE);

  const { rule, level } = selected;
  const warnings: SpeedPricingWarning[] = [];
  let unitPremium = ZERO;
  let linePremium = ZERO;

  switch (rule.speedPriceType) {
    case SPEED_PRICE_TYPES.SELL_PRICE: {
      const reference = input.referenceUnitPrice == null ? standard : toMoney(input.referenceUnitPrice);
      const delta = requireValue(rule.defaultSpeedSellPrice, rule).minus(reference);
      // A speed price below normal would be a hidden discount: hold at 0 and say so.
      if (delta.isNegative()) warnings.push(SPEED_PRICING_WARNINGS.SELL_PRICE_BELOW_STANDARD);
      else unitPremium = delta;
      break;
    }
    case SPEED_PRICE_TYPES.MULTIPLIER:
      unitPremium = standard.times(requireValue(rule.multiplierSpeed, rule));
      break;
    case SPEED_PRICE_TYPES.FIXED_AMOUNT: {
      const amount = requireValue(rule.speedExtraAmount, rule);
      if (rule.priceBasis === PRICE_BASIS.PER_LINE) linePremium = amount;
      else unitPremium = amount;
      break;
    }
    default:
      throw new Error(`Unknown speed price type: ${String(rule.speedPriceType)}`);
  }

  return {
    outcome: SPEED_PRICING_OUTCOMES.RULE_APPLIED,
    serviceSpeed: input.serviceSpeed,
    ruleId: rule.id,
    ruleLevel: level,
    speedPriceType: rule.speedPriceType,
    unitPremium,
    linePremium,
    unitPrice: standard.plus(unitPremium),
    premiumAmount: unitPremium.times(quantity).plus(linePremium),
    turnaroundHours: rule.turnaroundHhSpeed == null ? null : toMoney(rule.turnaroundHhSpeed),
    warnings,
  };
}
