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

import { PayLaterDialog } from '@features/orders/payment/capabilities/pay-later/pay-later-dialog';
import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  selectedPolicy: 'NONE' as OutstandingPolicy,
};

describe('PayLaterDialog', () => {
  it('renders the three balance-policy options', () => {
    render(<PayLaterDialog {...baseProps} actions={{ changeOutstandingPolicy: jest.fn() }} />);
    const list = screen.getByTestId('pay-later-option-list');
    expect(list.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(screen.getByTestId('pay-later-option-NONE')).toBeInTheDocument();
    expect(screen.getByTestId('pay-later-option-PAY_ON_COLLECTION')).toBeInTheDocument();
    expect(screen.getByTestId('pay-later-option-CREDIT_INVOICE')).toBeInTheDocument();
  });

  it('marks the effective policy as checked', () => {
    render(
      <PayLaterDialog
        {...baseProps}
        actions={{ changeOutstandingPolicy: jest.fn() }}
        selectedPolicy={'CREDIT_INVOICE' as OutstandingPolicy}
      />,
    );
    expect(screen.getByTestId('pay-later-option-CREDIT_INVOICE')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('pay-later-option-NONE')).toHaveAttribute('aria-checked', 'false');
  });

  it('changes the policy through the typed action', () => {
    const actions = { changeOutstandingPolicy: jest.fn() };
    render(<PayLaterDialog {...baseProps} actions={actions} />);
    fireEvent.click(screen.getByTestId('pay-later-option-PAY_ON_COLLECTION'));
    expect(actions.changeOutstandingPolicy).toHaveBeenCalledWith('PAY_ON_COLLECTION');
  });

  it('closes on Done', () => {
    const onOpenChange = jest.fn();
    render(
      <PayLaterDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        actions={{ changeOutstandingPolicy: jest.fn() }}
      />,
    );
    fireEvent.click(screen.getByTestId('payment-capability-confirm'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
