import '@testing-library/jest-dom';
import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { id?: string }) =>
    values?.id ? `${key}:${values.id}` : key,
}));

import { PaymentModalV4CreditNotePicker } from '@features/orders/ui/payment-modal-v4-credit-note-picker';

describe('PaymentModalV4CreditNotePicker focus', () => {
  it('moves keyboard focus into the picker when it opens', async () => {
    render(
      <PaymentModalV4CreditNotePicker
        open
        onClose={jest.fn()}
        onSelect={jest.fn()}
        isRTL={false}
        notes={[
          {
            id: '73d5def2-aaaa-bbbb-cccc-ddddeeee0001',
            remaining_balance: 4.2,
            currency_code: 'OMR',
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('credit-note-picker-first-option')).toHaveFocus();
    });
  });

  it('does not keep focusing a background control after open', async () => {
    const background = document.createElement('input');
    document.body.appendChild(background);
    act(() => {
      background.focus();
    });
    expect(background).toHaveFocus();

    render(
      <PaymentModalV4CreditNotePicker
        open
        onClose={jest.fn()}
        onSelect={jest.fn()}
        isRTL={false}
        notes={[
          {
            id: 'note-1',
            remaining_balance: 1,
            currency_code: 'OMR',
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('credit-note-picker-first-option')).toHaveFocus();
    });
    expect(background).not.toHaveFocus();
    background.remove();
  });
});
