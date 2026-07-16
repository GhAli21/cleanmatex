import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { PaymentCapabilityDialog } from '@features/orders/payment/primitives/payment-capability-dialog';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';

describe('PaymentCapabilityDialog focus on open', () => {
  it('moves focus into the dialog, preferring data-capability-initial-focus', async () => {
    const background = document.createElement('button');
    background.textContent = 'background-opener';
    document.body.appendChild(background);
    background.focus();
    expect(background).toHaveFocus();

    render(
      <PaymentCapabilityDialog
        capabilityKey={PAYMENT_CAPABILITY.SPLIT_TENDER}
        open
        onOpenChange={jest.fn()}
        title="Split payment"
        errorFallbackMessage="error"
        errorCloseLabel="close"
        confirmLabel="Done"
        onConfirm={jest.fn()}
      >
        <button type="button">other</button>
        <button type="button" data-capability-initial-focus="true" data-testid="preferred">
          Add payment method
        </button>
      </PaymentCapabilityDialog>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('preferred')).toHaveFocus();
    });
    expect(background).not.toHaveFocus();
    background.remove();
  });
});
