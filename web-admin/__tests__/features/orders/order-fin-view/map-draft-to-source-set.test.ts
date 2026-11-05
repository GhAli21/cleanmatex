/**
 * P3-07 — draft adapter (PLAN §6.3). The draft view must show exactly the
 * figures payment-modal-v4 shows for the same inputs: the server quote and the
 * engine's own money derivations (`useMoneyDerivations`), run here for real.
 */
import { renderHook } from '@testing-library/react';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { OrderFinDraftInput } from '@/lib/types/order-fin-view';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import { orderFinancialViewSchema } from '@/lib/validations/order-fin-view-schemas';
import { useMoneyDerivations } from '@features/orders/hooks/use-money-derivations';
import { DRAFT_HIDDEN_SECTIONS, resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { mapDraftToSourceSet } from '@/src/features/orders/order-fin-view/draft/map-draft-to-source-set';
import { assembleOrderFinancialView } from '@/src/features/orders/order-fin-view/vwbuilders/assemble';

const NOW = '2026-10-31T10:00:00.000Z';
const { CASH, CARD } = PAYMENT_METHODS;
const WALLET = 'WALLET';

// A quote as `/api/v1/orders/preview-payment` returns it (OMR, exclusive tax, cash rounding).
const quote: OrderFinDraftInput['quote'] = {
  subtotal: 10,
  manualDiscount: 0.5,
  autoRuleDiscount: 0.25,
  promoDiscount: 0,
  vatValue: 0.5,
  additionalTaxAmount: 0.1,
  taxBreakdown: [
    { taxType: 'VAT', label: 'VAT', label2: 'ضريبة القيمة المضافة', rate: 5, isCompound: false, baseAmount: 10, taxAmount: 0.5, profileId: 'tp-vat' },
    { taxType: 'CUSTOM', label: 'City fee', label2: 'رسوم البلدية', rate: 1, isCompound: false, baseAmount: 10, taxAmount: 0.1 },
  ],
  chargesTotal: 1,
  roundingAdjustmentAmount: -0.005,
  saleTotal: 10.845,
  extrasIncludedAmount: 0.75,
  speedPremiumIncludedAmount: 1.25,
};

function engine(legs: PaymentLeg[], giftCard = 0) {
  const { result } = renderHook(() => useMoneyDerivations({
    paymentLegs: legs,
    immediateMethodCodes: [CASH, CARD],
    creditMethodCodes: [WALLET],
    getMethodOption: (m) => (m === CASH ? { supports_change_return: true } : {}),
    getLegStoredValueCap: () => undefined,
    saleTotal: quote.saleTotal,
    giftCardSettlementAmount: giftCard,
    decimalPlaces: 3,
  }));
  return result.current;
}

function draftFrom(legs: PaymentLeg[], giftCard = 0, change = 0): OrderFinDraftInput {
  const m = engine(legs, giftCard);
  return {
    currencyCode: 'OMR', currencyDecimals: 3, settlementType: null, quote,
    items: [{ id: 'line-1', label: { name: 'Shirt', name2: 'قميص' }, amount: 10 }],
    realPaymentEntries: m.realPaymentEntries,
    customerCreditEntries: m.customerCreditEntries,
    payNowAmount: m.payNowAmount,
    customerCreditAmount: m.customerCreditAmount,
    remainingBalance: m.remainingBalance,
    giftCardSettlementAmount: giftCard,
    displayChangeAmount: change,
    unresolvedOverpaymentAmount: 0,
  };
}

const view = (d: OrderFinDraftInput) =>
  assembleOrderFinancialView(mapDraftToSourceSet(d), resolveOrderFinDisplayConfig({ preset: 'full' }, 'draft'), NOW);

describe('mapDraftToSourceSet', () => {
  const legs = [{ method: CASH, amount: 5, cashTendered: 5 }, { method: CARD, amount: 2 }, { method: WALLET, amount: 1 }] as PaymentLeg[];

  it('shows the quote and engine figures the modal shows, unchanged', () => {
    const d = draftFrom(legs, 1.5);
    const v = view(d);
    expect(orderFinancialViewSchema.safeParse(v).success).toBe(true);
    expect(v.sourceKind).toBe('draft');
    expect(v.header.metrics).toMatchObject({
      total: quote.saleTotal,
      paid: d.payNowAmount,          // 7
      credits: 2.5,                  // wallet leg 1 + gift card 1.5
      balance: d.remainingBalance,   // engine's own remainder
      tax: 0.6,
      discount: 0.75,
    });
    expect(d.payNowAmount).toBe(7);
    expect(v.header.metrics.balance).toBeCloseTo(quote.saleTotal - 7 - 1 - 1.5, 4);

    expect(v.sections.items!.totals[0].amount).toBe(quote.subtotal);
    expect(v.sections.items!.lines!.filter((l) => l.role === 'included').map((l) => [l.labelKey, l.amount])).toEqual([
      ['orders.finView.lines.speedPremiumIncluded', 1.25], ['orders.finView.lines.extrasIncluded', 0.75],
    ]);
    expect(v.sections.charges!.totals[0].amount).toBe(quote.chargesTotal);
    expect(v.sections.discounts!.lines!.map((l) => [l.labelKey, l.amount])).toEqual([
      ['orders.finView.lines.manualDiscount', 0.5], ['orders.finView.lines.autoRuleDiscount', 0.25],
    ]);
    expect(v.sections.taxes!.lines!.map((l) => [l.label?.name, l.amount])).toEqual([['VAT', 0.5], ['City fee', 0.1]]);
    expect(v.sections.payments!.lines!.map((l) => [l.meta?.methodCode, l.amount])).toEqual([[CASH, 5], [CARD, 2]]);
    expect(v.sections.credits!.lines!.map((l) => [l.meta?.methodCode, l.amount])).toEqual([[WALLET, 1], ['GIFT_CARD', 1.5]]);
  });

  it('every counted line adds up to its section total (same formula, no drift)', () => {
    const v = view(draftFrom(legs, 1.5));
    for (const key of ['discounts', 'taxes', 'payments', 'credits'] as const) {
      const s = v.sections[key]!;
      const counted = s.lines!.filter((l) => l.countsInTotal).reduce((a, l) => a + (l.amount ?? 0), 0);
      expect([key, Math.round(counted * 1e4) / 1e4]).toEqual([key, s.totals[0].amount]);
    }
  });

  it('change due and a settled order come from the engine', () => {
    const exact = [{ method: CASH, amount: quote.saleTotal, cashTendered: 20 }] as PaymentLeg[];
    const v = view(draftFrom(exact, 0, 9.155));
    expect(v.header.metrics).toMatchObject({ balance: 0, changeReturned: 9.155 });
    expect(v.header.balanceState).toBe('settled');
  });

  it('an unresolved overpayment reads as overpaid, never as settled', () => {
    const over = [{ method: CARD, amount: 12 }] as PaymentLeg[];
    const d = { ...draftFrom(over), unresolvedOverpaymentAmount: 1.155 };
    const v = view(d);
    expect(v.header.metrics).toMatchObject({ balance: 0, overpaid: 1.155 });
    expect(v.header.balanceState).toBe('overpaid');
    // Moved to wallet/advance (resolved): nothing left over, so settled.
    expect(view({ ...d, unresolvedOverpaymentAmount: 0 }).header.balanceState).toBe('settled');
  });

  it('hides every section with no meaning before submission, whatever the preset', () => {
    const v = view(draftFrom(legs));
    for (const key of DRAFT_HIDDEN_SECTIONS) expect([key, v.sections[key]]).toEqual([key, undefined]);
    expect(v.warnings).toEqual([]);
    expect(v.orderId).toBeNull();
    expect(v.snapshotStatus).toBeNull();
  });
});
