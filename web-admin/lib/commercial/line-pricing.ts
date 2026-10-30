/**
 * One priced row, from standard price to net before order discounts
 * (PLAN.md §8.1 steps 1–6, §8.3, L2, L23; ADR-060 §5).
 *
 * Why: Create, Edit and the quote must build a line the same way. The speed
 * premium sits inside the unit price (L2); a preference extra is inside the
 * line or a separate charge depending on the order's `extra_price_pricing_mode`;
 * the price-list discount is one line discount (PF-03); `min_sell_price` is a
 * floor unless an audited override is used (L23).
 *
 * Every stored figure is rounded once by the currency rule (L22b): the unit
 * prices, the base, each premium, modifier and discount. Derived figures are
 * sums and differences of those, so the row identities hold exactly.
 */
import { EXTRA_PRICE_PRICING_MODES, type ExtraPricePricingMode } from '@/lib/constants/order-financial';
import { DISCOUNT_CALC_TYPE, DISCOUNT_SOURCE_TYPE } from '@/lib/constants/discount-source-type';
import { applySequentialAdjustments, type AdjustmentInput, type AppliedAdjustment } from './adjustments';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { ZERO, sumMoney, toMoney, type Money, type MoneyInput } from './money';
import { roundMoney, type RoundingRule } from './rounding';

/** Where a price modifier lands (PLAN.md §4.2). */
export const MODIFIER_PLACEMENTS = {
  /** Inside the line gross (`total_price`). */
  INCLUDED: 'INCLUDED',
  /** Outside the line, as its own charge row. */
  SEPARATE: 'SEPARATE',
} as const;
/** Derived union of modifier placements. */
export type ModifierPlacement = (typeof MODIFIER_PLACEMENTS)[keyof typeof MODIFIER_PLACEMENTS];

/**
 * Placement of a preference extra. Line-level extras follow the order's
 * `extra_price_pricing_mode` snapshot; order-level extras are always a
 * separate charge (PLAN.md §6.3).
 * @param mode the order's `extra_price_pricing_mode`
 * @param scope `LINE` for item/piece preferences, `DOCUMENT` for order preferences
 * @returns the placement to give the modifier
 */
export function placementForExtraPrice(
  mode: ExtraPricePricingMode,
  scope: 'LINE' | 'DOCUMENT',
): ModifierPlacement {
  if (scope === 'DOCUMENT') return MODIFIER_PLACEMENTS.SEPARATE;
  return mode === EXTRA_PRICE_PRICING_MODES.SEPARATE_CHARGE
    ? MODIFIER_PLACEMENTS.SEPARATE
    : MODIFIER_PLACEMENTS.INCLUDED;
}

/** A per-line price modifier, e.g. a preference extra (`price_basis` = PER_LINE). */
export interface PriceModifier {
  id: string;
  /** Caller's kind, e.g. `PREFERENCE`; carried through unchanged. */
  kind: string;
  /** Amount for the whole line, not negative. */
  amount: MoneyInput;
  placement: ModifierPlacement;
}

/** A modifier after rounding, split out for the writer. */
export interface PricedModifier {
  id: string;
  kind: string;
  amount: Money;
}

/** Everything one row needs. Standard and speed figures come from the two resolvers. */
export interface LinePricingInput {
  /** May be fractional (per-kg lines). */
  quantity: MoneyInput;
  /** `resolveStandardPrice(...).unitPrice` */
  listUnitPrice: MoneyInput;
  /** `resolveStandardPrice(...).priceListDiscountPercent`; applied once as a `PRICE_LIST` line discount. */
  priceListDiscountPercent: MoneyInput;
  /** The price list item behind that discount, used as the discount's id. */
  priceListItemId: string | null;
  /** `resolveSpeedPricing(...).unitPremium` */
  speedUnitPremium: MoneyInput;
  /** `resolveSpeedPricing(...).linePremium` */
  speedLinePremium: MoneyInput;
  /**
   * A cashier price (`pricing:override`, checked by the caller) or a custom
   * item's entered price. It replaces the final unit price: no speed premium
   * and no price-list discount are added on top (PLAN.md §7).
   */
  overrideUnitPrice: MoneyInput | null;
  modifiers: readonly PriceModifier[];
  /** ITEM/PIECE discounts for this row, in the order they apply. */
  adjustments: readonly AdjustmentInput[];
  /** `org_product_data_mst.min_sell_price`, or null for none. */
  minUnitPrice: MoneyInput | null;
  /** The currency rule: decimals and mode, no coin step (L22c). */
  rounding: RoundingRule;
}

/** Notices the UI must show next to the row (rule #15). */
export const LINE_PRICING_NOTICES = {
  /** An override took the price below the minimum; allowed and audited (L23). */
  OVERRIDE_BELOW_MINIMUM: 'OVERRIDE_BELOW_MINIMUM',
} as const;
/** Derived union of line pricing notices. */
export type LinePricingNotice = (typeof LINE_PRICING_NOTICES)[keyof typeof LINE_PRICING_NOTICES];

/** One row, priced up to net before order discounts. Names follow the §6.1 columns. */
export interface LinePricingResult {
  isOverride: boolean;
  /** `list_unit_price` */
  listUnitPrice: Money;
  /** `price_per_unit`: list price + speed premium, or the override. */
  unitPrice: Money;
  /** `speed_premium_amount`: 0 under an override. */
  speedPremiumAmount: Money;
  /** Σ INCLUDED modifiers, inside the gross. */
  includedModifierAmount: Money;
  /** SEPARATE modifiers, for the writer to turn into charge rows. */
  separateModifiers: PricedModifier[];
  includedModifiers: PricedModifier[];
  /** `total_price`: unit × quantity + per-line premium + included modifiers. */
  grossAmount: Money;
  /** The `PRICE_LIST` discount first, then the row's own discounts. */
  adjustments: AppliedAdjustment[];
  /** `line_disc_amount` */
  lineDiscountAmount: Money;
  /** Gross − line discounts; order discounts come off this next. */
  netBeforeDocument: Money;
  notices: LinePricingNotice[];
}

