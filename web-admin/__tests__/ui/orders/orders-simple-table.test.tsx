import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import enOrders from '../../../messages/en/orders/index.json';
import enPrepStatuses from '../../../messages/en/orders/prepStatuses.json';
import enCommon from '../../../messages/en/common.json';
import { OrdersSimpleTable } from '@features/orders/ui/orders-simple-table';
import type { OrderListItem } from '@/types/order';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard/orders',
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns?: string) => (key: string) => {
    const dict =
      ns === 'orders.prepStatuses'
        ? (enPrepStatuses as Record<string, unknown>)
        : ns === 'common'
          ? (enCommon as Record<string, unknown>)
          : ns === 'orders'
            ? (enOrders as Record<string, unknown>)
            : {};
    const val = dict[key];
    return typeof val === 'string' ? val : key;
  },
}));

jest.mock('@/lib/hooks/useRTL', () => ({
  useLocale: () => 'en',
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ currentTenant: { tenant_id: '11111111-1111-1111-1111-111111111111' } }),
}));

jest.mock('@/lib/hooks/useTenantSettings', () => ({
  useTenantSettingsWithDefaults: () => ({ trackByPiece: false }),
}));

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({
    currencyCode: 'OMR',
    decimalPlaces: 3,
    formatMoney: (v: number | string) => `OMR ${Number(v).toFixed(3)}`,
    formatMoneyWithCode: (v: number | string) => `${Number(v).toFixed(3)} OMR`,
    formatNumber: (v: number | string) => String(v),
  }),
}));

const sampleOrder = {
  id: 'ord-1',
  order_no: 'ORD-20261119-00006',
  status: 'ready',
  preparation_status: 'pending',
  total_items: 2,
  total_pieces: 2,
  total: 1.07,
  ready_by: null,
  is_retail: false,
  physical_intake_status: null,
  order_source: { name: 'POS' },
  customer: { name: 'Ali', phone: '+96891234567' },
} as unknown as OrderListItem;

test('renders semantic status and prep badges and supports page size change', () => {
  render(
    <OrdersSimpleTable
      orders={[sampleOrder]}
      pagination={{ total: 13, page: 1, limit: 10, totalPages: 2 }}
    />
  );

  expect(screen.getByText('Ready')).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(screen.getByText('1-10 of 13')).toBeInTheDocument();

  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: '20' } });
  expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('limit=20'));
  expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=1'));
});
