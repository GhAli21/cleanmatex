import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Prevent jest from loading tenant-currency-context (which imports next-intl
// ESM) via the @ui/primitives barrel → cmx-money-field-controller. Same
// workaround as __tests__/ui/cmx-keypad.test.tsx.
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { logger } from '@/lib/utils/logger';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';
import { PAYMENT_REASON } from '@features/orders/payment/domain/payment-reasons';
import { PaymentSubmitGuard } from '@features/orders/payment/primitives/payment-submit-guard';
import { PaymentDialogErrorBoundary } from '@features/orders/payment/primitives/payment-dialog-error-boundary';
import { PaymentCapabilityDialog } from '@features/orders/payment/primitives/payment-capability-dialog';

describe('PaymentSubmitGuard', () => {
  it('renders the message with the reason code as a data attribute (explainability)', () => {
    render(
      <PaymentSubmitGuard
        reason={PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED}
        message="Cash drawer is closed for reconciliation."
      />,
    );
    const guard = screen.getByTestId('payment-submit-guard');
    expect(guard).toHaveAttribute('data-reason', 'CASH_DRAWER_SESSION_CLOSED');
    expect(guard).toHaveTextContent('Cash drawer is closed for reconciliation.');
    expect(guard).toHaveAttribute('aria-live', 'polite');
  });

  it('fires the corrective action', () => {
    const onAction = jest.fn();
    render(
      <PaymentSubmitGuard
        reason={PAYMENT_REASON.CASH_DRAWER_SESSION_REQUIRED}
        message="Open a drawer session to take cash."
        actionLabel="Open drawer"
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentDialogErrorBoundary', () => {
  function Bomb(): React.ReactElement {
    throw new Error('boom');
  }

  it('renders a recoverable fallback and logs safe metadata only', () => {
    // Silence React's console noise for the intentional throw.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = jest.fn();
    render(
      <PaymentDialogErrorBoundary
        capabilityKey={PAYMENT_CAPABILITY.GIFT_CARD}
        fallbackMessage="Something went wrong in this dialog."
        closeLabel="Close"
        onClose={onClose}
      >
        <Bomb />
      </PaymentDialogErrorBoundary>,
    );

    expect(screen.getByTestId('payment-dialog-error-fallback')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // React dev mode may re-run the throwing render, so pin the content of
    // the log rather than an exact call count.
    expect(logger.error).toHaveBeenCalled();
    const [message, , context] = (logger.error as jest.Mock).mock.calls[0];
    expect(message).toContain('capability dialog crashed');
    expect(context).toMatchObject({
      feature: 'payment-modal',
      capability: PAYMENT_CAPABILITY.GIFT_CARD,
    });
    // Safe-metadata rule: nothing sensitive in the log context values.
    expect(JSON.stringify(context)).not.toMatch(/pin|cardNumber|reference|payload/i);
    consoleError.mockRestore();
  });
});

describe('PaymentCapabilityDialog', () => {
  const baseProps = {
    capabilityKey: PAYMENT_CAPABILITY.SPLIT_TENDER,
    open: true,
    onOpenChange: jest.fn(),
    title: 'Split payment',
    errorFallbackMessage: 'Dialog failed.',
    errorCloseLabel: 'Close',
  };

  it('renders title, body, and confirm/cancel actions', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <PaymentCapabilityDialog
        {...baseProps}
        cancelLabel="Cancel"
        onCancel={onCancel}
        confirmLabel="Apply"
        onConfirm={onConfirm}
      >
        <p>legs editor body</p>
      </PaymentCapabilityDialog>,
    );

    expect(
      screen.getByTestId('payment-capability-dialog-SPLIT_TENDER'),
    ).toBeInTheDocument();
    expect(screen.getByText('Split payment')).toBeInTheDocument();
    expect(screen.getByText('legs editor body')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('payment-capability-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the required badge only for required gates', () => {
    const { rerender } = render(
      <PaymentCapabilityDialog {...baseProps} required requiredLabel="Required">
        <p>body</p>
      </PaymentCapabilityDialog>,
    );
    expect(screen.getByTestId('payment-capability-required-badge')).toHaveTextContent(
      'Required',
    );

    rerender(
      <PaymentCapabilityDialog {...baseProps} required={false}>
        <p>body</p>
      </PaymentCapabilityDialog>,
    );
    expect(
      screen.queryByTestId('payment-capability-required-badge'),
    ).not.toBeInTheDocument();
  });

  it('disables confirm when confirmDisabled', () => {
    render(
      <PaymentCapabilityDialog
        {...baseProps}
        confirmLabel="Apply"
        onConfirm={jest.fn()}
        confirmDisabled
      >
        <p>body</p>
      </PaymentCapabilityDialog>,
    );
    expect(screen.getByTestId('payment-capability-confirm')).toBeDisabled();
  });

  it('logs the open event once with safe metadata only (no reopen spam)', () => {
    (logger.info as jest.Mock).mockClear();
    const { rerender } = render(
      <PaymentCapabilityDialog {...baseProps} open={false}>
        <p>body</p>
      </PaymentCapabilityDialog>,
    );
    expect(logger.info).not.toHaveBeenCalled();

    rerender(
      <PaymentCapabilityDialog {...baseProps} open>
        <p>body</p>
      </PaymentCapabilityDialog>,
    );
    rerender(
      <PaymentCapabilityDialog {...baseProps} open>
        <p>body</p>
      </PaymentCapabilityDialog>,
    );
    expect(logger.info).toHaveBeenCalledTimes(1);
    const [, context] = (logger.info as jest.Mock).mock.calls[0];
    expect(context).toMatchObject({
      action: 'capability-dialog-open',
      capability: PAYMENT_CAPABILITY.SPLIT_TENDER,
    });
  });
});
