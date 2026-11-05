/**
 * Recorded order discounts on Order Edit (Reusable View D21, P1B-05).
 *
 * Why: an edit changes the order's base, so a discount granted at drop-off
 * must be applied again to the new base, never silently and never as a
 * fresh "best discount today". Each recorded ORDER discount, in its recorded
 * order (manual → rule → promo, as Create stacks them):
 * - manual percent: the recorded rate again; manual amount: kept, capped at the base;
 * - automatic rule: the same recorded rule (`source_id`), with its percent on
 *   the new base or its recorded amount capped; removed when the edited order
 *   no longer meets its conditions;
 * - promo: never redeemed again; percent on the new base within its maximum,
 *   amount kept and capped; removed when the edited order no longer meets its
 *   conditions (its use is given back at Apply).
 *
 * Only conditions the edit can change are checked (order amount, line count,
 * service categories). Validity dates, usage limits, customer tier and the
 * day or time of the order were met when the discount was granted and an edit
 * does not change them. A removal is shown in Review and needs the cashier's
 * acknowledgement (`DISCOUNT_REMOVED_GATE`).
 */
import { roundMoney, toMoney, type AdjustmentInput, type Money, type RoundingRule } from '@/lib/commercial';
import { DISCOUNT_CALC_TYPE, DISCOUNT_SOURCE_TYPE } from '@/lib/constants/discount-source-type';

/** What happened to one recorded discount. */
export const DISCOUNT_CHANGE_OUTCOMES = { KEPT: 'KEPT', CHANGED: 'CHANGED', REMOVED: 'REMOVED' } as const;
/** Derived union of the outcomes. */
export type DiscountChangeOutcome = (typeof DISCOUNT_CHANGE_OUTCOMES)[keyof typeof DISCOUNT_CHANGE_OUTCOMES];

/** Why a recorded discount was removed; Review shows each as an EN/AR line. */
export const DISCOUNT_REMOVAL_REASONS = {
  MIN_ORDER_NOT_MET: 'MIN_ORDER_NOT_MET',
  MAX_ORDER_EXCEEDED: 'MAX_ORDER_EXCEEDED',
  MIN_ITEMS_NOT_MET: 'MIN_ITEMS_NOT_MET',
  CATEGORY_NOT_APPLICABLE: 'CATEGORY_NOT_APPLICABLE',
  /** Earlier discounts already take the whole base. */
  NOTHING_TO_DISCOUNT: 'NOTHING_TO_DISCOUNT',
} as const;
/** Derived union of the removal reasons. */
export type DiscountRemovalReason = (typeof DISCOUNT_REMOVAL_REASONS)[keyof typeof DISCOUNT_REMOVAL_REASONS];

/** Gate code prefix of a removal acknowledgement in `gateDecisions`; the key follows the colon. */
export const DISCOUNT_REMOVED_GATE = 'DISCOUNT_REMOVED';
/** The `gateCode` that acknowledges one removal. */
export const discountRemovedGateCode = (key: string): string => `${DISCOUNT_REMOVED_GATE}:${key}`;

/** A rule's definition, as far as the edit reads it (`org_discount_rules_cf`). */
export interface EditDiscountRule {
  id: string;
  discountType: string;
  discountValue: string;
  /** `conditions` JSON: `min_order_amount`, `min_items`, `service_categories` are read. */
  conditions: unknown;
}

/** A promotion's definition, as far as the edit reads it (`org_promotions_mst`). */
export interface EditPromotion {
  id: string;
  discountType: string;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderAmount: string | null;
  maxOrderAmount: string | null;
  applicableCategories: unknown;
}

/** One recorded ORDER discount (its rows grouped), as the calculator id and stored facts. */
export interface RecordedOrderDiscount {
  /** The calculator adjustment id (`order:dN`). */
  id: string;
  sourceType: string;
  sourceId: string | null;
  promotionId: string | null;
  sourceName: string | null;
  sourceName2: string | null;
  discountType: string;
  discountRate: string | null;
  /** Σ of the group's stored amounts. */
  amount: string;
}

