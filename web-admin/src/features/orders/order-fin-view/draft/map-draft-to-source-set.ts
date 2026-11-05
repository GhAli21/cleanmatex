/**
 * Draft adapter (PLAN §6.3, D8, P3-07): payment-modal-v4's unsaved order →
 * the same normalized source set the saved-order loader produces, so the same
 * builders run. Pure, runs in the browser, no fetch.
 *
 * No money math of its own. The only arithmetic regroups figures the quote and
 * engine already return split: the three order discounts, VAT plus other tax,
 * and credit legs plus the gift card. Each sum rebuilds a figure the server
 * also forms the same way (taxTotal, the adjustment total, credits applied).
 */
import { CREDIT_APPLICATION_TYPES, TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import { roundMoneyAmount } from '@/lib/money/format-money';
import type { OrderFinDraftInput, OrderFinFactInput, OrderFinSourceSet } from '@/lib/types/order-fin-view';

// DECIMAL(19,4), as `round4` in the server aggregation module (not importable client-side).
const sum = (...values: Array<number | undefined>) => roundMoneyAmount(values.reduce<number>((s, v) => s + (v ?? 0), 0), 4);

const legFacts = (entries: OrderFinDraftInput['realPaymentEntries']): OrderFinFactInput[] =>
  entries.map(({ leg, index }) => ({ id: `leg-${index}`, amount: leg.amount ?? 0, state: 'normal', methodCode: leg.method ?? null }));

/**
 * @param draft - figures payment-modal-v4 already shows (server quote + engine outputs)
 * @returns a `draft` source set; resolve the config with `sourceKind: 'draft'` so pre-submit sections stay hidden
 * @example assembleOrderFinancialView(mapDraftToSourceSet(draft), resolveOrderFinDisplayConfig({ preset: 'detailed' }, 'draft'), new Date().toISOString())
 */
export function mapDraftToSourceSet(draft: OrderFinDraftInput): OrderFinSourceSet {
  const q = draft.quote;
  const discounts: OrderFinFactInput[] = (
    [['manualDiscount', q.manualDiscount], ['autoRuleDiscount', q.autoRuleDiscount], ['promoDiscount', q.promoDiscount]] as const
  )
    .filter(([, amount]) => amount !== 0)
    .map(([key, amount]) => ({ id: `draft-${key}`, labelKey: `orders.finView.lines.${key}`, amount, state: 'normal' }));

  const credits = legFacts(draft.customerCreditEntries);
  if (draft.giftCardSettlementAmount > 0) {
    credits.push({ id: 'gift-card', amount: draft.giftCardSettlementAmount, state: 'normal', methodCode: CREDIT_APPLICATION_TYPES.GIFT_CARD });
  }

  return {
    sourceKind: 'draft',
    snapshot: {
      orderId: null,
      orderNo: null,
      orderStatus: null,
      currencyCode: draft.currencyCode,
      currencyDecimals: draft.currencyDecimals,
      snapshotStatus: null,
      paymentStatus: null,
      settlementType: draft.settlementType,
      mismatchCount: 0,
      itemsBase: q.subtotal,
      // The calculator's included extras for this quote; absent (older quote shape) = unknown.
      extrasIncluded: q.extrasIncludedAmount ?? null,
      speedPremiumIncluded: q.speedPremiumIncludedAmount ?? null,
      charges: q.chargesTotal ?? 0,
      discount: sum(q.manualDiscount, q.autoRuleDiscount, q.promoDiscount),
      tax: sum(q.vatValue, q.additionalTaxAmount),
      rounding: q.roundingAdjustmentAmount ?? 0,
      // Resolved by the server for this quote; the client never chooses it.
      taxPricingMode: q.taxPricingMode ?? TAX_PRICING_MODES.TAX_EXCLUSIVE,
      total: q.saleTotal,
      paid: draft.payNowAmount,
      credits: sum(draft.customerCreditAmount, draft.giftCardSettlementAmount),
      refunded: 0,
      netCollected: draft.payNowAmount,
      outstanding: draft.remainingBalance,
      overpaid: draft.unresolvedOverpaymentAmount,
      changeReturned: draft.displayChangeAmount,
      receivable: 0,
      baseCurrency: null,
      engineVersion: null,
      calculationHash: null,
      traceId: null,
    },
    facts: {
      ...(draft.items ? { items: draft.items.map((i) => ({ ...i, state: 'normal' as const })) } : {}),
      discounts,
      taxes: q.taxBreakdown.map((t, i) => ({
        id: t.profileId ?? `tax-${i}`,
        label: { name: t.label, name2: t.label2 },
        amount: t.taxAmount,
        state: 'normal',
        methodCode: t.taxType,
      })),
      payments: legFacts(draft.realPaymentEntries),
      credits,
    },
    errors: {},
  };
}
