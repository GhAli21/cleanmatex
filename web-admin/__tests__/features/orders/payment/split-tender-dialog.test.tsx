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

function option(code: string, gatewayCode: string | null = null): CheckoutSettlementOption {
  return {
    id: `opt-${code}-${gatewayCode ?? 'none'}`,
    payment_method_code: code,
    payment_nature: 'REAL_PAYMENT',
    gateway_code: gatewayCode,
    display_name: gatewayCode ? `${code} (${gatewayCode})` : code,
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

function leg(method: string, amount: number, gatewayCode?: string): PaymentLeg {
  return {
    method,
    amount,
    legRef: `ref-${method}-${amount}`,
    ...(gatewayCode ? { gateway_code: gatewayCode } : {}),
  } as PaymentLeg;
}

function buildActions() {
  return {
    updateLeg: jest.fn(),
    addLeg: jest.fn(),
    removeLegAt: jest.fn(),
    setActiveLegIndex: jest.fn(),
    fillLegRemaining: jest.fn(),
  };
}

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  activeLegIndex: 0,
  activeAmountDraft: '',
  onSplitAmountChange: jest.fn(),
  onKeypadPress: jest.fn(),
  activeLegRemainingCap: 10,
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

    expect(screen.getByTestId('split-tender-editable-list').querySelectorAll('li')).toHaveLength(2);
    expect(screen.queryByTestId('split-tender-readonly-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('split-tender-balance')).toHaveAttribute(
      'data-balance-state',
      'allocated',
    );
  });

  it('lists editable real-payment legs first and credit legs as read-only below', () => {
    render(
      <SplitTenderDialog
        {...baseProps}
        actions={buildActions()}
        creditMethodCodes={['WALLET', 'ADVANCE', 'CREDIT_NOTE']}
        paymentLegs={[
          leg('WALLET', 1),
          leg('CARD', 10),
          leg('ADVANCE', 1.5),
          leg('CASH', 5),
        ]}
        legsTotal={17.5}
        remainingBalance={25}
      />,
    );

    const editable = screen.getByTestId('split-tender-editable-list');
    const readonly = screen.getByTestId('split-tender-readonly-list');
    expect(editable.querySelectorAll('li')).toHaveLength(2);
    expect(readonly.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId('split-tender-editable-leg-1')).toBeInTheDocument(); // CARD
    expect(screen.getByTestId('split-tender-editable-leg-3')).toBeInTheDocument(); // CASH
    expect(screen.getByTestId('split-tender-readonly-leg-0')).toBeInTheDocument(); // WALLET
    expect(screen.getByTestId('split-tender-readonly-leg-2')).toBeInTheDocument(); // ADVANCE
    expect(screen.getByTestId('split-tender-readonly-section')).toHaveTextContent(
      'newOrder.payment.splitPayment.appliedCreditsSection',
    );
    // Read-only rows do not host the amount editor / keypad.
    expect(screen.queryByTestId('split-tender-amount-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('split-tender-amount-1')).toBeInTheDocument();
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

  it('allows removing the last leg (clear all) and removes by index with two legs', () => {
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
    expect(screen.getByTestId('split-tender-remove-0')).toBeEnabled();
    fireEvent.click(screen.getByTestId('split-tender-remove-0'));
    expect(actions.removeLegAt).toHaveBeenCalledWith(0);

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

  it('renders over-allocation as the over state even though the engine floors remainingBalance at 0', () => {
    // Real engine contract: remainingBalance = max(0, due − settled) — it is
    // NEVER negative. Over-allocation must be detected from legsTotal vs
    // amountDue (QA round 4: a CARD leg overpaying previously showed
    // "Fully Allocated").
    render(
      <SplitTenderDialog
        {...baseProps}
        actions={buildActions()}
        paymentLegs={[leg('CARD', 50)]}
        legsTotal={50}
        remainingBalance={0}
      />,
    );
    const balance = screen.getByTestId('split-tender-balance');
    expect(balance).toHaveAttribute('data-balance-state', 'over');
    // Shows the over-allocated amount (50 − 42.5).
    expect(balance.textContent).toContain('7.500');
  });

  it('binds method selects to method::gateway composite keys', () => {
    const stripe = option('STRIPE', 'STRIPE');
    const hyperpay = option('STRIPE', 'HYPERPAY');
    render(
      <SplitTenderDialog
        {...baseProps}
        methodOptions={[option('CASH'), stripe, hyperpay]}
        actions={buildActions()}
        paymentLegs={[leg('STRIPE', 5, 'STRIPE')]}
        legsTotal={5}
        remainingBalance={37.5}
      />,
    );
    // Composite value on the trigger (method-only would be bare "STRIPE").
    expect(screen.getByTestId('split-tender-method-0')).toHaveTextContent(
      'STRIPE::STRIPE',
    );
  });

  it('blocks Done / dismiss while a leg is missing a required bank reference', () => {
    const onOpenChange = jest.fn();
    const bank = {
      ...option('BANK_TRANSFER'),
      requires_reference: true,
    };
    const bankLeg = {
      method: 'BANK_TRANSFER',
      amount: 1,
      legRef: 'ref-bank',
      bank_reference: undefined,
    } as PaymentLeg;

    render(
      <SplitTenderDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        methodOptions={[option('CASH'), bank]}
        actions={buildActions()}
        paymentLegs={[bankLeg]}
        legsTotal={1}
        remainingBalance={41.5}
      />,
    );

    const done = screen.getByTestId('payment-capability-confirm');
    expect(done).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(done);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows Done after the required bank reference is provided', () => {
    const onOpenChange = jest.fn();
    const bank = {
      ...option('BANK_TRANSFER'),
      requires_reference: true,
    };
    const bankLeg = {
      method: 'BANK_TRANSFER',
      amount: 1,
      legRef: 'ref-bank',
      bank_reference: 'TXN-99',
    } as PaymentLeg;

    render(
      <SplitTenderDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        methodOptions={[option('CASH'), bank]}
        actions={buildActions()}
        paymentLegs={[bankLeg]}
        legsTotal={1}
        remainingBalance={41.5}
      />,
    );

    const done = screen.getByTestId('payment-capability-confirm');
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies method + gateway_code on method change', () => {
    const actions = buildActions();
    const stripe = option('STRIPE', 'STRIPE');
    const cash = option('CASH');
    render(
      <SplitTenderDialog
        {...baseProps}
        methodOptions={[cash, stripe]}
        actions={actions}
        paymentLegs={[leg('STRIPE', 5, 'STRIPE')]}
        legsTotal={5}
        remainingBalance={37.5}
      />,
    );

    actions.updateLeg.mockClear();
    actions.setActiveLegIndex.mockClear();

    fireEvent.click(screen.getByTestId('split-tender-method-0'));
    fireEvent.click(screen.getByText('CASH'));

    expect(actions.setActiveLegIndex).toHaveBeenCalledWith(0);
    expect(actions.updateLeg).toHaveBeenCalledWith(0, 'method', 'CASH');
    expect(actions.updateLeg).toHaveBeenCalledWith(0, 'gateway_code', undefined);
  });
});
