'use client';

/**
 * Money derivations for Payment Modal V4.
 *
 * Verbatim extraction of the payment modal's leg-aggregation + change/overpayment
 * math (previously inline in `payment-modal-v4.tsx`). Pure and parameterized: it
 * recomputes nothing about catalog/validation and only reduces over the legs and
 * trusted totals threaded in. Keeping it isolated makes the cashier money math
 * unit-testable and lets Simple/Full views share one source of truth.
 *
 * Behavior freeze: this hook must stay byte-equivalent to the original inline
 * derivations — do not "improve" the math here. See
 * `docs/features/Order_Fin/Payment_Modal_Review/`.
 */

import { useMemo } from 'react';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import {
  canReturnChangeFromAllCashLegs,
  deriveCashTenderedAmount,
  deriveChangeReturnedAmount,
  deriveLegAppliedAmount,
  getAmountAppliedToOrder,
  getUnresolvedOverpaymentAmount,
  walletLegExceedsBalance,
} from '@features/orders/ui/payment-modal-v4.utils';

/**
 * Settlement-option fields the money math needs to resolve change/overpayment
 * behavior per leg. Structurally satisfied by the modal's `CheckoutSettlementOption`.
 */
export interface MoneyDerivationMethodOption {
  supports_change_return?: boolean;
  supports_overpayment?: boolean;
  requires_cash_drawer?: boolean;
}

/**
 * A payment leg paired with its index in the legs array.
 */
export interface PaymentLegEntry {
  leg: PaymentLeg;
  index: number;
}

/**
 * Stored-value exceedance descriptor for the offending leg, when any.
 */
export interface StoredValueLegExceedance {
  leg: PaymentLeg;
  index: number;
  cap: number;
}

/**
 * Inputs threaded from catalog/totals/form state. All trusted, already-derived.
 */
export interface UseMoneyDerivationsParams {
  paymentLegs: PaymentLeg[];
  immediateMethodCodes: readonly string[];
  creditMethodCodes: string[];
  getMethodOption: (
    method: string,
    gatewayCode?: string | null
  ) => MoneyDerivationMethodOption | undefined;
  getLegStoredValueCap: (leg: PaymentLeg) => number | undefined;
  saleTotal: number;
  giftCardSettlementAmount: number;
  decimalPlaces: number;
}

/**
 * Derived cashier money model for the payment modal.
 */
export interface MoneyDerivations {
  settlementLegEntries: PaymentLegEntry[];
  realPaymentEntries: PaymentLegEntry[];
  customerCreditEntries: PaymentLegEntry[];
  payNowAmount: number;
  customerCreditAmount: number;
  settledNowAmount: number;
  cashLegAmount: number;
  cashTenderedAmount: number;
  totalSettledNowAmount: number;
  walletLegEntry: PaymentLegEntry | null;
  storedValueLegExceedance: StoredValueLegExceedance | null;
  walletLegExceedsLiveBalance: boolean;
  storedValueLegExceedsBalance: boolean;
  moneyEpsilon: number;
  remainingBalance: number;
  changeAmount: number;
  canReturnChangeFromCash: boolean;
  cashChangeAmount: number;
  cashChangeCapacity: number;
  legacyUnresolvedOverpaymentAmount: number;
  amountAppliedToOrder: number;
}

/**
 * Computes the cashier money model from legs + trusted totals.
 *
 * @param params Legs, method-code sets, option/cap resolvers, and trusted totals.
 * @returns The derived money model used by the workbench, right rail, and submit.
 */
