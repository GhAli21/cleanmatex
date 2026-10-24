'use client';

/**
 * Payment totals presentation backed by a coordinated server quote. Currency,
 * selected tax profiles, amount eligibility, and totals share one response;
 * opening no longer waits for independent tax/profile requests.
 */

import { useMemo } from 'react';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import type { TaxBreakdownLine, TaxProfileEntry } from '@/lib/types/payment-quote';
import { usePaymentQuote } from './use-payment-quote';
import type {
  AppliedPromoCode,
  AppliedGiftCard,
} from './use-gift-card-and-promo';
import type { OrderItemServicePref } from '../model/new-order-types';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type PaymentTotalsTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Normalized tax line used to render cashier-facing totals consistently across
 * preview sources (server breakdown or client fallback).
 */
export type { TaxBreakdownLine, TaxProfileEntry, ServerTotals } from '@/lib/types/payment-quote';


/**
 * Order line item shape consumed by the preview fetch.
 */
export type PaymentTotalsItem = {
  productId: string;
  quantity: number;
  priceOverride?: number | null;
  servicePrefCharge?: number;
  packingPrefCharge?: number;
};

/**
 * Inputs threaded from the modal. Form discounts + applied promo/gift come from
 * upstream slices; `decimalPlaces`/`currencyCode` come from the component's
 * `currencyConfig`. The hook owns the totals state itself.
 */
export interface UsePaymentTotalsParams {
  quoteSessionKey: string;
  userId?: string;
  /** Gates the load/fetch effects; matches the modal `open` flag. */
  open: boolean;
  items: PaymentTotalsItem[];
  tenantOrgId: string;
  branchId?: string;
  customerId?: string;
  isExpress?: boolean;
  /** Order subtotal used by the client-side fallback. */
  total: number;
  /** Optional explicit checkout amount used for eligibility before preview loads. */
  checkoutAmount?: number;
  percentDiscount: number;
  amountDiscount: number;
  serviceCategories?: string[];
  /** B18 — order-level preferences (not tied to any item). Sent to preview so the modal total includes their extra_price. */
  orderServicePrefs?: OrderItemServicePref[];
  appliedPromoCode: AppliedPromoCode | null;
  appliedGiftCard: AppliedGiftCard | null;
  decimalPlaces: number;
  csrfToken: string | null | undefined;
  /**
   * False while the shell's CSRF token is still resolving. Preview waits so
   * the first POST is not retried when the token arrives a tick later.
   */
  csrfReady?: boolean;
  t: PaymentTotalsTranslate;
}

/**
 * Server-driven totals + tax breakdown for Payment Modal V4.
 *
 * @param params - {@link UsePaymentTotalsParams}.
 * @param params.open - Gates the load/fetch effects.
 * @param params.items - Order line items for the preview fetch.
 * @param params.tenantOrgId - Active tenant org id.
 * @param params.branchId - Active branch id.
 * @param params.customerId - Active customer id.
 * @param params.isExpress - Express-order flag for pricing.
 * @param params.total - Order subtotal for the client fallback.
 * @param params.checkoutAmount - Explicit checkout amount for eligibility.
 * @param params.percentDiscount - Manual percent discount.
 * @param params.amountDiscount - Manual amount discount.
 * @param params.serviceCategories - Service categories for the preview.
 * @param params.appliedPromoCode - Applied promo (from useGiftCardAndPromo).
 * @param params.appliedGiftCard - Applied gift card (from useGiftCardAndPromo).
 * @param params.decimalPlaces - Currency decimal places for rounding.
 * @param params.csrfToken - CSRF token for the preview POST.
 * @param params.csrfReady - False while the shell CSRF token is still resolving.
 * @param params.t - `newOrder.payment` translate function.
 * @returns Server totals, the resolved `totals`/`saleTotal`, tax breakdown, and
 *   `checkoutEligibilityAmount` (consumed by the catalog hook).
 */
