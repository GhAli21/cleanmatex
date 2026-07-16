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

import { GiftCardDialog } from '@features/orders/payment/capabilities/gift-card/gift-card-dialog';
import type { ValidateGiftCardResult } from '@/lib/types/payment';
import type {
  AppliedGiftCard,
  GiftCardDetails,
} from '@features/orders/hooks/use-gift-card-and-promo';

function buildActions() {
  return {
    fetchGiftCardDetails: jest.fn(),
    applyGiftCard: jest.fn(),
    clearGiftCard: jest.fn(),
    setGiftCardPin: jest.fn(),
    setGiftCardPinVisible: jest.fn(),
    setGiftCardPinError: jest.fn(),
  };
}

const details: GiftCardDetails = {
  number: 'GC-100',
  balance: 50,
  status: 'ACTIVE',
  id: 'gc-1',
};

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  giftCardNumber: '',
  onGiftCardNumberChange: jest.fn(),
  giftCardAmount: undefined,
  onGiftCardAmountChange: jest.fn(),
  giftCardValidating: false,
  giftCardResult: null as ValidateGiftCardResult | null,
  giftCardDetails: null as GiftCardDetails | null,
  appliedGiftCard: null as AppliedGiftCard | null,
  giftCardPin: '',
  pinRequired: false,
  pinVisible: false,
  pinFieldError: null as string | null,
  resolveGiftCardError: (result: ValidateGiftCardResult) =>
    result.errorCode ? `error.${result.errorCode}` : 'error.generic',
  remainingBalance: 42,
  moneyEpsilon: 0.0005,
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
  decimalPlaces: 3,
  pinInputRef: React.createRef<HTMLInputElement>(),
  giftCardAmountInputRef: React.createRef<HTMLInputElement>(),
};

describe('GiftCardDialog', () => {
  it('gates fetch on a number and fetches by button and Enter, uppercasing input', () => {
    const actions = buildActions();
    const onGiftCardNumberChange = jest.fn();
    const { rerender } = render(
      <GiftCardDialog {...baseProps} actions={actions} onGiftCardNumberChange={onGiftCardNumberChange} />,
    );

    // Empty number → fetch disabled; no workspace yet.
    expect(screen.getByTestId('gift-card-fetch')).toBeDisabled();
    expect(screen.queryByTestId('gift-card-workspace')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('gift-card-number-input'), {
      target: { value: 'gc-100' },
    });
    expect(onGiftCardNumberChange).toHaveBeenCalledWith('GC-100');

    // With a number present, fetch enables and both entrypoints call the action.
    rerender(
      <GiftCardDialog {...baseProps} actions={actions} giftCardNumber="GC-100" />,
    );
    const fetchBtn = screen.getByTestId('gift-card-fetch');
    expect(fetchBtn).toBeEnabled();
    fireEvent.click(fetchBtn);
    fireEvent.keyDown(screen.getByTestId('gift-card-number-input'), { key: 'Enter' });
    expect(actions.fetchGiftCardDetails).toHaveBeenCalledTimes(2);
  });

  it('shows the loading spinner and disables fetch while validating', () => {
    render(
      <GiftCardDialog
        {...baseProps}
        actions={buildActions()}
        giftCardNumber="GC-100"
        giftCardValidating
      />,
    );
    expect(screen.getByTestId('gift-card-fetch')).toBeDisabled();
    expect(screen.getByTestId('gift-card-fetch').querySelector('svg')).toBeInTheDocument();
  });

  it('renders a validation error via resolveGiftCardError', () => {
    render(
      <GiftCardDialog
        {...baseProps}
        actions={buildActions()}
        giftCardNumber="GC-100"
        giftCardResult={{ isValid: false, errorCode: 'NOT_FOUND' } as ValidateGiftCardResult}
      />,
    );
    expect(screen.getByTestId('gift-card-error')).toHaveTextContent('error.NOT_FOUND');
  });

  it('drives the PIN field: edit clears error, toggle flips visibility, fetch gated on PIN', () => {
    const actions = buildActions();
    render(
      <GiftCardDialog
        {...baseProps}
        actions={actions}
        giftCardNumber="GC-100"
        pinRequired
      />,
    );

    expect(screen.getByTestId('gift-card-workspace')).toBeInTheDocument();
    // PIN required but empty → fetch stays disabled.
    expect(screen.getByTestId('gift-card-fetch')).toBeDisabled();

    fireEvent.change(screen.getByTestId('gift-card-pin-input'), {
      target: { value: '1234' },
    });
    expect(actions.setGiftCardPin).toHaveBeenCalledWith('1234');
    expect(actions.setGiftCardPinError).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByTestId('gift-card-pin-toggle'));
    expect(actions.setGiftCardPinVisible).toHaveBeenCalledWith(true);
  });

  it('uses the shared amount field with keypad for apply amount', () => {
    render(
      <GiftCardDialog
        {...baseProps}
        actions={buildActions()}
        giftCardNumber="GC-100"
        giftCardDetails={details}
        giftCardAmount={0}
      />,
    );
    expect(screen.getByTestId('gift-card-amount-input')).toBeInTheDocument();
    expect(screen.getByTestId('gift-card-amount-keypad-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('gift-card-amount-exact')).toBeInTheDocument();
  });

  it('seeds keypad presses from giftCardAmount when the local draft is empty', async () => {
    const onGiftCardAmountChange = jest.fn();
    render(
      <GiftCardDialog
        {...baseProps}
        actions={buildActions()}
        giftCardNumber="GC-100"
        giftCardDetails={details}
        giftCardAmount={12}
        onGiftCardAmountChange={onGiftCardAmountChange}
      />,
    );

    fireEvent.click(screen.getByTestId('gift-card-amount-keypad-toggle'));
    // Empty local draft must seed from 12 before +10 → 22 (not 10).
    fireEvent.click(screen.getByRole('button', { name: 'Add 10' }));
    expect(onGiftCardAmountChange).toHaveBeenCalledWith(22);
  });

  it('applies an amount when positive and clears the card', () => {
    const actions = buildActions();
    const { rerender } = render(
      <GiftCardDialog
        {...baseProps}
        actions={actions}
        giftCardNumber="GC-100"
        giftCardDetails={details}
        giftCardAmount={0}
      />,
    );
    // Zero amount → apply disabled.
    expect(screen.getByTestId('gift-card-apply')).toBeDisabled();

    rerender(
      <GiftCardDialog
        {...baseProps}
        actions={actions}
        giftCardNumber="GC-100"
        giftCardDetails={details}
        giftCardAmount={25}
      />,
    );
    const applyBtn = screen.getByTestId('gift-card-apply');
    expect(applyBtn).toBeEnabled();
    fireEvent.click(applyBtn);
    expect(actions.applyGiftCard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('gift-card-clear'));
    expect(actions.clearGiftCard).toHaveBeenCalledTimes(1);
  });

  it('shows the applied summary with remove and hides the workspace once applied', () => {
    const actions = buildActions();
    render(
      <GiftCardDialog
        {...baseProps}
        actions={actions}
        giftCardNumber="GC-100"
        giftCardDetails={details}
        appliedGiftCard={{ number: 'GC-100', amount: 25, balance: 50, id: 'gc-1' }}
      />,
    );
    expect(screen.getByTestId('gift-card-applied')).toBeInTheDocument();
    expect(screen.queryByTestId('gift-card-workspace')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gift-card-clear'));
    expect(actions.clearGiftCard).toHaveBeenCalledTimes(1);
  });
});
