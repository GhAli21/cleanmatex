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
import type { PriceResult } from '@/lib/types/pricing';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { DISCOUNT_SOURCE_TYPE, DISCOUNT_CALC_TYPE } from '@/lib/constants/discount-source-type';
import { TAX_TYPES } from '@/lib/constants/order-financial';
import type { DiscountLineInput } from '@/lib/db/order-discounts';
import type { FinancialBreakdownSnapshot, TaxLineItem } from '@/lib/types/order-financial';

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
  /** Additional tax (order tax) rate in percent (e.g. 10 for 10%). Applied to afterDiscounts. */
  additionalTaxRate?: number;
  /** Additional tax amount. If provided, overrides additionalTaxRate. Applied on top of base total. */
  additionalTaxAmount?: number;
  /** User ID for USER_OVERRIDE in 7-layer settings resolution. */
  userId?: string;
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
  /** Additional (order) tax amount applied on top of base (VAT-inclusive) total. */
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
    additionalTaxRate,
    additionalTaxAmount: additionalTaxAmountParam,
  } = params;

  const supabase = await createClient();
  const tenantSettings = createTenantSettingsService(supabase);
  const tax = new TaxService({ tenantSettings });

  const currencyConfig = await tenantSettings.getCurrencyConfig(
    tenantId,
    branchId,
    userId
  );
  const decimalPlaces = currencyConfig.decimalPlaces ?? 3;
  const currencyCode = currencyConfig.currencyCode ?? ORDER_DEFAULTS.CURRENCY;

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

  let taxBreakdown = await calculateTax({
    tenantId,
    branchId,
    customerId,
    serviceTypes: serviceCategories,
    baseAmount: afterDiscounts,
    decimalPlaces,
    selectedProfileIds: taxProfileIds,
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
  let additionalTaxAmount = round(
    taxBreakdown
      .filter((line) => line.taxType === TAX_TYPES.CUSTOM)
      .reduce((sum, line) => sum + line.taxAmount, 0),
    decimalPlaces
  );

  if (taxBreakdown.length === 0) {
    const vatRate = await tax.getTaxRate(tenantId, branchId, userId);
    vatTaxPercent = round(vatRate * 100, 2);
    vatValue = round(afterDiscounts * vatRate, decimalPlaces);

    if (additionalTaxAmountParam != null && additionalTaxAmountParam > 0) {
      additionalTaxAmount = round(additionalTaxAmountParam, decimalPlaces);
    } else if (additionalTaxRate != null && additionalTaxRate > 0) {
      additionalTaxAmount = round(
        (afterDiscounts * additionalTaxRate) / 100,
        decimalPlaces
      );
    }
  }

  const taxAmount = vatValue;

  const amountBeforeGiftCard = round(
    afterDiscounts + vatValue + additionalTaxAmount,
    decimalPlaces
  );

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
    afterDiscounts,
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