/** One recorded discount after the edit: Review lists it, Apply acts on it. */
export interface DiscountChange {
  /** Stable across previews: the source and its id (or the adjustment id for a manual one). */
  key: string;
  adjustmentId: string;
  sourceType: string;
  sourceId: string | null;
  promotionId: string | null;
  sourceName: string | null;
  sourceName2: string | null;
  outcome: DiscountChangeOutcome;
  /** Set when removed. */
  reason: DiscountRemovalReason | null;
  /** Money text at storage scale. */
  previousAmount: string;
  amount: string;
}

/** What the edited order looks like to a condition. */
export interface EditDiscountFacts {
  lineCount: number;
  serviceCategories: readonly string[];
}

/** The calculator's view of the base (from `OrderAdjustmentContext`). */
export interface EditDiscountBase {
  netAfter: (adjustments: readonly AdjustmentInput[]) => Money;
  rounding: RoundingRule;
}

const isPercent = (type: string) => type.toUpperCase() === DISCOUNT_CALC_TYPE.PERCENTAGE;

const codes = (raw: unknown): string[] => (Array.isArray(raw)
  ? raw.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim().toUpperCase())
  : []);

const changeKey = (d: RecordedOrderDiscount): string => (d.sourceType === DISCOUNT_SOURCE_TYPE.PROMO_CODE
  ? `${d.sourceType}:${d.promotionId ?? d.sourceId ?? d.id}`
  : d.sourceType === DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE ? `${d.sourceType}:${d.sourceId ?? d.id}` : `${d.sourceType}:${d.id}`);

/** Same checks as Create's `checkRuleConditions`, limited to what an edit changes. */
function ruleRemoval(rule: EditDiscountRule, base: Money, facts: EditDiscountFacts): DiscountRemovalReason | null {
  const c = (rule.conditions ?? {}) as { min_order_amount?: unknown; min_items?: unknown; service_categories?: unknown };
  if (Number(c.min_order_amount) > 0 && base.lessThan(toMoney(String(c.min_order_amount)))) return DISCOUNT_REMOVAL_REASONS.MIN_ORDER_NOT_MET;
  if (Number(c.min_items) > 0 && facts.lineCount < Number(c.min_items)) return DISCOUNT_REMOVAL_REASONS.MIN_ITEMS_NOT_MET;
  const wanted = codes(c.service_categories);
  const have = codes(facts.serviceCategories);
  if (wanted.length > 0 && !have.some((cat) => wanted.includes(cat))) return DISCOUNT_REMOVAL_REASONS.CATEGORY_NOT_APPLICABLE;
  return null;
}

/** Same checks as Create's `evaluatePromoRow`, limited to what an edit changes. */
function promoRemoval(promo: EditPromotion, base: Money, facts: EditDiscountFacts): DiscountRemovalReason | null {
  if (promo.minOrderAmount != null && base.lessThan(toMoney(promo.minOrderAmount))) return DISCOUNT_REMOVAL_REASONS.MIN_ORDER_NOT_MET;
  if (promo.maxOrderAmount != null && base.greaterThan(toMoney(promo.maxOrderAmount))) return DISCOUNT_REMOVAL_REASONS.MAX_ORDER_EXCEEDED;
  const allowed = codes(promo.applicableCategories);
  if (allowed.length > 0) {
    const have = codes(facts.serviceCategories);
    // Fail closed as Create does: every category of the order must be allowed.
    if (have.length === 0 || !have.every((cat) => allowed.includes(cat))) return DISCOUNT_REMOVAL_REASONS.CATEGORY_NOT_APPLICABLE;
  }
  return null;
}

/**
 * Applies the recorded order discounts again on the edited order (D21).
 * @param recorded the order's recorded ORDER discounts, in applied order
 * @param definitions the rules and promotions they came from, by id (tenant-read by the caller)
 * @param facts the edited order's line count and service categories
 * @param base the calculator's base and rounding
 * @returns the adjustments to price with, and the removals by adjustment id
 * @example
 * const { adjustments, removed } = reevaluateOrderDiscounts(recorded, { rules, promotions }, facts, context);
 */
