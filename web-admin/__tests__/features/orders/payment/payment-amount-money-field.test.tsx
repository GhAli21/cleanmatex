import '@testing-library/jest-dom';
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { PaymentAmountMoneyField } from '@features/orders/payment/primitives/payment-amount-money-field';

const baseProps = {
  currencyCode: 'KWD',
  decimalPlaces: 3,
  formatAmount: (n: number) => n.toFixed(3),
  value: 10,
  onValueChange: jest.fn(),
  onKeypadPress: jest.fn(),
  amountAriaLabel: 'Amount',
  keypadTitle: 'Keypad',
  keypadDock: 'Dock',
  keypadClose: 'Close keypad',
  keypadHint: 'Hint',
  keypadRestored: 'Restored',
  showExact: true,
  exactLabel: 'Exact',
  onExact: jest.fn(),
  testId: 'pay-amount',
};

describe('PaymentAmountMoneyField keyboard session', () => {
  it('Tabs from amount to the keypad button', () => {
    render(<PaymentAmountMoneyField {...baseProps} />);
    const input = screen.getByTestId('pay-amount-input');
    const keypadBtn = screen.getByTestId('pay-amount-keypad-toggle');
    act(() => {
      input.focus();
    });
    expect(input).toHaveFocus();
    // DOM order: input then keypad button
    expect(keypadBtn.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('click / native activation on keypad button opens the pad and focuses home key 7', async () => {
    render(<PaymentAmountMoneyField {...baseProps} value={0} />);
    const keypadBtn = screen.getByTestId('pay-amount-keypad-toggle');
    keypadBtn.focus();
    // Prefer click — Enter on a <button> activates via the click path in browsers;
    // a custom keyDown handler previously risked open-then-close with click.
    fireEvent.click(keypadBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Keypad' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enter 7' })).toHaveFocus();
    });
  });

  it('keeps the pad open when focus returns to the amount field', async () => {
    render(<PaymentAmountMoneyField {...baseProps} value={0} />);
    fireEvent.click(screen.getByTestId('pay-amount-keypad-toggle'));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Keypad' })).toBeInTheDocument();
    });
    const input = screen.getByTestId('pay-amount-input');
    fireEvent.focusIn(input);
    expect(screen.getByRole('dialog', { name: 'Keypad' })).toBeInTheDocument();
  });

  it('dismisses the pad when focus moves to Exact', async () => {
    render(<PaymentAmountMoneyField {...baseProps} value={0} />);
    fireEvent.click(screen.getByTestId('pay-amount-keypad-toggle'));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Keypad' })).toBeInTheDocument();
    });
    fireEvent.focusIn(screen.getByTestId('pay-amount-exact'));
    expect(screen.queryByRole('dialog', { name: 'Keypad' })).not.toBeInTheDocument();
  });
});
