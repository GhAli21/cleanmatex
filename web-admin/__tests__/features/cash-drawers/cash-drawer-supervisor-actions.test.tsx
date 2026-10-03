import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const permissions = new Set<string>();
const fetchClosure = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/lib/hooks/usePermissions', () => ({ useHasPermissionCode: (code: string) => permissions.has(code) }));
jest.mock('@features/cash-drawers/api/cash-drawer-api', () => ({
  fetchSessionClosure: (...a: unknown[]) => fetchClosure(...a),
  fetchCashDrawerCatalogs: jest.fn().mockResolvedValue({ drawerTypes: [], dispositions: [] }),
  fetchCashDrawersWithCurrentSession: jest.fn().mockResolvedValue([]),
  fetchCurrencyDenominations: jest.fn().mockResolvedValue([]),
  recountCashDrawerClose: jest.fn(),
  forceCloseCashDrawerSession: jest.fn(),
}));
jest.mock('@lib/hooks/use-csrf-token', () => ({ useCSRFToken: () => ({ token: 'csrf' }) }));
jest.mock('@lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3, formatMoneyWithCode: (n: number, c?: string) => `${n.toFixed(3)} ${c ?? ''}`.trim() }),
}));
jest.mock('@ui/feedback', () => ({ cmxMessage: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() } }));
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`;
    t.has = () => false;
    return t;
  },
}));

import { CashDrawerSessionSupervisorActions } from '@features/cash-drawers/ui/cash-drawer-session-supervisor-actions';

function mount(status: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CashDrawerSessionSupervisorActions drawerId="d1" sessionId="s1" branchId="b1" status={status} currencyCode="OMR" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  permissions.clear();
  fetchClosure.mockReset();
  fetchClosure.mockResolvedValue({ sessionId: 's1', status: 'CLOSING', balances: [], counts: [], postClose: { statusCode: null, notes: null, by: null, at: null, history: [] } });
});

describe('CashDrawerSessionSupervisorActions', () => {
  it('renders nothing for a user with neither permission, and does not even load the closure', () => {
    const { container } = mount('CLOSING');
    expect(container).toBeEmptyDOMElement();
    expect(fetchClosure).not.toHaveBeenCalled();
  });

  it('offers Recount only on a CLOSING session, only with approve_variance', async () => {
    permissions.add('cash_drawer:approve_variance');
    mount('CLOSING');
    expect(await screen.findByRole('button', { name: 'billing.cashDrawers.recount.action' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'billing.cashDrawers.forceClose.action' })).toBeNull();
  });

  it('does not offer Recount once the session is OPEN or already closed', () => {
    permissions.add('cash_drawer:approve_variance');
    const { container } = mount('OPEN');
    expect(container).toBeEmptyDOMElement();
  });

  it('offers Force close on OPEN and CLOSING sessions with pos_session:force_close, never on a closed one', async () => {
    permissions.add('pos_session:force_close');
    const open = mount('OPEN');
    expect(await screen.findByRole('button', { name: 'billing.cashDrawers.forceClose.action' })).toBeInTheDocument();
    open.unmount();

    const closed = mount('CLOSED');
    expect(closed.container).toBeEmptyDOMElement();
  });
});
