import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    return t;
  },
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));

import { SplitTenderDialog } from '@features/orders/payment/capabilities/split-tender/split-tender-dialog';
import type { CheckoutSettlementOption } from '@features/orders/hooks/use-payment-catalog';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

function option(code: string): CheckoutSettlementOption {
  return {
    id: `opt-${code}`,
    payment_method_code: code,
    payment_nature: 'REAL_PAYMENT',
    gateway_code: null,
    display_name: code,
    display_name2: null,
    description: null,
    description2: null,
    requires_cash_drawer: code === 'CASH',
    requires_terminal: false,
    supports_overpayment: code === 'CASH',
    supports_change_return: code === 'CASH',
    requires_reference: false,
    allowed_in_pos: true,
  };
}

function leg(method: string, amount: number): PaymentLeg {
  return { method, amount, legRef: `ref-${method}-${amount}` } as PaymentLeg;
}

function buildActions() {
  return {
    updateLeg: jest.fn(),
    addLeg: jest.fn(),
    removeLegAt: jest.fn(),
    setActiveLegIndex: jest.fn(),
  };
}

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  activeLegIndex: 0,
  methodOptions: [option('CASH'), option('CARD')],
  getOptionDisplayName: (
    opt: CheckoutSettlementOption | null | undefined,
    fallback: string,
  ) => opt?.display_name ?? fallback,
  amountDue: 42.5,
  moneyEpsilon: 0.0005,
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
  decimalPlaces: 3,
  branchPaymentTerminals: [],
  cardBrands: [],
  creditMethodCodes: [],
};

describe('SplitTenderDialog', () => {
  it('renders one row per leg and a fully-allocated balance state', () => {
    render(
      <SplitTenderDialog
        {...baseProps}
        actions={buildActions()}
        paymentLegs={[leg('CASH', 20), leg('CARD', 22.5)]}
        legsTotal={42.5}
        remainingBalance={0}
      />,
    );

    const list = screen.getByTestId('split-tender-leg-list');
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId('split-tender-balance')).toHaveAttribute(
      'data-balance-state',
      'allocated',
    );
  });

  it('shows a CASH leg over-tender as change (tendered − applied)', () => {
    const cashLeg = {
      method: 'CASH',
      amount: 10.786,
      cashTendered: 50,
      legRef: 'ref-cash',
    } as PaymentLeg;
    render(
      <SplitTenderDialog
        {...baseProps}
        actions={buildActions()}
        paymentLegs={[cashLeg]}
        amountDue={10.786}
        legsTotal={10.786}
        remainingBalance={0}
      />,
    );
    // Change = max(0, 50 − 10.786) = 39.214, shown in the cash breakdown.
    expect(screen.getByTestId('leg-cash-change')).toHaveTextContent('39.214');
  });

  it('flags outstanding remainder as the balance state', () => {
    render(
      <SplitTenderDialog
        {...baseProps}
        actions={buildActions()}
        paymentLegs={[leg('CASH', 20)]}
        legsTotal={20}
        remainingBalance={22.5}
      />,
    );
    expect(screen.getByTestId('split-tender-balance')).toHaveAttribute(
      'data-balance-state',
      'outstanding',
    );
  });

  it('disables remove for a single leg; removes by index with two legs', () => {
    const actions = buildActions();
    const { rerender } = render(
      <SplitTenderDialog
        {...baseProps}
        actions={actions}
        paymentLegs={[leg('CASH', 42.5)]}
        legsTotal={42.5}
        remainingBalance={0}
      />,
    );
    expect(screen.getByTestId('split-tender-remove-0')).toBeDisabled();

    rerender(
      <SplitTenderDialog
        {...baseProps}
        actions={actions}
        paymentLegs={[leg('CASH', 20), leg('CARD', 22.5)]}
        legsTotal={42.5}
        remainingBalance={0}
      />,
    );
    fireEvent.click(screen.getByTestId('split-tender-remove-1'));
    expect(actions.removeLegAt).toHaveBeenCalledWith(1);
  });

  it('renders over-allocation as the over state', () => {
    render(
      <SplitTenderDialog
        {...baseProps}
        actions={buildActions()}
        paymentLegs={[leg('CASH', 50)]}
        legsTotal={50}
        remainingBalance={-7.5}
      />,
    );
    expect(screen.getByTestId('split-tender-balance')).toHaveAttribute(
      'data-balance-state',
      'over',
    );
  });
});
