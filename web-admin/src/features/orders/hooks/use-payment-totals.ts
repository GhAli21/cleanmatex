'use client';

/**
 * Server-driven payment totals for Payment Modal V4.
 *
 * Verbatim extraction of the modal's totals concern (previously inline in
 * `payment-modal-v4.tsx`, program-plan anchor `:902–1118`): the `preview-payment`
 * fetch (`fetchPreview`) + its debounce, the `serverTotals`/`totalsLoading` state,
 * the tax-rate + default-tax-profile load, the fallback/`display` tax breakdown, and
 * the `totals` memo (server totals when available, otherwise a client-side fallback).
 *
 * Dependency order: this slice is **downstream of gift-card/promo** (its fetch +
 * `totals` read `appliedPromoCode`/`appliedGiftCard`) and **upstream of catalog**
 * (it produces `checkoutEligibilityAmount`, the checkout-options query key). The
 * modal therefore calls gift/promo → totals → catalog; `decimalPlaces`/`currencyCode`
 * (from the component's `currencyConfig`) are threaded in.
 *
 * Behavior freeze: fetch body, query/response mapping, memo dependency arrays, and
 * the tax math stay byte-equivalent to the original inline code. Two deliberate,
 * behavior-equivalent changes to satisfy `react-hooks/set-state-in-effect` cleanly
 * (no disables): (1) the debounce effect no longer clears `serverTotals` in its body
 * — the "nothing to preview" clear is done at render-time; (2) the tax-profile
 * `open`-reset uses render-time Pattern A. The async `setState`s inside `fetchPreview`
 * and the tax load run in promise callbacks, which the rule does not flag.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/` and react-effects-patterns §2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { getTaxProfilesAction } from '@/app/actions/settings/tax-actions';
import { taxService } from '@/lib/services/tax.service';
import { cmxMessage } from '@ui/feedback';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import type { AppliedPromoCode, AppliedGiftCard } from './use-gift-card-and-promo';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type PaymentTotalsTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * Normalized tax line used to render cashier-facing totals consistently across
 * preview sources (server breakdown or client fallback).
 */
export type TaxBreakdownLine = {
  taxType: 'VAT' | 'GST' | 'CUSTOM';
  label: string;
  label2: string | null;
  rate: number;
  isCompound: boolean;
  baseAmount: number;
  taxAmount: number;
  profileId?: string;
};

/**
 * A default tax profile row that feeds the payment preview / client fallback.
 */
export type TaxProfileEntry = {
  id: string;
  name: string;
  name2: string | null;
  tax_type: string;
  rate: number;
  is_compound: boolean;
  enabled: boolean;
};

/**
 * Server-computed totals returned by `/api/v1/orders/preview-payment`.
 */
export type ServerTotals = {
  subtotal: number;
  manualDiscount: number;
  autoRuleDiscount: number;
  promoDiscount: number;
  afterDiscounts: number;
  additionalTaxAmount: number;
  vatValue: number;
  giftCardApplied: number;
  saleTotal: number;
  vatTaxPercent: number;
  taxBreakdown: TaxBreakdownLine[];
  creditLimit?: {
    currentBalance: number;
    creditLimit: number;
    available: number;
    wouldExceed: boolean;
    mode?: 'warn' | 'block';
  };
};

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
  appliedPromoCode: AppliedPromoCode | null;
  appliedGiftCard: AppliedGiftCard | null;
  decimalPlaces: number;
  csrfToken: string | null;
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
 * @param params.t - `newOrder.payment` translate function.
 * @returns Server totals, the resolved `totals`/`saleTotal`, tax breakdown, and
 *   `checkoutEligibilityAmount` (consumed by the catalog hook).
 */