export function useMoneyDerivations({
  paymentLegs,
  immediateMethodCodes,
  creditMethodCodes,
  getMethodOption,
  getLegStoredValueCap,
  saleTotal,
  giftCardSettlementAmount,
  decimalPlaces,
}: UseMoneyDerivationsParams): MoneyDerivations {
  const settlementLegEntries = useMemo(
    () =>
      paymentLegs
        .map((leg, index) => ({ leg, index }))
        .filter(({ leg }) => (leg.amount ?? 0) > 0),
    [paymentLegs]
  );

  const realPaymentEntries = useMemo(
    () =>
      settlementLegEntries.filter(({ leg }) =>
        immediateMethodCodes.includes(leg.method)
      ),
    [immediateMethodCodes, settlementLegEntries]
  );

  const customerCreditEntries = useMemo(
    () => settlementLegEntries.filter(({ leg }) => creditMethodCodes.includes(leg.method)),
    [creditMethodCodes, settlementLegEntries]
  );

  const payNowAmount = useMemo(
    () => realPaymentEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0),
    [realPaymentEntries]
  );

  const customerCreditAmount = useMemo(
    () => customerCreditEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0),
    [customerCreditEntries]
  );

  const settledNowAmount = useMemo(
    () => payNowAmount + customerCreditAmount,
    [customerCreditAmount, payNowAmount]
  );
  const cashLegAmount = useMemo(
    () =>
      realPaymentEntries
        .filter(({ leg }) => leg.method === PAYMENT_METHODS.CASH)
        .reduce((sum, { leg }) => sum + (leg.amount || 0), 0),
    [realPaymentEntries]
  );
  const cashTenderedAmount = useMemo(
    () =>
      realPaymentEntries
        .filter(({ leg }) => leg.method === PAYMENT_METHODS.CASH)
        .reduce((sum, { leg }) => sum + (leg.cashTendered ?? leg.amount ?? 0), 0),
    [realPaymentEntries]
  );
  const totalSettledNowAmount = settledNowAmount + giftCardSettlementAmount;
  const walletLegEntry = useMemo(
    () => settlementLegEntries.find(({ leg }) => leg.method === 'WALLET') ?? null,
    [settlementLegEntries]
  );
  const storedValueLegExceedance = useMemo<StoredValueLegExceedance | null>(
    () =>
      settlementLegEntries.reduce<StoredValueLegExceedance | null>((found, { leg, index }) => {
        if (found) return found;
        const cap = getLegStoredValueCap(leg);
        if (cap != null && walletLegExceedsBalance(leg.amount || 0, cap)) {
          return { leg, index, cap };
        }
        return found;
      }, null),
    [getLegStoredValueCap, settlementLegEntries]
  );
  const walletLegExceedsLiveBalance =
    storedValueLegExceedance?.leg.method === 'WALLET' &&
    !!storedValueLegExceedance;
  const storedValueLegExceedsBalance = !!storedValueLegExceedance;

  const moneyEpsilon = Math.pow(10, -(decimalPlaces + 1));

  const remainingBalance = Math.max(0, saleTotal - totalSettledNowAmount);
  const changeAmount = Math.max(0, totalSettledNowAmount - saleTotal);
  const canReturnChangeFromCash = useMemo(
    () =>
      canReturnChangeFromAllCashLegs(
        realPaymentEntries
          .filter(({ leg }) => leg.method === PAYMENT_METHODS.CASH)
          .map(({ leg }) => ({
            supportsChangeReturn:
              getMethodOption(leg.method, leg.gateway_code)?.supports_change_return === true,
          }))
      ),
    [getMethodOption, realPaymentEntries]
  );
  const cashChangeAmount = deriveChangeReturnedAmount(
    cashTenderedAmount,
    cashLegAmount,
    canReturnChangeFromCash,
    moneyEpsilon
  );
  const cashChangeCapacity = realPaymentEntries.reduce((sum, { leg }) => {
    if (leg.method !== PAYMENT_METHODS.CASH) return sum;
    const option = getMethodOption(leg.method, leg.gateway_code);
    if (option?.supports_change_return !== true) return sum;
    const applied = deriveLegAppliedAmount({
      rawAmount: leg.amount,
      paymentLegs: settlementLegEntries.map(({ leg: l }) => ({ amount: l.amount })),
      legIndex: settlementLegEntries.findIndex(({ leg: l }) => l === leg),
      saleTotal,
      giftCardAmount: giftCardSettlementAmount,
      decimalPlaces,
      supportsOverpayment: option?.supports_overpayment === true,
    });
    const tendered = deriveCashTenderedAmount(
      leg.cashTendered ?? leg.amount,
      applied,
      true,
      decimalPlaces
    );
    return sum + Math.max(0, tendered - applied);
  }, 0);
  const legacyUnresolvedOverpaymentAmount = getUnresolvedOverpaymentAmount(
    changeAmount,
    cashChangeCapacity,
    canReturnChangeFromCash,
    moneyEpsilon
  );
  const amountAppliedToOrder = getAmountAppliedToOrder(saleTotal, totalSettledNowAmount);

  return {
    settlementLegEntries,
    realPaymentEntries,
    customerCreditEntries,
    payNowAmount,
    customerCreditAmount,
    settledNowAmount,
    cashLegAmount,
    cashTenderedAmount,
    totalSettledNowAmount,
    walletLegEntry,
    storedValueLegExceedance,
    walletLegExceedsLiveBalance,
    storedValueLegExceedsBalance,
    moneyEpsilon,
    remainingBalance,
    changeAmount,
    canReturnChangeFromCash,
    cashChangeAmount,
    cashChangeCapacity,
    legacyUnresolvedOverpaymentAmount,
    amountAppliedToOrder,
  };
}
