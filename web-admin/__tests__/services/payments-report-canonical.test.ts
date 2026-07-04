/**
 * @jest-environment node
 *
 * (Prisma.sql template helpers need the node build of @prisma/client — the
 * jsdom bundle throws; same pattern as finance-reconciliation-report tests.)
 *
 * FN-01 reporting seam lock — `getPaymentsReport` must aggregate the canonical
 * `org_order_payments_dtl` ledger (never the legacy payments ledger dropped by migration 0395; ADR-002):
 * collected money = COMPLETED/CAPTURED/SETTLED rows only; refunds counted from
 * `org_order_refunds_dtl`; status filter values are canonical buckets.
 *
 * Source: docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md §Phase 2.
 */

import { getPaymentsReport } from '@/lib/services/report-service';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_payments_dtl: { findMany: jest.fn() },
    org_order_refunds_dtl: { count: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenantId: string, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  }),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: () => ({
    getCurrencyConfig: jest.fn().mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 }),
  }),
}));

const findMany = prisma.org_order_payments_dtl.findMany as jest.Mock;
const refundCount = prisma.org_order_refunds_dtl.count as jest.Mock;
const queryRaw = prisma.$queryRaw as unknown as jest.Mock;

const filters = {
  startDate: new Date('2026-07-01T00:00:00Z'),
  endDate: new Date('2026-07-02T23:59:59Z'),
};

function row(overrides: Record<string, unknown>) {
  return {
    id: 'p1',
    amount: '10.0000',
    payment_method_code: 'CASH',
    payment_method_name_snapshot: 'Cash',
    payment_status: 'COMPLETED',
    paid_at: new Date('2026-07-01T10:00:00Z'),
    created_at: new Date('2026-07-01T10:00:00Z'),
    ...overrides,
  };
}

describe('getPaymentsReport (canonical ledger)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([]);
    refundCount.mockResolvedValue(0);
  });

  it('reads org_order_payments_dtl with tenant scope + active flag', async () => {
    findMany.mockResolvedValue([]);

    await getPaymentsReport({ tenantOrgId: 'tenant-1', filters });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_org_id: 'tenant-1', is_active: true }),
      })
    );
  });

  it('counts only COMPLETED-bucket rows as collected money; pending stays out of KPIs', async () => {
    findMany.mockResolvedValue([
      row({ id: 'p1', payment_status: 'COMPLETED', amount: '10.0000' }),
      row({ id: 'p2', payment_status: 'CAPTURED', amount: '5.0000' }),
      row({ id: 'p3', payment_status: 'PENDING', amount: '99.0000' }),
      row({ id: 'p4', payment_status: 'FAILED', amount: '7.0000' }),
    ]);

    const report = await getPaymentsReport({ tenantOrgId: 'tenant-1', filters });

    expect(report.kpis.totalAmount).toBe(15);
    expect(report.kpis.totalPayments).toBe(2);
    // pending/failed remain visible in the status breakdown
    const statuses = Object.fromEntries(report.paymentsByStatus.map((s) => [s.status, s.amount]));
    expect(statuses.PENDING).toBe(99);
    expect(statuses.FAILED).toBe(7);
  });

  it('expands canonical bucket filters to row statuses (COMPLETED → CAPTURED/SETTLED too)', async () => {
    findMany.mockResolvedValue([]);

    await getPaymentsReport({
      tenantOrgId: 'tenant-1',
      filters: { ...filters, status: ['COMPLETED'] },
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payment_status: { in: ['COMPLETED', 'CAPTURED', 'SETTLED'] },
        }),
      })
    );
  });

  it('counts refunds from the canonical refunds fact table', async () => {
    findMany.mockResolvedValue([]);
    refundCount.mockResolvedValue(3);

    const report = await getPaymentsReport({ tenantOrgId: 'tenant-1', filters });

    expect(report.kpis.refundedPayments).toBe(3);
    expect(refundCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ refund_status: 'PROCESSED', tenant_org_id: 'tenant-1' }),
      })
    );
  });

  it('method breakdown uses the method name snapshot', async () => {
    findMany.mockResolvedValue([
      row({ id: 'p1', payment_method_code: 'CASH', payment_method_name_snapshot: 'Cash' }),
      row({ id: 'p2', payment_method_code: 'CARD', payment_method_name_snapshot: 'Card', amount: '4.0000' }),
    ]);

    const report = await getPaymentsReport({ tenantOrgId: 'tenant-1', filters });

    expect(report.paymentsByMethod).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ methodCode: 'CASH', methodName: 'Cash', amount: 10 }),
        expect.objectContaining({ methodCode: 'CARD', methodName: 'Card', amount: 4 }),
      ])
    );
  });
});
