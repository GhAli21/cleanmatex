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

import { OverpaymentRoutingDialog } from '@features/orders/payment/capabilities/overpayment-routing/overpayment-routing-dialog';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { logger } from '@/lib/utils/logger';

const baseProps = {
  open: true,
  excessAmount: 12.5,
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
  hasLinkedCustomer: true,
  selectedMode: OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE,
  onModeChange: jest.fn(),
  canReturnCashChange: true,
  confirmDisabled: false,
  isRTL: false,
};

function actions(confirmResult = true) {
  return {
    setExtraReceiptDialogOpen: jest.fn(),
    confirmExtraReceiptSelection: jest.fn().mockReturnValue(confirmResult),
  };
}

describe('OverpaymentRoutingDialog (wraps PaymentExtraReceiptDialog)', () => {
  beforeEach(() => {
    (logger.info as jest.Mock).mockClear();
  });

  it('renders the wrapped dialog and logs the open event once with safe metadata', () => {
    render(<OverpaymentRoutingDialog {...baseProps} actions={actions()} />);
    expect(screen.getByRole('button', { name: 'common.confirm' })).toBeInTheDocument();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      '[payment] capability dialog opened',
      expect.objectContaining({ capability: 'OVERPAYMENT_ROUTING' }),
    );
  });

  it('confirms through the facade action and does not flag failure on success', () => {
    const act = actions(true);
    const onConfirmFailed = jest.fn();
    render(<OverpaymentRoutingDialog {...baseProps} actions={act} onConfirmFailed={onConfirmFailed} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));
    expect(act.confirmExtraReceiptSelection).toHaveBeenCalledTimes(1);
    expect(onConfirmFailed).not.toHaveBeenCalled();
  });

  it('flags failure when the confirm action reports nothing resolved', () => {
    const act = actions(false);
    const onConfirmFailed = jest.fn();
    render(<OverpaymentRoutingDialog {...baseProps} actions={act} onConfirmFailed={onConfirmFailed} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));
    expect(onConfirmFailed).toHaveBeenCalledTimes(1);
  });

  it('routes Back through setExtraReceiptDialogOpen(false)', () => {
    const act = actions();
    render(<OverpaymentRoutingDialog {...baseProps} actions={act} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }));
    expect(act.setExtraReceiptDialogOpen).toHaveBeenCalledWith(false);
  });

  it('renders nothing when closed', () => {
    render(<OverpaymentRoutingDialog {...baseProps} open={false} actions={actions()} />);
    expect(screen.queryByRole('button', { name: 'common.confirm' })).not.toBeInTheDocument();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
