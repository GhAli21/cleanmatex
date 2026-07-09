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

import { PromoCodeDialog } from '@features/orders/payment/capabilities/promo-code/promo-code-dialog';
import type { ValidatePromoCodeResult } from '@/lib/types/payment';
import type { AppliedPromoCode } from '@features/orders/hooks/use-gift-card-and-promo';

function buildActions() {
  return {
    validatePromoCode: jest.fn(),
    clearPromoCode: jest.fn(),
    clearPromoCodeError: jest.fn(),
  };
}

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  promoCode: '',
  onPromoCodeChange: jest.fn(),
  promoCodeValidating: false,
  promoCodeResult: null as ValidatePromoCodeResult | null,
  appliedPromoCode: null as AppliedPromoCode | null,
  promoErrorMessage: null as string | null,
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
};

describe('PromoCodeDialog', () => {
  it('gates apply on a code and validates by button and Enter, uppercasing input', () => {
    const actions = buildActions();
    const onPromoCodeChange = jest.fn();
    const { rerender } = render(
      <PromoCodeDialog {...baseProps} actions={actions} onPromoCodeChange={onPromoCodeChange} />,
    );

    expect(screen.getByTestId('promo-code-apply')).toBeDisabled();

    fireEvent.change(screen.getByTestId('promo-code-input'), {
      target: { value: 'save10' },
    });
    expect(onPromoCodeChange).toHaveBeenCalledWith('SAVE10');
    // No stale invalid result → error not cleared on edit.
    expect(actions.clearPromoCodeError).not.toHaveBeenCalled();

    rerender(<PromoCodeDialog {...baseProps} actions={actions} promoCode="SAVE10" />);
    const applyBtn = screen.getByTestId('promo-code-apply');
    expect(applyBtn).toBeEnabled();
    fireEvent.click(applyBtn);
    fireEvent.keyDown(screen.getByTestId('promo-code-input'), { key: 'Enter' });
    expect(actions.validatePromoCode).toHaveBeenCalledTimes(2);
  });

  it('clears a stale invalid result when the code is edited', () => {
    const actions = buildActions();
    render(
      <PromoCodeDialog
        {...baseProps}
        actions={actions}
        promoCode="BADCODE"
        promoCodeResult={{ isValid: false, errorCode: 'NOT_FOUND' } as ValidatePromoCodeResult}
      />,
    );
    fireEvent.change(screen.getByTestId('promo-code-input'), {
      target: { value: 'BADCOD' },
    });
    expect(actions.clearPromoCodeError).toHaveBeenCalledTimes(1);
  });

  it('shows the loading spinner and disables apply while validating', () => {
    render(
      <PromoCodeDialog
        {...baseProps}
        actions={buildActions()}
        promoCode="SAVE10"
        promoCodeValidating
      />,
    );
    expect(screen.getByTestId('promo-code-apply')).toBeDisabled();
    expect(screen.getByTestId('promo-code-apply').querySelector('svg')).toBeInTheDocument();
  });

  it('renders the precomputed error line', () => {
    render(
      <PromoCodeDialog
        {...baseProps}
        actions={buildActions()}
        promoCode="SAVE10"
        promoErrorMessage="Order total must be at least KWD 10.000"
      />,
    );
    expect(screen.getByTestId('promo-code-error')).toHaveTextContent(
      'Order total must be at least KWD 10.000',
    );
  });

  it('shows the applied summary with remove and hides the input', () => {
    const actions = buildActions();
    render(
      <PromoCodeDialog
        {...baseProps}
        actions={actions}
        appliedPromoCode={{ code: 'SAVE10', id: 'promo-1', discount: 5 }}
      />,
    );
    expect(screen.getByTestId('promo-code-applied')).toBeInTheDocument();
    expect(screen.queryByTestId('promo-code-input')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('promo-code-remove'));
    expect(actions.clearPromoCode).toHaveBeenCalledTimes(1);
  });
});