export function usePaymentTotals({
  quoteSessionKey,
  userId,
  open,
  items,
  tenantOrgId,
  branchId,
  customerId,
  isExpress,
  total,
  checkoutAmount,
  percentDiscount,
  amountDiscount,
  serviceCategories,
  orderServicePrefs,
  appliedPromoCode,
  appliedGiftCard,
  decimalPlaces,
  csrfToken,
  csrfReady = true,
}: UsePaymentTotalsParams) {
  const quote = usePaymentQuote({
    open,
    sessionKey: quoteSessionKey,
    tenantOrgId,
    userId,
    csrfReady,
    csrfToken,
    request: {
      items,
      branchId: branchId || undefined,
      customerId: customerId || undefined,
      isExpress,
      percentDiscount: percentDiscount ?? 0,
      amountDiscount: amountDiscount ?? 0,
      serviceCategories: serviceCategories?.length ? serviceCategories : undefined,
      orderServicePrefs: orderServicePrefs?.length ? orderServicePrefs : undefined,
      ...(!NEW_ORDER_PROMO_GIFT_DISABLED && {
        promoCode: appliedPromoCode?.code || undefined,
        giftCardNumber: appliedGiftCard?.number || undefined,
        giftCardAmount: appliedGiftCard?.amount || undefined,
        giftCardId: appliedGiftCard?.id || undefined,
      }),
    },
  });
  const serverTotals = quote.snapshot;
  const totalsLoading = !quote.ready;
  const previewFailed = quote.failed;
  const taxProfileEntries: TaxProfileEntry[] = quote.snapshot?.taxProfileEntries ?? [];
  // Server totals own every money path; no fallback rate blocks initialization.
  const taxRate = 0;
  const checkoutEligibilityAmount = serverTotals?.saleTotal ?? checkoutAmount ?? total;

  const afterDiscountsForTax = useMemo(() => {
    if (serverTotals) return serverTotals.afterDiscounts;
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount = NEW_ORDER_PROMO_GIFT_DISABLED
      ? 0
      : appliedPromoCode?.discount || 0;
    return Math.max(0, subtotal - manualDiscount - promoDiscount);
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode]);

  const fallbackTaxBreakdown = useMemo<TaxBreakdownLine[]>(() => {
    const selectedProfiles = taxProfileEntries.filter((entry) => entry.enabled);
    if (selectedProfiles.length > 0) {
      let accumulatedPriorTax = 0;
      return selectedProfiles.map((entry) => {
        const taxableBase = entry.is_compound
          ? afterDiscountsForTax + accumulatedPriorTax
          : afterDiscountsForTax;
        const taxAmount = parseFloat(
          (taxableBase * (entry.rate / 100)).toFixed(decimalPlaces),
        );
        accumulatedPriorTax += taxAmount;
        return {
          taxType: entry.tax_type as 'VAT' | 'GST' | 'CUSTOM',
          label: entry.name,
          label2: entry.name2,
          rate: entry.rate,
          isCompound: entry.is_compound,
          baseAmount: taxableBase,
          taxAmount,
          profileId: entry.id,
        };
      });
    }

    if (taxRate > 0) {
      return [
        {
          taxType: 'VAT',
          label: 'VAT',
          label2: 'ضريبة القيمة المضافة',
          rate: taxRate * 100,
          isCompound: false,
          baseAmount: afterDiscountsForTax,
          taxAmount: parseFloat(
            (afterDiscountsForTax * taxRate).toFixed(decimalPlaces),
          ),
        },
      ];
    }

    return [];
  }, [taxProfileEntries, afterDiscountsForTax, decimalPlaces, taxRate]);

  const displayTaxBreakdown = serverTotals?.taxBreakdown?.length
    ? serverTotals.taxBreakdown
    : totalsLoading || (items.length > 0 && !serverTotals)
      ? []
      : fallbackTaxBreakdown;
  const profilesTaxAmount = useMemo(
    () =>
      parseFloat(
        displayTaxBreakdown
          .reduce((sum, line) => sum + line.taxAmount, 0)
          .toFixed(decimalPlaces),
      ),
    [displayTaxBreakdown, decimalPlaces],
  );

  const totals = useMemo(() => {
    if (serverTotals) {
      const serverTaxTotal = serverTotals.taxBreakdown.reduce(
        (sum, line) => sum + line.taxAmount,
        0,
      );
      return {
        ...serverTotals,
        taxRate: 0,
        taxAmount: serverTotals.additionalTaxAmount ?? 0,
        totalSavings:
          serverTotals.subtotal + serverTaxTotal - serverTotals.saleTotal,
      };
    }
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount = NEW_ORDER_PROMO_GIFT_DISABLED
      ? 0
      : appliedPromoCode?.discount || 0;
    const afterDiscounts = Math.max(
      0,
      subtotal - manualDiscount - promoDiscount,
    );
    const vatValue = parseFloat(
      fallbackTaxBreakdown
        .filter((line) => line.taxType === 'VAT' || line.taxType === 'GST')
        .reduce((sum, line) => sum + line.taxAmount, 0)
        .toFixed(decimalPlaces),
    );
    const taxAmount = parseFloat(
      fallbackTaxBreakdown
        .filter((line) => line.taxType === 'CUSTOM')
        .reduce((sum, line) => sum + line.taxAmount, 0)
        .toFixed(decimalPlaces),
    );
    const giftCardApplied = NEW_ORDER_PROMO_GIFT_DISABLED
      ? 0
      : appliedGiftCard?.amount || 0;
    const saleTotal = Math.max(0, afterDiscounts + profilesTaxAmount);
    return {
      subtotal,
      manualDiscount,
      autoRuleDiscount: 0,
      promoDiscount,
      afterDiscounts,
      taxRate: 0,
      taxAmount,
      vatTaxPercent:
        fallbackTaxBreakdown.find(
          (line) => line.taxType === 'VAT' || line.taxType === 'GST',
        )?.rate ?? taxRate * 100,
      vatValue,
      giftCardApplied,
      saleTotal,
      // B18: never assume order-level charges before the server preview confirms them.
      chargesTotal: 0,
      totalSavings: subtotal + taxAmount + vatValue - saleTotal,
    };
  }, [
    serverTotals,
    total,
    percentDiscount,
    amountDiscount,
    appliedPromoCode,
    appliedGiftCard,
    taxRate,
    profilesTaxAmount,
    decimalPlaces,
    fallbackTaxBreakdown,
  ]);

  const saleTotal = totals.saleTotal;
  // B11: only label "tax included" once the server has actually confirmed it —
  // never assume during the fallback/loading window (mode is server-resolved).
  const isTaxInclusive = serverTotals?.taxPricingMode === 'TAX_INCLUSIVE';
  // B17: 0 during the fallback/loading window — the client never invents a
  // rounding rule, the server preview is the only source for this value.
  const roundingAdjustmentAmount = serverTotals?.roundingAdjustmentAmount ?? 0;

  return {
    serverTotals,
    totalsLoading,
    totals,
    saleTotal,
    taxProfileEntries,
    displayTaxBreakdown,
    profilesTaxAmount,
    checkoutEligibilityAmount,
    isTaxInclusive,
    roundingAdjustmentAmount,
    previewFailed,
    refetchPreview: quote.refetch,
    quote,
  };
}
