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
import { validatePromoCode } from './discount-service';
import { validateGiftCard } from './gift-card-service';
import type { PriceResult } from '@/lib/types/pricing';

export interface OrderCalculationParams {
  tenantId: string;
  branchId?: string;
  items: { productId: string; quantity: number }[];
  customerId?: string;
  isExpress?: boolean;
  percentDiscount?: number;
  amountDiscount?: number;
  promoCode?: string;
  promoCodeId?: string;
  giftCardNumber?: string;
  serviceCategories?: string[];
  /** Additional tax (order tax) rate in percent (e.g. 10 for 10%). Applied to afterDiscounts. */
  additionalTaxRate?: number;
  /** Additional tax amount. If provided, overrides additionalTaxRate. Applied on top of base total. */
  additionalTaxAmount?: number;
  /** User ID for USER_OVERRIDE in 7-layer settings resolution. */
  userId?: string;
}

export interface OrderCalculationResult {
  subtotal: number;
  manualDiscount: number;
  promoDiscount: number;
  afterDiscounts: number;
  taxRate: number;
  taxAmount: number;
  /** Additional (order) tax amount applied on top of base (VAT-inclusive) total. */
  additionalTaxAmount: number;
  vatTaxPercent: number;
  vatValue: number;
  giftCardApplied: number;
  finalTotal: number;
  currencyCode: string;
  decimalPlaces: number;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/**
 * Calculate order totals server-side.
 * Fetches prices from catalog, applies discounts, promo, gift card, VAT.
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
    giftCardNumber,
    serviceCategories,
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
  const currencyCode = currencyConfig.currencyCode ?? 'OMR';

  if (items.length === 0) {
    return {
      subtotal: 0,
      manualDiscount: 0,
      promoDiscount: 0,
      afterDiscounts: 0,
      taxRate: 0,
      taxAmount: 0,
      additionalTaxAmount: 0,
      vatTaxPercent: 0,
      vatValue: 0,
      giftCardApplied: 0,
      finalTotal: 0,
      currencyCode,
      decimalPlaces,
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
    (sum, result, i) => sum + result.basePrice * items[i].quantity,
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

  let promoDiscount = 0;
  if (promoCode?.trim()) {
    const promoResult = await validatePromoCode({
      promo_code: promoCode,
      order_total: afterManualDiscount,
      customer_id: customerId,
      service_categories: serviceCategories,
    });
    if (promoResult.isValid && promoResult.discountAmount != null) {
      promoDiscount = round(
        Math.min(promoResult.discountAmount, afterManualDiscount),
        decimalPlaces
      );
    }
  }

  const afterDiscounts = round(
    Math.max(0, afterManualDiscount - promoDiscount),
    decimalPlaces
  );

  const vatRate = await tax.getTaxRate(tenantId, branchId, userId);
  const vatTaxPercent = round(vatRate * 100, 2);
  const vatValue = round(afterDiscounts * vatRate, decimalPlaces);
  const taxAmount = vatValue;

  let additionalTaxAmount = 0;
  if (additionalTaxAmountParam != null && additionalTaxAmountParam > 0) {
    additionalTaxAmount = round(additionalTaxAmountParam, decimalPlaces);
  } else if (additionalTaxRate != null && additionalTaxRate > 0) {
    additionalTaxAmount = round(
      (afterDiscounts * additionalTaxRate) / 100,
      decimalPlaces
    );
  }

  const amountBeforeGiftCard = round(
    afterDiscounts + vatValue + additionalTaxAmount,
    decimalPlaces
  );

  let giftCardApplied = 0;
  if (giftCardNumber?.trim()) {
    const giftCardResult = await validateGiftCard({
      card_number: giftCardNumber,
    });
    if (
      giftCardResult.isValid &&
      giftCardResult.availableBalance != null &&
      giftCardResult.availableBalance > 0
    ) {
      giftCardApplied = round(
        Math.min(giftCardResult.availableBalance, amountBeforeGiftCard),
        decimalPlaces
      );
    }
  }

  const finalTotal = round(
    Math.max(0, amountBeforeGiftCard - giftCardApplied),
    decimalPlaces
  );

  return {
    subtotal: subtotalRounded,
    manualDiscount,
    promoDiscount,
    afterDiscounts,
    taxRate: vatRate,
    taxAmount,
    additionalTaxAmount,
    vatTaxPercent,
    vatValue,
    giftCardApplied,
    finalTotal,
    currencyCode,
    decimalPlaces,
  };
}