export function reevaluateOrderDiscounts(
  recorded: readonly RecordedOrderDiscount[],
  definitions: { rules: ReadonlyMap<string, EditDiscountRule>; promotions: ReadonlyMap<string, EditPromotion> },
  facts: EditDiscountFacts,
  base: EditDiscountBase,
): { adjustments: AdjustmentInput[]; removed: Map<string, DiscountRemovalReason> } {
  const adjustments: AdjustmentInput[] = [];
  const removed = new Map<string, DiscountRemovalReason>();
  const percentOf = (on: Money, rate: string) => roundMoney(on.times(toMoney(rate)).dividedBy(100), base.rounding);

  for (const d of recorded) {
    const available = base.netAfter(adjustments);
    const recordedRate = isPercent(d.discountType) && d.discountRate != null ? d.discountRate : null;
    let amount: Money;
    if (d.sourceType === DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE || d.sourceType === DISCOUNT_SOURCE_TYPE.PROMO_CODE) {
      const isRule = d.sourceType === DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE;
      const rule = isRule && d.sourceId ? definitions.rules.get(d.sourceId) : undefined;
      const promoId = d.promotionId ?? d.sourceId;
      const promo = !isRule && promoId ? definitions.promotions.get(promoId) : undefined;
      const reason = rule ? ruleRemoval(rule, available, facts) : promo ? promoRemoval(promo, available, facts) : null;
      if (reason) { removed.set(d.id, reason); continue; }
      // The recorded rate wins; else the definition's percent; else the recorded amount.
      const def = rule ?? promo;
      const rate = recordedRate ?? (def && isPercent(def.discountType) ? def.discountValue : null);
      amount = rate != null ? percentOf(available, rate) : toMoney(d.amount);
      if (rate != null && promo?.maxDiscountAmount != null && amount.greaterThan(toMoney(promo.maxDiscountAmount))) {
        amount = roundMoney(toMoney(promo.maxDiscountAmount), base.rounding);
      }
    } else if (recordedRate != null) {
      // A manual (or other) percent stays a percent: the calculator applies it on the base.
      adjustments.push({ id: d.id, source: d.sourceType, calcType: DISCOUNT_CALC_TYPE.PERCENTAGE, value: recordedRate });
      continue;
    } else {
      amount = toMoney(d.amount);
    }
    if (amount.greaterThan(available)) amount = available;
    if (amount.isZero()) { removed.set(d.id, DISCOUNT_REMOVAL_REASONS.NOTHING_TO_DISCOUNT); continue; }
    adjustments.push({ id: d.id, source: d.sourceType, calcType: DISCOUNT_CALC_TYPE.FIXED_AMOUNT, value: amount.toString() });
  }
  return { adjustments, removed };
}

/**
 * Compares each recorded discount with what the calculator applied.
 * @param recorded the recorded ORDER discounts
 * @param applied the calculated order's applied adjustments (id → amount)
 * @param removed the removals from `reevaluateOrderDiscounts`
 * @returns one change per recorded discount, in recorded order
 */
export function discountChangesOf(
  recorded: readonly RecordedOrderDiscount[],
  applied: ReadonlyMap<string, Money>,
  removed: ReadonlyMap<string, DiscountRemovalReason>,
): DiscountChange[] {
  return recorded.map((d) => {
    const previous = toMoney(d.amount);
    const now = applied.get(d.id) ?? toMoney(0);
    const reason = removed.get(d.id) ?? null;
    const outcome: DiscountChangeOutcome = reason ? DISCOUNT_CHANGE_OUTCOMES.REMOVED
      : now.equals(previous) ? DISCOUNT_CHANGE_OUTCOMES.KEPT : DISCOUNT_CHANGE_OUTCOMES.CHANGED;
    return {
      key: changeKey(d),
      adjustmentId: d.id,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      promotionId: d.promotionId,
      sourceName: d.sourceName,
      sourceName2: d.sourceName2,
      outcome,
      reason,
      previousAmount: previous.toFixed(4),
      amount: (reason ? toMoney(0) : now).toFixed(4),
    };
  });
}
