import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import arCommon from '../../../messages/ar/common.json';
import { VouchersTable } from '@features/finance/vouchers/ui/vouchers-table';
import type { VoucherListItem } from '@/lib/types/voucher';

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock('next-intl', () => ({
  useLocale: () => 'ar',
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    if (ns === 'common') {
      const val = (arCommon as Record<string, unknown>)[key];
      if (typeof val === 'string') return val;
    }
    return params ? `${key}:${JSON.stringify(params)}` : key;
  },
}));

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ currencyCode: 'OMR', decimalPlaces: 3 }),
}));

jest.mock('@features/finance/vouchers/ui/voucher-status-badge', () => ({
  VoucherStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

jest.mock('@features/finance/vouchers/ui/voucher-direction-badge', () => ({
  VoucherDirectionBadge: ({ direction }: { direction: string }) => <span>{direction}</span>,
}));

jest.mock('@features/finance/vouchers/ui/voucher-edit-dialog', () => ({
  VoucherEditDialog: () => null,
}));

const sampleItem: VoucherListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_org_id: '22222222-2222-4222-8222-222222222222',
  voucher_no: 'VCH-2026-0001',
  voucher_type: 'RECEIPT_VOUCHER',
  direction: 'IN',
  status: 'ISSUED',
  total_amount: 10,
  currency_code: 'OMR',
  issued_at: '2026-11-20T10:00:00Z',
  ref_voucher_id: null,
  ref_voucher_no: null,
  order_id: null,
  order_no: null,
  customer_id: null,
  customer_name: null,
  invoice_id: null,
  invoice_no: null,
  payment_id: null,
  notes: null,
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
} as unknown as VoucherListItem;

test('renders a single localized Arabic CmxPagination and hides CmxDataGrid duplicate footer', () => {
  render(
    <VouchersTable
      items={[sampleItem]}
      total={44}
      page={1}
      pageSize={20}
      onPageChange={jest.fn()}
    />
  );

  expect(screen.getByText('1-20 من 44')).toBeInTheDocument();
  expect(screen.queryByText(/Rows per page/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Go to page/i)).not.toBeInTheDocument();
});