const invalid = (message: string, details: Record<string, string> = {}) =>
  new CommercialRuleError(COMMERCIAL_ERROR_CODES.INVALID_ADJUSTMENT, message, details);

/**
 * Prices one row: unit price, gross, line discounts and the minimum-price check.
 * @param input the resolved standard and speed figures, override, modifiers, discounts, minimum and rounding rule
 * @returns the row figures, the applied discounts, and the modifiers split by placement
 * @throws CommercialRuleError LINE_DISCOUNT_EXCEEDS_GROSS, PRICE_BELOW_MINIMUM, GIFT_CARD_NOT_ADJUSTMENT, INVALID_ADJUSTMENT
 * @example
 * priceLine({ quantity: 2, listUnitPrice: '10', priceListDiscountPercent: 0, priceListItemId: null,
 *   speedUnitPremium: '3', speedLinePremium: 0, overrideUnitPrice: null, modifiers: [],
 *   adjustments: [], minUnitPrice: null, rounding: { decimalPlaces: 3, mode: 'HALF_UP' } }).grossAmount.toString(); // '26'
 */
export function priceLine(input: LinePricingInput): LinePricingResult {
  const { rounding } = input;
  const round = (value: MoneyInput) => roundMoney(value, rounding);
  const quantity = toMoney(input.quantity);
  if (!quantity.greaterThan(0)) throw invalid(`Quantity must be positive: ${quantity.toString()}`);

  // ─── Unit price and base ───────────────────────────────────────────────
  const isOverride = input.overrideUnitPrice != null;
  const listUnitPrice = round(input.listUnitPrice);
  if (isOverride && toMoney(input.overrideUnitPrice as MoneyInput).isNegative()) {
    throw invalid('An override price cannot be negative.');
  }
  const unitPrice = isOverride
    ? round(input.overrideUnitPrice as MoneyInput)
    : round(listUnitPrice.plus(toMoney(input.speedUnitPremium)));
  const base = round(unitPrice.times(quantity));
  const linePremium = isOverride ? ZERO : round(input.speedLinePremium);
  const speedPremiumAmount = isOverride
    ? ZERO
    : base.minus(round(listUnitPrice.times(quantity))).plus(linePremium);

  // ─── Modifiers ─────────────────────────────────────────────────────────
  const includedModifiers: PricedModifier[] = [];
  const separateModifiers: PricedModifier[] = [];
  for (const modifier of input.modifiers) {
    const amount = round(modifier.amount);
    if (amount.isNegative()) throw invalid(`Modifier ${modifier.id} cannot be negative.`, { modifierId: modifier.id });
    const priced = { id: modifier.id, kind: modifier.kind, amount };
    if (modifier.placement === MODIFIER_PLACEMENTS.INCLUDED) includedModifiers.push(priced);
    else separateModifiers.push(priced);
  }
  const includedModifierAmount = sumMoney(includedModifiers.map((m) => m.amount));
  const grossAmount = base.plus(linePremium).plus(includedModifierAmount);

  // ─── Line discounts ────────────────────────────────────────────────────
  // The price-list discount is on the list part only (price × quantity), as
  // get_product_price applied it; it is skipped under an override.
  const listDiscountRate = toMoney(input.priceListDiscountPercent);
  const priceListDiscount: AppliedAdjustment[] = [];
  if (!isOverride && listDiscountRate.greaterThan(0)) {
    const amount = round(round(listUnitPrice.times(quantity)).times(listDiscountRate).dividedBy(100));
    priceListDiscount.push({
      id: input.priceListItemId ?? 'price-list',
      source: DISCOUNT_SOURCE_TYPE.PRICE_LIST,
      calcType: DISCOUNT_CALC_TYPE.PERCENTAGE,
      rate: listDiscountRate,
      amount,
    });
  }
  const afterListDiscount = grossAmount.minus(sumMoney(priceListDiscount.map((a) => a.amount)));
  const own = applySequentialAdjustments(
    afterListDiscount, input.adjustments, rounding, COMMERCIAL_ERROR_CODES.LINE_DISCOUNT_EXCEEDS_GROSS,
  );
  const adjustments = [...priceListDiscount, ...own.applied];
  const lineDiscountAmount = sumMoney(adjustments.map((a) => a.amount));
  const netBeforeDocument = grossAmount.minus(lineDiscountAmount);

  // ─── Minimum price (L23) ───────────────────────────────────────────────
  // Floor on the item's own net unit price: extras are not part of it.
  const notices: LinePricingNotice[] = [];
  if (input.minUnitPrice != null) {
    const minimum = toMoney(input.minUnitPrice);
    const netUnit = netBeforeDocument.minus(includedModifierAmount).dividedBy(quantity);
    if (netUnit.lessThan(minimum)) {
      if (!isOverride) {
        throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.PRICE_BELOW_MINIMUM,
          `The net unit price ${netUnit.toString()} is below the minimum ${minimum.toString()}.`,
          { netUnitPrice: netUnit.toString(), minimum: minimum.toString() });
      }
      notices.push(LINE_PRICING_NOTICES.OVERRIDE_BELOW_MINIMUM);
    }
  }

  return {
    isOverride,
    listUnitPrice,
    unitPrice,
    speedPremiumAmount,
    includedModifierAmount,
    includedModifiers,
    separateModifiers,
    grossAmount,
    adjustments,
    lineDiscountAmount,
    netBeforeDocument,
    notices,
  };
}
