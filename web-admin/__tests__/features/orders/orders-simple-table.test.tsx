/**
 * PR-04 Task 4: orders list paging through CmxPagination (no page-size selector, ruling 10)
 * and readable numbers (<bdi class="tabular-nums">).
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard/orders' }));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false, useLocale: () => 'en' }));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ currentTenant: { tenant_id: 't1' } }) }));
jest.mock('@/lib/hooks/useTenantSettings', () => ({ useTenantSettingsWithDefaults: () => ({ trackByPiece: false }) }));
jest.mock('@/lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({ currencyCode: 'OMR', decimalPlaces: 3, formatNumber: (n: number) => String(n), formatMoney: (v: number | string) => `OMR ${Number(v).toFixed(3)}`, isReady: true }) }));
jest.mock('@ui/data-display/cmx-code-chip', () => ({ CmxCodeChip: ({ code }: { code: string }) => <span>{code}</span> }));

import { OrdersSimpleTable } from '@features/orders/ui/orders-simple-table';

const order = {
  id: 'o1',
  order_no: 'ORD-1',
  status: 'ready',
  total: 12.5,
  total_items: 3,
  customer: { name: 'Ali', phone: '+968 9111 1111' },
} as unknown as React.ComponentProps<typeof OrdersSimpleTable>['orders'][number];

function setup() {
  window.history.pushState({}, '', '/dashboard/orders?status=ready&page=1');
  render(<OrdersSimpleTable orders={[order]} pagination={{ total: 45, page: 1, limit: 20, totalPages: 3 }} />);
}

beforeEach(() => push.mockReset());

describe('OrdersSimpleTable', () => {
  it('pages with CmxPagination: "next" pushes ?page=2 and keeps other params', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
    expect(push).toHaveBeenCalledWith('/dashboard/orders?status=ready&page=2');
  });

  it('has no page-size selector', () => {
    setup();
    expect(screen.queryByText('common.rowsPerPage')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('money and phone sit in <bdi class="tabular-nums">', () => {
    setup();
    const phone = screen.getByText('+968 9111 1111');
    expect(phone.tagName).toBe('BDI');
    expect(phone).toHaveClass('tabular-nums');
    const money = screen.getByText(/12\.500/);
    expect(money.tagName).toBe('BDI');
    expect(money).toHaveClass('tabular-nums');
  });
});
