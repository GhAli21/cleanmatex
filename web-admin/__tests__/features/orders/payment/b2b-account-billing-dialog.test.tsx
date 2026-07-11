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

import { B2BAccountBillingDialog } from '@features/orders/payment/capabilities/b2b-account-billing/b2b-account-billing-dialog';

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  required: false,
  b2bContractId: undefined as string | undefined,
  onB2bContractIdChange: jest.fn(),
  contracts: [{ id: 'c-1', contractNo: 'CT-001' }],
  contractsLoading: false,
  costCenterCode: undefined as string | undefined,
  onCostCenterCodeChange: jest.fn(),
  poNumber: undefined as string | undefined,
  onPoNumberChange: jest.fn(),
  creditLimit: null as null | {
    creditLimit: number;
    currentBalance: number;
    available: number;
    wouldExceed: boolean;
  },
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
};

describe('B2BAccountBillingDialog', () => {
  it('shows the required badge only when the gate is required', () => {
    const { rerender } = render(<B2BAccountBillingDialog {...baseProps} required={false} />);
    expect(screen.queryByTestId('payment-capability-required-badge')).not.toBeInTheDocument();

    rerender(<B2BAccountBillingDialog {...baseProps} required />);
    expect(screen.getByTestId('payment-capability-required-badge')).toBeInTheDocument();
  });

  it('writes cost center and PO number through the setters', () => {
    const onCostCenterCodeChange = jest.fn();
    const onPoNumberChange = jest.fn();
    render(
      <B2BAccountBillingDialog
        {...baseProps}
        onCostCenterCodeChange={onCostCenterCodeChange}
        onPoNumberChange={onPoNumberChange}
      />,
    );
    fireEvent.change(screen.getByTestId('b2b-cost-center-input'), { target: { value: 'CC-9' } });
    expect(onCostCenterCodeChange).toHaveBeenCalledWith('CC-9');
    fireEvent.change(screen.getByTestId('b2b-po-number-input'), { target: { value: 'PO-42' } });
    expect(onPoNumberChange).toHaveBeenCalledWith('PO-42');
  });

  it('shows the selected contract number in the trigger', () => {
    render(<B2BAccountBillingDialog {...baseProps} b2bContractId="c-1" />);
    expect(screen.getByTestId('b2b-contract-trigger')).toHaveTextContent('CT-001');
  });

  it('renders the credit-limit status read-only with a hard-block note on exceedance', () => {
    render(
      <B2BAccountBillingDialog
        {...baseProps}
        creditLimit={{ creditLimit: 1000, currentBalance: 900, available: 100, wouldExceed: true }}
      />,
    );
    const card = screen.getByTestId('b2b-credit-limit');
    expect(card).toHaveAttribute('data-would-exceed', 'true');
    expect(screen.getByTestId('b2b-credit-exceeded')).toHaveTextContent(
      'newOrder.payment.b2b.creditExceeded',
    );
    // Phase 0B: the inert override affordance must not render.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('hides the credit-limit card when no limit applies', () => {
    const { rerender } = render(<B2BAccountBillingDialog {...baseProps} creditLimit={null} />);
    expect(screen.queryByTestId('b2b-credit-limit')).not.toBeInTheDocument();

    rerender(
      <B2BAccountBillingDialog
        {...baseProps}
        creditLimit={{ creditLimit: 0, currentBalance: 0, available: 0, wouldExceed: false }}
      />,
    );
    expect(screen.queryByTestId('b2b-credit-limit')).not.toBeInTheDocument();
  });
});
