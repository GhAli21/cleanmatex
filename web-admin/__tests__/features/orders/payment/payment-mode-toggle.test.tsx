import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { PaymentModeToggle } from '@features/orders/ui/payment-modal/payment-mode-toggle';
import { PAYMENT_MODAL_MODE } from '@features/orders/ui/payment-modal-v4.utils';

describe('PaymentModeToggle', () => {
  it('keeps both faces inert while the payment surface is hydrating', () => {
    const onModeChange = jest.fn();
    render(
      <PaymentModeToggle
        mode={PAYMENT_MODAL_MODE.SIMPLE}
        onModeChange={onModeChange}
        simpleLabel="Simple"
        fullLabel="Advanced"
        groupLabel="Payment view"
        disabled
      />,
    );

    expect(screen.getByTestId('payment-mode-toggle')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByTestId('payment-mode-full'));
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
