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
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));

import {
  CashDrawerSelectDialog,
  type CashDrawerSessionChoice,
} from '@features/orders/payment/capabilities/cash-drawer/cash-drawer-select-dialog';
import type { CashDrawerOption } from '@features/orders/hooks/use-cash-drawer';

function choice(drawerId: string, sessionId: string, sessionNo: string): CashDrawerSessionChoice {
  const drawer: CashDrawerOption = {
    id: drawerId,
    branch_id: null,
    drawer_name: `Drawer ${drawerId}`,
    drawer_name2: null,
    drawer_type: 'REGISTER',
    currency_code: 'KWD',
    requires_session: true,
    opening_float_required: true,
    currentSession: null,
  };
  return {
    drawer,
    session: {
      id: sessionId,
      session_no: sessionNo,
      opened_at: '2026-07-09T08:00:00Z',
      opening_float_amount: 10,
    },
  };
}

function buildActions() {
  return {
    selectCashDrawerSession: jest.fn(),
    persistPreferredCashDrawerId: jest.fn(),
  };
}

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  choices: [choice('d1', 's1', 'S-001'), choice('d2', 's2', 'S-002')],
  getDrawerDisplayName: (drawer: CashDrawerOption) => drawer.drawer_name,
  formatOpenedAt: (openedAt: string | null) => openedAt ?? '—',
};

describe('CashDrawerSelectDialog', () => {
  it('renders one radio per open session with the ambiguity hint', () => {
    render(
      <CashDrawerSelectDialog
        {...baseProps}
        actions={buildActions()}
        selectedSessionId=""
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.getByText('newOrder.payment.cashDrawer.messages.selectionRequired'),
    ).toBeInTheDocument();
  });

  it('binds the chosen session and persists the drawer preference', () => {
    const actions = buildActions();
    render(
      <CashDrawerSelectDialog
        {...baseProps}
        actions={actions}
        selectedSessionId=""
      />,
    );
    fireEvent.click(screen.getByTestId('cash-drawer-choice-s2'));
    expect(actions.selectCashDrawerSession).toHaveBeenCalledWith('s2');
    expect(actions.persistPreferredCashDrawerId).toHaveBeenCalledWith('d2');
  });

  it('marks the bound session as checked and enables Done only when bound', () => {
    const { rerender } = render(
      <CashDrawerSelectDialog
        {...baseProps}
        actions={buildActions()}
        selectedSessionId=""
      />,
    );
    expect(screen.getByTestId('payment-capability-confirm')).toBeDisabled();

    rerender(
      <CashDrawerSelectDialog
        {...baseProps}
        actions={buildActions()}
        selectedSessionId="s1"
      />,
    );
    expect(screen.getByTestId('cash-drawer-choice-s1')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('cash-drawer-choice-s2')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByTestId('payment-capability-confirm')).toBeEnabled();
  });
});
