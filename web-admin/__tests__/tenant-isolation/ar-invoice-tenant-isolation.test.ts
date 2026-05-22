const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const mockCustomerFindMany = jest.fn();
const mockCustomerCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_customers_mst: {
      findMany: (...args: unknown[]) => mockCustomerFindMany(...args),
      count: (...args: unknown[]) => mockCustomerCount(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn(),
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

import { listArCustomerBalances } from '@/lib/services/ar-invoice.service';

describe('ar-invoice tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCustomerFindMany.mockImplementation(
      async (args: { where?: { tenant_org_id?: string } }) => {
        if (args.where?.tenant_org_id !== TENANT_A) {
          return [];
        }

        return [
          {
            id: 'customer-A',
            name: 'Acme Laundry',
            name2: 'أكمي لاندري',
            org_invoice_mst: [
              {
                total: 30,
                paid_amount: 10,
                outstanding_amount: 20,
                currency_code: 'OMR',
                status: 'OPEN',
                updated_at: new Date('2026-05-22T10:00:00.000Z'),
                created_at: new Date('2026-05-20T10:00:00.000Z'),
              },
            ],
            org_customer_ar_ledger_dtl: [
              {
                amount: 2,
                movement_cd: 'OVERPAY_CREDIT',
                entry_side: 'CREDIT',
                currency_code: 'OMR',
                event_at: new Date('2026-05-22T12:00:00.000Z'),
              },
            ],
          },
        ];
      }
    );

    mockCustomerCount.mockImplementation(
      async (args: { where?: { tenant_org_id?: string } }) =>
        args.where?.tenant_org_id === TENANT_A ? 1 : 0
    );
  });

  it('returns only tenant-scoped customer balances for the requested tenant', async () => {
    const tenantAResult = await listArCustomerBalances(
      { page: 1, limit: 20 },
      { tenantId: TENANT_A }
    );

    expect(tenantAResult.data).toHaveLength(1);
    expect(tenantAResult.data[0]?.customer_id).toBe('customer-A');
    expect(tenantAResult.data[0]?.total_outstanding_amount).toBe(20);
    expect(tenantAResult.data[0]?.unapplied_credit_amount).toBe(2);
  });

  it('does not leak another tenant customer balance projection', async () => {
    const tenantBResult = await listArCustomerBalances(
      { page: 1, limit: 20 },
      { tenantId: TENANT_B }
    );

    expect(tenantBResult.data).toEqual([]);
    expect(tenantBResult.total).toBe(0);
    expect(mockCustomerFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_org_id: TENANT_B,
        }),
      })
    );
  });
});
