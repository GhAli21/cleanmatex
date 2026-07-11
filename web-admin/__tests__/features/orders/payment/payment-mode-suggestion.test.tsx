import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Prevent jest from loading tenant-currency-context (next-intl ESM) via the
// @ui/primitives barrel — same workaround as payment-primitives.test.tsx.
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { PaymentModeSuggestion } from '@features/orders/payment/primitives/payment-mode-suggestion';

function renderSuggestion(overrides: Partial<React.ComponentProps<typeof PaymentModeSuggestion>> = {}) {
  const onAccept = jest.fn();
  const onDismiss = jest.fn();
  render(
    <PaymentModeSuggestion
      title="Advanced options may help"
      reasons={['split payment in use', 'gift card applied']}
      actionLabel="Switch to Advanced"
      dismissLabel="Dismiss suggestion"
      onAccept={onAccept}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onAccept, onDismiss };
}

describe('PaymentModeSuggestion', () => {
  it('announces politely and shows the title + reasons', () => {
    renderSuggestion();
    const el = screen.getByTestId('payment-mode-suggestion');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveTextContent('Advanced options may help');
    expect(el).toHaveTextContent('split payment in use · gift card applied');
  });

  it('fires onAccept when the switch action is clicked', () => {
    const { onAccept } = renderSuggestion();
    fireEvent.click(screen.getByTestId('payment-mode-suggestion-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when the dismiss control is clicked', () => {
    const { onDismiss } = renderSuggestion();
    fireEvent.click(screen.getByTestId('payment-mode-suggestion-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible dismiss label', () => {
    renderSuggestion();
    expect(screen.getByLabelText('Dismiss suggestion')).toBeInTheDocument();
  });

  it('renders the title alone when there are no reasons', () => {
    renderSuggestion({ reasons: [] });
    expect(screen.getByTestId('payment-mode-suggestion')).toHaveTextContent('Advanced options may help');
  });
});
