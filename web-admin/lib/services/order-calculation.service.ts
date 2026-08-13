/**
 * Order Calculation Service
 *
 * Server-side source of truth for order totals. Used by:
 * - Preview API (before order exists in DB)
 * - Create-with-payment API (for comparison and persistence)
 *
 * Integrates: pricing, tax, promo, gift card. All amounts rounded per tenant currency.
 */

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { pricingService } from './pricing.service';
import { TaxService } from './tax.service';
import { createTenantSettingsService } from './tenant-settings.service';
import {
  validatePromoCode,
  getBestDiscount,
  evaluateBestAutoApplyPromo,
} from './discount-service';
import { validateGiftCard, validateGiftCardByIdForCalculation } from './gift-card-service';
import { calculateTax } from './tax-engine.service';
import { resolveTaxPricingMode } from './pricing-mode-resolver.service';
import { extractTaxFromInclusive } from './order-financial-write.service';
import { resolveCurrencyRoundingRule, roundToIncrement } from '@/lib/money/currency-rounding';
import type { PriceResult } from '@/lib/types/pricing';
import { DISCOUNT_SOURCE_TYPE, DISCOUNT_CALC_TYPE } from '@/lib/constants/discount-source-type';
import { TAX_TYPES, TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import type { DiscountLineInput } from '@/lib/db/order-discounts';
import type { FinancialBreakdownSnapshot, TaxLineItem, TaxPricingMode } from '@/lib/types/order-financial';

/**
 *
 */
export interface OrderCalculationParams {
  tenantId: string;
  branchId?: string;
  items: {
    productId: string;
    quantity: number;
    /** Optional item-level unit price override approved in the order workspace. */
    priceOverride?: number | null;
    /** Service preference surcharge for the line (`org_order_preferences_dtl.service_prefs`). */
    servicePrefCharge?: number;
    /** Packing surcharge for the line (`org_packing_preference_cf.extra_price` roll-up). Same subtotal role as service prefs. */
    packingPrefCharge?: number;
  }[];
  customerId?: string;
  isExpress?: boolean;
  percentDiscount?: number;
  amountDiscount?: number;
  promoCode?: string;
  promoCodeId?: string;
  giftCardNumber?: string;
  giftCardAmount?: number;
  /** Pre-authenticated gift card UUID. When provided, bypasses number/PIN lookup and skips PIN re-verification. */
  giftCardId?: string;
  serviceCategories?: string[];
  /** Canonical tax profile IDs selected by the client. */
  taxProfileIds?: string[];
  /** User ID for USER_OVERRIDE in 7-layer settings resolution. */
  userId?: string;
  /**
   * B18 — order-level charge facts (e.g. order-wide preferences selected via
   * `prefs_level=ORDER`), independent of any single item. Not discountable
   * (added after commercial discounts); participates in the tax base like
   * everything else afterDiscounts feeds into.
   */
  orderCharges?: { label: string; label2?: string | null; amount: number; sourceId?: string }[];
}

/**
 *
 */
export interface OrderCalculationResult {
  subtotal: number;
  manualDiscount: number;
  /** Discount from the best-matching automatic discount rule (no code required). */
  autoRuleDiscount: number;
  promoDiscount: number;
  afterDiscounts: number;
  taxRate: number;
  taxAmount: number;
  /** Sum of CUSTOM-type tax-profile lines, reported separately from VAT/GST (`vatValue`). */
  additionalTaxAmount: number;
  vatTaxPercent: number;
  vatValue: number;
  taxBreakdown: TaxLineItem[];
  /** Stored-value settlement amount reserved for the gift card leg, not a pricing discount. */
  giftCardApplied: number;
  /** Canonical sale total after commercial discounts, tax, and rounding, before settlement credits. */
  saleTotal: number;
  currencyCode: string;
  decimalPlaces: number;
  /** Structured discount lines for the audit trail — one entry per discount source. */
  discountLines: DiscountLineInput[];
  /** Resolved tenant/branch tax pricing mode (B11) — drives "tax included" display. */
  taxPricingMode: TaxPricingMode;
  /** B17 — delta applied by the currency cash-rounding rule; 0 when no rule changes the total. */
  roundingAdjustmentAmount: number;
  /** B18 — sum of order-level charge facts (`orderCharges`); 0 when none were supplied. */
  chargesTotal: number;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/**
 * Calculate order totals server-side.
 * Fetches prices from catalog, applies pricing discounts and tax, while keeping
 * stored-value settlement amounts separate from sale-total math.
 * @param params
 */
export async function calculateOrderTotals(
  params: OrderCalculationParams
): Promise<OrderCalculationResult> {
  const {
    tenantId,
    branchId,
    userId,
    items,
    customerId,
    isExpress = false,
    percentDiscount = 0,
    amountDiscount = 0,
    promoCode,
    promoCodeId,
    giftCardNumber,
    giftCardAmount,
    giftCardId,
    serviceCategories,
    taxProfileIds,
    orderCharges,
  } = params;

  const supabase = await createClient();
  const tenantSettings = createTenantSettingsService(supabase);
  const tax = new TaxService({ tenantSettings });
  const pricingMode = await resolveTaxPricingMode(prisma, tenantId, branchId ?? null);
  const isInclusive = pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE;

  const currencyConfig = await tenantSettings.getCurrencyConfig(
    tenantId,
    branchId,
    userId
  );
  const decimalPlaces = currencyConfig.decimalPlaces ?? 3;
  // B15: getCurrencyConfig now fails loudly when the tenant currency is
  // unconfigured, so no fallback exists here.
  const currencyCode = currencyConfig.currencyCode;
  const chargesTotal = round(
    (orderCharges ?? []).reduce((sum, charge) => sum + (charge.amount || 0), 0),
    decimalPlaces
  );

  if (items.length === 0) {
    return {
      subtotal: 0,
      manualDiscount: 0,
      autoRuleDiscount: 0,
      promoDiscount: 0,
      afterDiscounts: 0,
      taxRate: 0,
      taxAmount: 0,
      additionalTaxAmount: 0,
      vatTaxPercent: 0,
      vatValue: 0,
      taxBreakdown: [],
      giftCardApplied: 0,
      saleTotal: 0,
      currencyCode,
      decimalPlaces,
      discountLines: [],
      chargesTotal: 0,
      taxPricingMode: pricingMode,
      roundingAdjustmentAmount: 0,
    };
  }

  const priceResults: PriceResult[] = await Promise.all(
    items.map((item) =>
      pricingService.getPriceForOrderItem({
        tenantId,
        productId: item.productId,
        quantity: item.quantity,
        isExpress,
        customerId,
      })
    )
  );

  const subtotal = priceResults.reduce(
    (sum, result, i) => {
      const item = items[i];
      const unitPrice = item.priceOverride ?? result.basePrice;

      return (
        sum +
        unitPrice * item.quantity +
        (item.servicePrefCharge ?? 0) +
        (item.packingPrefCharge ?? 0)
      );
    },
    0
  );
  const subtotalRounded = round(subtotal, decimalPlaces);

  // Use percent OR amount (prefer percent when > 0); never add both
  let manualDiscount = 0;
  if (percentDiscount > 0) {
    manualDiscount = round(
      Math.min((subtotalRounded * percentDiscount) / 100, subtotalRounded),
      decimalPlaces
    );
  } else if (amountDiscount > 0) {
    manualDiscount = round(
      Math.min(amountDiscount, subtotalRounded),
      decimalPlaces
    );
  }

  const afterManualDiscount = round(
    Math.max(0, subtotalRounded - manualDiscount),
    decimalPlaces
  );

  // Evaluate automatic discount rules — best single rule wins.
  let autoRuleDiscount = 0;
  const bestRule = await getBestDiscount(tenantId, {
    order_total: afterManualDiscount,
    items_count: items.length,
    service_categories: serviceCategories ?? [],
    order_date: new Date().toISOString(),
  });
  if (bestRule) {
    autoRuleDiscount = round(
      Math.min(bestRule.discount_amount, afterManualDiscount),
      decimalPlaces
    );
  }

  const afterAutoRuleDiscount = round(
    Math.max(0, afterManualDiscount - autoRuleDiscount),
    decimalPlaces
  );

  let promoDiscount = 0;
  /** Resolved promo id for usage logging (typed code or is_auto_apply promo). */
  let resolvedPromoId: string | undefined = promoCodeId;

  const resolveTypedOrAutoPromo = async (orderBase: number) => {
    if (promoCode?.trim()) {
      const promoResult = await validatePromoCode({
        promo_code: promoCode,
        order_total: orderBase,
        customer_id: customerId,
        service_categories: serviceCategories,
      });
      if (promoResult.isValid && promoResult.discountAmount != null) {
        return {
          amount: round(Math.min(promoResult.discountAmount, orderBase), decimalPlaces),
          promoId: promoResult.promoCode?.id,
          sourceName: promoCode.toUpperCase(),
        };
      }
      return { amount: 0, promoId: undefined as string | undefined, sourceName: 'Promo Code' };
    }

    const auto = await evaluateBestAutoApplyPromo({
      tenantId,
      orderTotal: orderBase,
      customerId,
      serviceCategories,
    });
    if (auto?.isValid && auto.discountAmount != null && auto.promo) {
      return {
        amount: round(Math.min(auto.discountAmount, orderBase), decimalPlaces),
        promoId: auto.promo.id,
        sourceName: auto.promo.promo_name ?? 'Auto Promo',
      };
    }
    return { amount: 0, promoId: undefined as string | undefined, sourceName: 'Promo Code' };
  };

  let promoSourceName = 'Promo Code';
  if (bestRule && !bestRule.rule.can_stack_with_promo) {
    const resolved = await resolveTypedOrAutoPromo(afterManualDiscount);
    if (resolved.amount >= autoRuleDiscount && resolved.amount > 0) {
      autoRuleDiscount = 0;
      promoDiscount = resolved.amount;
      resolvedPromoId = resolved.promoId ?? resolvedPromoId;
      promoSourceName = resolved.sourceName;
    }
  } else {
    const resolved = await resolveTypedOrAutoPromo(afterAutoRuleDiscount);
    promoDiscount = resolved.amount;
    if (resolved.amount > 0) {
      resolvedPromoId = resolved.promoId ?? resolvedPromoId;
      promoSourceName = resolved.sourceName;
    }
  }

  const afterDiscounts = round(
    Math.max(0, afterManualDiscount - autoRuleDiscount - promoDiscount),
    decimalPlaces
  );

  const taxBreakdown = await calculateTax({
    tenantId,
    branchId,
    customerId,
    serviceTypes: serviceCategories,
    baseAmount: afterDiscounts,
    decimalPlaces,
    selectedProfileIds: taxProfileIds,
    pricingMode,
  });

  let vatTaxPercent = round(
    taxBreakdown.find((line) => line.taxType === TAX_TYPES.VAT || line.taxType === TAX_TYPES.GST)?.rate ?? 0,
    2
  );
  let vatValue = round(
    taxBreakdown
      .filter((line) => line.taxType === TAX_TYPES.VAT || line.taxType === TAX_TYPES.GST)
      .reduce((sum, line) => sum + line.taxAmount, 0),
    decimalPlaces
  );
  const additionalTaxAmount = round(
    taxBreakdown
      .filter((line) => line.taxType === TAX_TYPES.CUSTOM)
      .reduce((sum, line) => sum + line.taxAmount, 0),
    decimalPlaces
  );

  // B11: profile-driven tax (taxBreakdown non-empty) is already extracted/embedded
  // by calculateTax under TAX_INCLUSIVE — including CUSTOM-type profile lines, since
  // they share the same tenant tax-profile configuration mechanism as VAT/GST.
  const additionalTaxEmbedded = isInclusive && taxBreakdown.length > 0;

  // No tax profile configured for this order: fall back to the tenant-level
  // TENANT_VAT_RATE setting. B15 policy — an unset/unparsable rate resolves to
  // zero, never an assumed positive rate. `additionalTaxAmount` stays 0 here:
  // it only ever carries CUSTOM-type *profile* lines, which by definition do
  // not exist when taxBreakdown is empty.
  if (taxBreakdown.length === 0) {
    const vatRate = await tax.getTaxRate(tenantId, branchId, userId);
    vatTaxPercent = round(vatRate * 100, 2);
    vatValue = isInclusive
      ? round(extractTaxFromInclusive(afterDiscounts, vatRate).taxAmount, decimalPlaces)
      : round(afterDiscounts * vatRate, decimalPlaces);
  }

  const taxAmount = vatValue;

  // B11: TAX_INCLUSIVE — item prices already embed VAT/GST (and profile-driven
  // CUSTOM tax); `afterDiscounts` is the gross and must not be added to again.
  // TAX_EXCLUSIVE — unchanged, byte-identical to pre-B11 behavior.
  // B18: order-level charges (`chargesTotal`) are always a flat, non-taxable
  // addend regardless of mode — not a catalog price, so never part of the
  // inclusive envelope. No `is_taxable` config exists per-charge today
  // (see B18 doc); taxable charges are a documented future extension.
  let amountBeforeGiftCard = isInclusive
    ? round(afterDiscounts + (additionalTaxEmbedded ? 0 : additionalTaxAmount) + chargesTotal, decimalPlaces)
    : round(afterDiscounts + vatValue + additionalTaxAmount + chargesTotal, decimalPlaces);

  // Net-of-tax figure reported to callers (snapshot `netBeforeTax`, receipts).
  // Exclusive: identical to afterDiscounts (nothing embedded). Inclusive: back
  // out the embedded tax so downstream consumers see the true taxable base.
  const netAfterDiscounts = isInclusive
    ? round(afterDiscounts - vatValue - (additionalTaxEmbedded ? additionalTaxAmount : 0), decimalPlaces)
    : afterDiscounts;

  // B17: apply the tenant-currency cash-rounding rule to the grand total
  // BEFORE the gift-card cap so the cap, saleTotal, and the persisted
  // adjustment all agree on the same rounded figure. No-op (adjustment 0)
  // whenever no active rule exists or the rule's increment equals the
  // currency's native decimal step — true for every currently-seeded row.
  let roundingAdjustmentAmount = 0;
  const currencyRoundingRule = await resolveCurrencyRoundingRule(currencyCode);
  if (currencyRoundingRule) {
    const roundedTotal = roundToIncrement(
      amountBeforeGiftCard,
      currencyRoundingRule.roundingUnit,
      currencyRoundingRule.roundingMethod,
    );
    roundingAdjustmentAmount = round(roundedTotal - amountBeforeGiftCard, decimalPlaces);
    amountBeforeGiftCard = roundedTotal;
  }

  let giftCardApplied = 0;
  const resolvedGiftCardId = giftCardId?.trim();
  const resolvedGiftCardNumber = giftCardNumber?.trim();
  if (resolvedGiftCardId || resolvedGiftCardNumber) {
    // Prefer ID-based lookup: the card was pre-authenticated (PIN verified) during the
    // fetch step. Falling back to number-based lookup handles legacy/direct-number cases.
    const giftCardResult = resolvedGiftCardId
      ? await validateGiftCardByIdForCalculation(resolvedGiftCardId, tenantId)
      : await validateGiftCard({ gift_card_code: resolvedGiftCardNumber! });
    if (
      giftCardResult.isValid &&
      giftCardResult.availableBalance != null &&
      giftCardResult.availableBalance > 0
    ) {
      const maxApplicable = round(
        Math.min(giftCardResult.availableBalance, amountBeforeGiftCard),
        decimalPlaces
      );
      if (giftCardAmount != null) {
        giftCardApplied = round(Math.min(giftCardAmount, maxApplicable), decimalPlaces);
      } else {
        giftCardApplied = maxApplicable;
      }
    }
  }

  const saleTotal = amountBeforeGiftCard;

  const discountLines: DiscountLineInput[] = [];

  if (manualDiscount > 0) {
    discountLines.push({
      sourceType:    DISCOUNT_SOURCE_TYPE.MANUAL,
      sourceName:    'Manual Discount',
      sourceName2:   'خصم يدوي',
      discountType:  percentDiscount > 0 ? DISCOUNT_CALC_TYPE.PERCENTAGE : DISCOUNT_CALC_TYPE.FIXED_AMOUNT,
      discountRate:  percentDiscount > 0 ? percentDiscount : undefined,
      discountAmount: manualDiscount,
    });
  }

  if (autoRuleDiscount > 0 && bestRule) {
    discountLines.push({
      sourceType:    DISCOUNT_SOURCE_TYPE.DISCOUNT_RULE,
      sourceId:      bestRule.rule.id,
      sourceName:    bestRule.rule.rule_name,
      sourceName2:   bestRule.rule.rule_name2 ?? undefined,
      discountType:  DISCOUNT_CALC_TYPE.FIXED_AMOUNT,
      discountAmount: autoRuleDiscount,
    });
  }

  if (promoDiscount > 0) {
    discountLines.push({
      sourceType:    DISCOUNT_SOURCE_TYPE.PROMO_CODE,
      sourceId:      resolvedPromoId,
      sourceName:    promoSourceName,
      discountType:  DISCOUNT_CALC_TYPE.FIXED_AMOUNT,
      discountAmount: promoDiscount,
    });
  }

  return {
    subtotal: subtotalRounded,
    manualDiscount,
    autoRuleDiscount,
    promoDiscount,
    afterDiscounts: netAfterDiscounts,
    taxRate: vatTaxPercent / 100,
    taxAmount,
    additionalTaxAmount,
    vatTaxPercent,
    vatValue,
    taxBreakdown,
    giftCardApplied,
    saleTotal,
    currencyCode,
    decimalPlaces,
    discountLines,
    taxPricingMode: pricingMode,
    roundingAdjustmentAmount,
    chargesTotal,
  };
}

// ── P8.1 — FinancialBreakdownSnapshot adapter ──────────────────────────────────

/**
 * Convert a flat OrderCalculationResult into the structured FinancialBreakdownSnapshot
 * used by order-settlement.service.ts and the Financial tab on order detail pages.
 *
 * creditApplicationsTotal = sum of credit apps already validated (wallet, advance, CN, loyalty, GC).
 * @param result
 * @param taxLines
 * @param chargesTotal
 * @param creditApplicationsTotal
 */
export function toFinancialBreakdownSnapshot(
  result:                  OrderCalculationResult,
  taxLines:                TaxLineItem[],
  chargesTotal:            number,
  creditApplicationsTotal: number
): FinancialBreakdownSnapshot {
  const grandTotal    = result.saleTotal;
  const creditsTotal  = creditApplicationsTotal;
  const netReceivable = Math.max(0, grandTotal - creditsTotal);

  return {
    subtotal:         result.subtotal,
    chargesTotal,
    grossTotal:       result.subtotal + chargesTotal,
    discountTotal:    result.manualDiscount + result.autoRuleDiscount + result.promoDiscount,
    netBeforeTax:     result.afterDiscounts,
    taxBreakdown:     taxLines,
    taxTotal:         result.taxAmount + result.additionalTaxAmount,
    grandTotal,
    creditsTotal,
    netReceivable,
    paymentLegsTotal: 0,
    changeReturned:   0,
    outstanding:      netReceivable,
    currencyCode:     result.currencyCode,
    decimalPlaces:    result.decimalPlaces,
  };
}
