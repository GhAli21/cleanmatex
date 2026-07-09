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
    const t = (key: string, params?: Record<string, string | number>) =>
      params ? `${namespace}.${key}:${JSON.stringify(params)}` : `${namespace}.${key}`;
    return t;
  },
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));

import { CustomerCreditDialog } from '@features/orders/payment/capabilities/customer-credit/customer-credit-dialog';
import type { CheckoutSettlementOption } from '@features/orders/hooks/use-payment-catalog';
import type { StoredValueSummaryResponse } from '@features/orders/hooks/use-payment-engine';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

function option(
  code: string,
  extra: Partial<CheckoutSettlementOption> = {},
): CheckoutSettlementOption {
  return {
    id: `opt-${code}`,
    payment_method_code: code,
    payment_nature: 'CUSTOMER_CREDIT',
    gateway_code: null,
    display_name: code,
    display_name2: null,
    description: null,
    description2: null,
    requires_cash_drawer: false,
    requires_terminal: false,
    supports_overpayment: false,
    supports_change_return: false,
    requires_reference: false,
    allowed_in_pos: true,
    ...extra,
  };
}

function leg(method: string): PaymentLeg {
  return { method, amount: 10, legRef: `ref-${method}` } as PaymentLeg;
}

const summaryWithNote = {
  wallet: { balance: 30, currencyCode: 'KWD' },
  advance: { balance: 0 },
  creditNotes: [{ id: 'cn-1', remaining_balance: 20 }],
} as unknown as StoredValueSummaryResponse;

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  paymentLegs: [] as PaymentLeg[],
  getOptionDisplayName: (
    opt: CheckoutSettlementOption | null | undefined,
    fallback: string,
  ) => opt?.display_name ?? fallback,
  storedValueSummary: summaryWithNote,
  storedValueLoading: false,
  storedValueFetching: false,
  refetchStoredValueSummary: jest.fn(),
  walletBalanceLoaded: true,
  walletHasAvailableBalance: true,
  liveWalletBalanceDisplay: 'KWD 30.000',
  walletLegExceedsLiveBalance: false,
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
};

describe('CustomerCreditDialog', () => {
  it('renders the empty state when no instruments are offered', () => {
    render(<CustomerCreditDialog {...baseProps} actions={{ selectCustomerCredit: jest.fn() }} creditOptions={[]} />);
    expect(screen.getByTestId('customer-credit-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-credit-list')).not.toBeInTheDocument();
  });

  it('selects a wallet instrument through the typed action', () => {
    const actions = { selectCustomerCredit: jest.fn() };
    const wallet = option('WALLET', { credit_application_type: 'WALLET', available_balance: 30 });
    render(<CustomerCreditDialog {...baseProps} actions={actions} creditOptions={[wallet]} />);

    const btn = screen.getByTestId('payment-credit-method-wallet');
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(actions.selectCustomerCredit).toHaveBeenCalledWith(wallet);
  });

  it('disables the wallet card and shows no-balance copy when the wallet is empty', () => {
    const wallet = option('WALLET', { credit_application_type: 'WALLET' });
    render(
      <CustomerCreditDialog
        {...baseProps}
        actions={{ selectCustomerCredit: jest.fn() }}
        creditOptions={[wallet]}
        walletHasAvailableBalance={false}
      />,
    );
    expect(screen.getByTestId('payment-credit-method-wallet')).toBeDisabled();
    expect(screen.getByTestId('payment-credit-method-wallet')).toHaveTextContent(
      'newOrder.payment.customerCredits.noWalletBalance',
    );
  });

  it('gates the credit-note card on availability', () => {
    const note = option('CREDIT_NOTE');
    const { rerender } = render(
      <CustomerCreditDialog {...baseProps} actions={{ selectCustomerCredit: jest.fn() }} creditOptions={[note]} />,
    );
    // Notes available in summary → enabled with the select hint.
    expect(screen.getByTestId('payment-credit-method-credit_note')).toBeEnabled();

    rerender(
      <CustomerCreditDialog
        {...baseProps}
        actions={{ selectCustomerCredit: jest.fn() }}
        creditOptions={[note]}
        storedValueSummary={{ ...summaryWithNote, creditNotes: [] } as unknown as StoredValueSummaryResponse}
      />,
    );
    expect(screen.getByTestId('payment-credit-method-credit_note')).toBeDisabled();
  });

  it('refreshes the live balance and disables the control while fetching', () => {
    const refetch = jest.fn();
    const wallet = option('WALLET', { credit_application_type: 'WALLET', available_balance: 30 });
    const { rerender } = render(
      <CustomerCreditDialog
        {...baseProps}
        actions={{ selectCustomerCredit: jest.fn() }}
        creditOptions={[wallet]}
        refetchStoredValueSummary={refetch}
      />,
    );
    fireEvent.click(screen.getByTestId('customer-credit-refresh'));
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender(
      <CustomerCreditDialog
        {...baseProps}
        actions={{ selectCustomerCredit: jest.fn() }}
        creditOptions={[wallet]}
        refetchStoredValueSummary={refetch}
        storedValueFetching
      />,
    );
    expect(screen.getByTestId('customer-credit-refresh')).toBeDisabled();
  });

  it('surfaces the wallet exceedance warning when the applied leg exceeds the live balance', () => {
    const wallet = option('WALLET', { credit_application_type: 'WALLET', available_balance: 30 });
    render(
      <CustomerCreditDialog
        {...baseProps}
        actions={{ selectCustomerCredit: jest.fn() }}
        creditOptions={[wallet]}
        paymentLegs={[leg('WALLET')]}
        walletLegExceedsLiveBalance
      />,
    );
    expect(screen.getByTestId('payment-credit-method-wallet')).toHaveTextContent(
      'newOrder.payment.customerCredits.walletBalanceExceeded',
    );
  });
});
