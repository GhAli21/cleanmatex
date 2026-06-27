// Import the pure helper from the utils module (not the hook) so this jest suite
// avoids the hook's cmxMessage import chain. The usePaymentLegs hook re-exports the
// same `quickTender` for runtime consumers.
import { quickTender } from '@features/orders/ui/payment-modal-v4.utils';
import type {
  QuickTenderInput,
  QuickTenderPolicy,
} from '@features/orders/ui/payment-modal-v4.utils';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

/**
 * Builds a minimal payment leg for the pure quick-tender math. Only `method` +
 * `amount` matter to `quickTender` (it caps off `legs`/`saleTotal`); the rest of the
 * `PaymentLeg` shape is irrelevant here.
 */
function makeLeg(method: string, amount: number): PaymentLeg {
  return { method, amount } as PaymentLeg;
}

const CASH_POLICY: QuickTenderPolicy = {
  isCash: true,
  supportsChangeReturn: true,
  supportsOverpayment: false,
};
const CASH_NO_CHANGE_POLICY: QuickTenderPolicy = {
  isCash: true,
  supportsChangeReturn: false,
  supportsOverpayment: false,
};
const CARD_POLICY: QuickTenderPolicy = {
  isCash: false,
  supportsChangeReturn: false,
  supportsOverpayment: false,
};

function baseInput(overrides: Partial<QuickTenderInput>): QuickTenderInput {
  const legs = overrides.legs ?? [makeLeg('CASH', 0)];
  return {
    kind: 'exact',
    leg: legs[overrides.legIndex ?? 0],
    legs,
    legIndex: 0,
    saleTotal: 100,
    giftCardSettlementAmount: 0,
    decimalPlaces: 2,
    policy: CASH_POLICY,
    ...overrides,
  };
}

describe('quickTender', () => {
  it('exact on cash → applies the full remaining and tenders it with no change', () => {
    const result = quickTender(baseInput({ kind: 'exact' }));
    expect(result.appliedAmount).toBe(100);
    expect(result.cashTendered).toBe(100);
    // change = tendered - applied
    expect((result.cashTendered ?? 0) - result.appliedAmount).toBe(0);
  });

  it('exact on a non-cash leg == the remaining cap, with no cashTendered', () => {
    const result = quickTender(
      baseInput({ kind: 'exact', legs: [makeLeg('CARD', 0)], policy: CARD_POLICY })
    );
    expect(result.appliedAmount).toBe(100);
    expect(result.cashTendered).toBeUndefined();
  });

  it('caps the applied amount to remaining when other legs already consume the order', () => {
    const legs = [makeLeg('CARD', 30), makeLeg('CASH', 0)];
    const result = quickTender(baseInput({ kind: 'exact', legs, legIndex: 1 }));
    // remaining = 100 - 30 (other leg) = 70 — never the full sale total.
    expect(result.appliedAmount).toBe(70);
    expect(result.cashTendered).toBe(70);
  });

  it('never exceeds the stored-value cap (gate preserved)', () => {
    const result = quickTender(
      baseInput({
        kind: 'exact',
        legs: [makeLeg('WALLET', 0)],
        policy: CARD_POLICY,
        storedValueCap: 40,
      })
    );
    // remaining is 100 but the wallet cap clamps it.
    expect(result.appliedAmount).toBe(40);
    expect(result.cashTendered).toBeUndefined();
  });

  it('zero remaining → 0 applied / 0 tendered', () => {
    const legs = [makeLeg('CARD', 100), makeLeg('CASH', 0)];
    const result = quickTender(baseInput({ kind: 'exact', legs, legIndex: 1 }));
    expect(result.appliedAmount).toBe(0);
    expect(result.cashTendered).toBe(0);
  });

  it('change-entry (cash) — tendered = remaining + requested change, applied = remaining', () => {
    const result = quickTender(baseInput({ kind: 'change', changeValue: 20 }));
    expect(result.appliedAmount).toBe(100);
    expect(result.cashTendered).toBe(120);
    // the inverse: requested change is recoverable as tendered - applied.
    expect((result.cashTendered ?? 0) - result.appliedAmount).toBe(20);
  });

  it('change-entry honors 3-dp precision (BHD/OMR)', () => {
    const result = quickTender(
      baseInput({
        kind: 'change',
        changeValue: 0.25,
        saleTotal: 10.555,
        decimalPlaces: 3,
        legs: [makeLeg('CASH', 0)],
      })
    );
    expect(result.appliedAmount).toBe(10.555);
    expect(result.cashTendered).toBe(10.805);
  });

  it('change-entry on a non-cash leg clamps to exact (no change, no tender)', () => {
    const result = quickTender(
      baseInput({
        kind: 'change',
        changeValue: 20,
        legs: [makeLeg('CARD', 0)],
        policy: CARD_POLICY,
      })
    );
    expect(result.appliedAmount).toBe(100);
    expect(result.cashTendered).toBeUndefined();
  });

  it('change-entry on cash without change-return support clamps to exact', () => {
    const result = quickTender(
      baseInput({
        kind: 'change',
        changeValue: 20,
        legs: [makeLeg('CASH', 0)],
        policy: CASH_NO_CHANGE_POLICY,
      })
    );
    expect(result.appliedAmount).toBe(100);
    // tendered clamps to applied — no change returned.
    expect(result.cashTendered).toBe(100);
  });
});