export function usePaymentTotals({
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
  appliedPromoCode,
  appliedGiftCard,
  decimalPlaces,
  csrfToken,
  t,
}: UsePaymentTotalsParams) {
  const [taxRate, setTaxRate] = useState<number>(0.06);
  const [taxProfileEntries, setTaxProfileEntries] = useState<TaxProfileEntry[]>([]);
  const [serverTotals, setServerTotals] = useState<ServerTotals | null>(null);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the promo code that was sent in the last successful preview fetch.
  // When appliedPromoCode.code differs, serverTotals.promoDiscount is stale and
  // we fall back to the client-side validation amount to avoid a 0-flash.
  const lastFetchedPromoCodeRef = useRef<string | null>(null);

  const checkoutEligibilityAmount = serverTotals?.saleTotal ?? checkoutAmount ?? total;

  // Tax-profile open-reset (render-time Pattern A — the async load below repopulates).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTaxProfileEntries([]);
    }
  }

  // Clear stale totals at render-time when there is nothing to preview (was a
  // synchronous setState in the debounce effect body; moved out to keep that effect
  // lint-clean). Self-terminating via the `!== null` guard.
  if ((!open || items.length === 0) && serverTotals !== null) {
    setServerTotals(null);
  }

  // Load tax rate + default tax profiles on open. setState runs in promise
  // callbacks (not flagged by set-state-in-effect).
  useEffect(() => {
    if (open && tenantOrgId) {
      taxService.getTaxRate(tenantOrgId, branchId).then(rate => {
        setTaxRate(rate);
      }).catch(() => {
        setTaxRate(0.05);
      });
      getTaxProfilesAction().then(res => {
        if (res.success && res.data) {
          const defaultActive = res.data
            .filter(p => p.is_default && p.is_active)
            .sort((a, b) => a.tax_type.localeCompare(b.tax_type));
          setTaxProfileEntries(defaultActive.map(p => ({
            id: p.id,
            name: p.name,
            name2: p.name2,
            tax_type: p.tax_type,
            rate: Number(p.rate),
            is_compound: p.is_compound,
            enabled: true,
          })));
        }
      }).catch(() => {
        setTaxProfileEntries([]);
      });
    }
  }, [open, tenantOrgId, branchId]);

  // Preview-payment fetch (debounced 300ms)
  const fetchPreview = useCallback(async () => {
    if (!open || items.length === 0 || !tenantOrgId) return;
    setTotalsLoading(true);
    try {
      const res = await fetch('/api/v1/orders/preview-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        credentials: 'include',
        body: JSON.stringify({
          items,
          branchId: branchId || undefined,
          customerId: customerId || undefined,
          isExpress,
          percentDiscount: percentDiscount ?? 0,
          amountDiscount: amountDiscount ?? 0,
          serviceCategories: serviceCategories && serviceCategories.length > 0 ? serviceCategories : undefined,
          taxProfileIds: taxProfileEntries.filter((entry) => entry.enabled).map((entry) => entry.id),
          ...(!NEW_ORDER_PROMO_GIFT_DISABLED && {
            promoCode: appliedPromoCode?.code || undefined,
            giftCardNumber: appliedGiftCard?.number || undefined,
            giftCardAmount: appliedGiftCard?.amount || undefined,
            giftCardId: appliedGiftCard?.id || undefined,
          }),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        // Record the promo code that was used in this fetch so the totals memo
        // can detect when serverTotals.promoDiscount is stale (promo changed but
        // the preview hasn't re-fetched yet).
        lastFetchedPromoCodeRef.current = appliedPromoCode?.code ?? null;
        setServerTotals({
          subtotal: d.subtotal,
          manualDiscount: d.manualDiscount,
          autoRuleDiscount: typeof d.autoRuleDiscount === 'number' ? d.autoRuleDiscount : 0,
          promoDiscount: d.promoDiscount,
          afterDiscounts: d.afterDiscounts,
          additionalTaxAmount: d.additionalTaxAmount ?? 0,
          vatValue: d.vatValue,
          giftCardApplied: d.giftCardApplied,
          saleTotal: d.saleTotal,
          vatTaxPercent: d.vatTaxPercent ?? 0,
          taxBreakdown: Array.isArray(d.taxBreakdown) ? d.taxBreakdown : [],
          ...(d.creditLimit && { creditLimit: d.creditLimit }),
        });
      } else if (!res.ok && json.errorCode === 'PRODUCT_NOT_FOUND') {
        setServerTotals(null);
        cmxMessage.error(json.error ?? t('errors.productNotFound'));
      } else if (!res.ok && json.error) {
        setServerTotals(null);
        const details = json.details as Array<{ path?: (string | number)[]; message?: string }> | undefined;
        const msg =
          details && Array.isArray(details) && details.length > 0
            ? details.map((d) => {
                const path = (d.path ?? []).join('.');
                return path ? `${path}: ${d.message ?? ''}` : (d.message ?? '');
              }).join('. ')
            : (json.error as string);
        cmxMessage.error(msg);
      }
    } catch {
      setServerTotals(null);
    } finally {
      setTotalsLoading(false);
    }
  }, [open, items, tenantOrgId, branchId, customerId, isExpress, percentDiscount, amountDiscount, serviceCategories, taxProfileEntries, appliedPromoCode?.code, appliedGiftCard?.number, appliedGiftCard?.amount, appliedGiftCard?.id, csrfToken, t]);

  useEffect(() => {
    if (!open || items.length === 0) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview();
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, items, fetchPreview]);

  const afterDiscountsForTax = useMemo(() => {
    if (serverTotals) return serverTotals.afterDiscounts;
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedPromoCode?.discount || 0);
    return Math.max(0, subtotal - manualDiscount - promoDiscount);
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode]);

  const fallbackTaxBreakdown = useMemo<TaxBreakdownLine[]>(() => {
    const selectedProfiles = taxProfileEntries.filter((entry) => entry.enabled);
    if (selectedProfiles.length > 0) {
      let accumulatedPriorTax = 0;
      return selectedProfiles.map((entry) => {
        const taxableBase = entry.is_compound ? afterDiscountsForTax + accumulatedPriorTax : afterDiscountsForTax;
        const taxAmount = parseFloat((taxableBase * (entry.rate / 100)).toFixed(decimalPlaces));
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
      return [{
        taxType: 'VAT',
        label: 'VAT',
        label2: 'ضريبة القيمة المضافة',
        rate: taxRate * 100,
        isCompound: false,
        baseAmount: afterDiscountsForTax,
        taxAmount: parseFloat((afterDiscountsForTax * taxRate).toFixed(decimalPlaces)),
      }];
    }

    return [];
  }, [taxProfileEntries, afterDiscountsForTax, decimalPlaces, taxRate]);

  const displayTaxBreakdown =
    serverTotals?.taxBreakdown?.length
      ? serverTotals.taxBreakdown
      : totalsLoading || (items.length > 0 && !serverTotals)
        ? []
        : fallbackTaxBreakdown;
  const profilesTaxAmount = useMemo(
    () => parseFloat(displayTaxBreakdown.reduce((sum, line) => sum + line.taxAmount, 0).toFixed(decimalPlaces)),
    [displayTaxBreakdown, decimalPlaces]
  );

  const totals = useMemo(() => {
    if (serverTotals) {
      // If the applied promo code differs from what was used in the last preview fetch,
      // serverTotals.promoDiscount is stale (the debounce hasn't fired yet). Use the
      // client-side validation amount to avoid a zero-flash in the inspector.
      const currentPromoCode = !NEW_ORDER_PROMO_GIFT_DISABLED ? (appliedPromoCode?.code ?? null) : null;
      const promoIsStale = currentPromoCode !== lastFetchedPromoCodeRef.current;
      const effectivePromoDiscount = promoIsStale
        ? (!NEW_ORDER_PROMO_GIFT_DISABLED ? (appliedPromoCode?.discount ?? 0) : 0)
        : serverTotals.promoDiscount;
      const serverTaxTotal = serverTotals.taxBreakdown.reduce((sum, line) => sum + line.taxAmount, 0);
      return {
        ...serverTotals,
        promoDiscount: effectivePromoDiscount,
        taxRate: 0,
        taxAmount: serverTotals.additionalTaxAmount ?? 0,
        totalSavings: serverTotals.subtotal + serverTaxTotal - serverTotals.saleTotal,
      };
    }
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount  = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedPromoCode?.discount || 0);
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);
    const vatValue = parseFloat(
      fallbackTaxBreakdown
        .filter((line) => line.taxType === 'VAT' || line.taxType === 'GST')
        .reduce((sum, line) => sum + line.taxAmount, 0)
        .toFixed(decimalPlaces)
    );
    const taxAmount = parseFloat(
      fallbackTaxBreakdown
        .filter((line) => line.taxType === 'CUSTOM')
        .reduce((sum, line) => sum + line.taxAmount, 0)
        .toFixed(decimalPlaces)
    );
    const giftCardApplied = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
    const saleTotal      = Math.max(0, afterDiscounts + profilesTaxAmount);
    return {
      subtotal,
      manualDiscount,
      autoRuleDiscount: 0,
      promoDiscount,
      afterDiscounts,
      taxRate: 0,
      taxAmount,
      vatTaxPercent: fallbackTaxBreakdown.find((line) => line.taxType === 'VAT' || line.taxType === 'GST')?.rate ?? (taxRate * 100),
      vatValue,
      giftCardApplied,
      saleTotal,
      totalSavings: subtotal + taxAmount + vatValue - saleTotal,
    };
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode, appliedGiftCard, taxRate, profilesTaxAmount, decimalPlaces, fallbackTaxBreakdown]);

  const saleTotal = totals.saleTotal;

  return {
    serverTotals,
    totalsLoading,
    totals,
    saleTotal,
    taxProfileEntries,
    displayTaxBreakdown,
    profilesTaxAmount,
    checkoutEligibilityAmount,
  };
}
