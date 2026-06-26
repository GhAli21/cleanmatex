import { renderHook } from '@testing-library/react';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import {
  useMoneyDerivations,
  type MoneyDerivationMethodOption,
  type UseMoneyDerivationsParams,
} from '@features/orders/hooks/use-money-derivations';

const CASH = PAYMENT_METHODS.CASH;
const CARD = PAYMENT_METHODS.CARD;

function leg(partial: Partial<PaymentLeg> & { method: string; amount: number }): PaymentLeg {
  return partial as PaymentLeg;
}

function makeParams(
  legs: PaymentLeg[],
  overrides: Partial<UseMoneyDerivationsParams> = {}
): UseMoneyDerivationsParams {
  const cashChangeOption: MoneyDerivationMethodOption = {
    supports_change_return: true,
    supports_overpayment: false,
    requires_cash_drawer: true,
  };
  const plainOption: MoneyDerivationMethodOption = {
    supports_change_return: false,
    supports_overpayment: false,
  };
  return {
    paymentLegs: legs,
    immediateMethodCodes: [CASH, CARD],
    creditMethodCodes: ['WALLET', 'CREDIT_NOTE', 'ADVANCE'],
    getMethodOption: (method) => (method === CASH ? cashChangeOption : plainOption),
    getLegStoredValueCap: () => undefined,
    saleTotal: 100,
    giftCardSettlementAmount: 0,
    decimalPlaces: 3,
    ...overrides,
  };
}

describe('useMoneyDerivations', () => {
  it('settles a single exact cash leg with no change or remainder', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(makeParams([leg({ method: CASH, amount: 100, cashTendered: 100 })]))
    );
    expect(result.current.settledNowAmount).toBe(100);
    expect(result.current.remainingBalance).toBe(0);
    expect(result.current.changeAmount).toBe(0);
    expect(result.current.cashChangeAmount).toBe(0);
    expect(result.current.amountAppliedToOrder).toBe(100);
  });

  it('returns change when cash is over-tendered and change is allowed', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(makeParams([leg({ method: CASH, amount: 100, cashTendered: 120 })]))
    );
    expect(result.current.canReturnChangeFromCash).toBe(true);
    expect(result.current.cashChangeAmount).toBeCloseTo(20, 3);
    expect(result.current.remainingBalance).toBe(0);
  });

  it('leaves a remainder when underpaid', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(makeParams([leg({ method: CASH, amount: 60, cashTendered: 60 })]))
    );
    expect(result.current.remainingBalance).toBeCloseTo(40, 3);
    expect(result.current.amountAppliedToOrder).toBeCloseTo(60, 3);
  });

  it('aggregates a split across two legs', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(
        makeParams([
          leg({ method: CASH, amount: 40, cashTendered: 40 }),
          leg({ method: CARD, amount: 60 }),
        ])
      )
    );
    expect(result.current.settlementLegEntries).toHaveLength(2);
    expect(result.current.settledNowAmount).toBeCloseTo(100, 3);
    expect(result.current.remainingBalance).toBe(0);
  });

  it('counts credit legs as customer credit, not real payment', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(makeParams([leg({ method: 'WALLET', amount: 30 })]))
    );
    expect(result.current.customerCreditAmount).toBeCloseTo(30, 3);
    expect(result.current.payNowAmount).toBe(0);
    expect(result.current.settledNowAmount).toBeCloseTo(30, 3);
  });

  it('flags a wallet leg that exceeds its live cap', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(
        makeParams([leg({ method: 'WALLET', amount: 50 })], {
          getLegStoredValueCap: (l) => (l.method === 'WALLET' ? 30 : undefined),
        })
      )
    );
    expect(result.current.walletLegExceedsLiveBalance).toBe(true);
    expect(result.current.storedValueLegExceedsBalance).toBe(true);
  });

  it('uses an epsilon that scales with decimal places', () => {
    const { result } = renderHook(() =>
      useMoneyDerivations(makeParams([leg({ method: CASH, amount: 100 })], { decimalPlaces: 3 }))
    );
    expect(result.current.moneyEpsilon).toBeCloseTo(0.0001, 10);
  });
});
