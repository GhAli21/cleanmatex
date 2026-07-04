/**
 * Money-position glance (Remediation Phase 2, D-5) — aggregates must come from
 * the canonical ledgers only, tenant-scoped, with COMPLETED-bucket collections.
 */

import { getMoneyPosition } from '@/lib/services/reports/finance-money-position.service';
import { prisma } from '@/lib/db/prisma';

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_payments_dtl: { findMany: jest.fn() },
    org_orders_mst: { aggregate: jest.fn() },
    org_invoice_mst: { aggregate: jest.fn() },
    org_customer_wallets_mst: { aggregate: jest.fn() },
    org_customer_advances_mst: { aggregate: jest.fn() },
    org_credit_notes_mst: { aggregate: jest.fn() },
    org_cash_drawer_sessions_mst: { count: jest.fn() },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, fn: () => unknown) => fn(),
}));

const p = prisma as unknown as {
  org_order_payments_dtl: { findMany: jest.Mock };
  org_orders_mst: { aggregate: jest.Mock };
  org_invoice_mst: { aggregate: jest.Mock };
  org_customer_wallets_mst: { aggregate: jest.Mock };
  org_customer_advances_mst: { aggregate: jest.Mock };
  org_credit_notes_mst: { aggregate: jest.Mock };
  org_cash_drawer_sessions_mst: { count: jest.Mock };
};

describe('getMoneyPosition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    p.org_order_payments_dtl.findMany.mockResolvedValue([
      { amount: '10.0000', payment_method_code: 'CASH', payment_method_name_snapshot: 'Cash' },
      { amount: '5.0000', payment_method_code: 'CASH', payment_method_name_snapshot: 'Cash' },
      { amount: '7.5000', payment_method_code: 'CARD', payment_method_name_snapshot: 'Card' },
    ]);
    p.org_orders_mst.aggregate.mockResolvedValue({ _sum: { outstanding_amount: '20.0000' } });
    p.org_invoice_mst.aggregate.mockResolvedValue({ _sum: { outstanding_amount: '30.0000' } });
    p.org_customer_wallets_mst.aggregate.mockResolvedValue({ _sum: { balance: '1.0000' } });
    p.org_customer_advances_mst.aggregate.mockResolvedValue({ _sum: { balance: '2.0000' } });
    p.org_credit_notes_mst.aggregate.mockResolvedValue({ _sum: { remaining_balance: '3.0000' } });
    p.org_cash_drawer_sessions_mst.count.mockResolvedValue(2);
  });

  it('aggregates collections by method (largest first) and sums liabilities', async () => {
    const result = await getMoneyPosition('tenant-1');

    expect(result.todayCollections.total).toBe(22.5);
    expect(result.todayCollections.count).toBe(3);
    expect(result.todayCollections.byMethod).toEqual([
      { methodCode: 'CASH', methodName: 'Cash', count: 2, amount: 15 },
      { methodCode: 'CARD', methodName: 'Card', count: 1, amount: 7.5 },
    ]);
    expect(result.ordersOutstanding).toBe(20);
    expect(result.arOutstanding).toBe(30);
    expect(result.storedValueLiability).toBe(6);
    expect(result.openDrawerSessions).toBe(2);
  });

  it('queries the canonical payments ledger with COMPLETED-bucket statuses, tenant-scoped', async () => {
    await getMoneyPosition('tenant-1');

    expect(p.org_order_payments_dtl.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_org_id: 'tenant-1',
          is_active: true,
          payment_status: { in: ['COMPLETED', 'CAPTURED', 'SETTLED'] },
        }),
      })
    );
  });
});
