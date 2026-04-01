jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
  },
}));

const mockQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/erp-lite-reporting.service', () => ({
  ErpLiteReportingService: {
    getBranchProfitability: jest.fn(),
  },
}));

import { ErpLitePhase10Service } from '@/lib/services/erp-lite-phase10.service';
import { ErpLiteReportingService } from '@/lib/services/erp-lite-reporting.service';

const mockGetBranchProfitability =
  ErpLiteReportingService.getBranchProfitability as jest.Mock;

describe('ErpLitePhase10Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockReset();
  });

  it('merges direct and allocation profitability with latest costing summary', async () => {
    mockGetBranchProfitability.mockResolvedValueOnce([
      {
        branch_id: 'branch-1',
        branch_name: 'Main Branch',
        direct_revenue: 120,
        direct_expense: 35,
        direct_profit: 85,
      },
    ]);

    mockQueryRaw
      .mockResolvedValueOnce([
        {
          branch_id: 'branch-1',
          branch_name: 'Main Branch',
          allocated_in: '4.5000',
          allocated_out: '1.2500',
          latest_run_no: 'APR-202604-00001',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          rule_code: 'ALR-202604-00001',
          rule_name: 'Revenue Share',
          basis_code: 'REVENUE',
          status_code: 'ACTIVE',
          effective_from: '2026-04-01',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'run-1',
          run_no: 'APR-202604-00001',
          run_date: '2026-04-01',
          status_code: 'POSTED',
          line_count: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cmp-1',
          comp_code: 'CMP-202604-00001',
          component_name: 'Utilities',
          cost_class_code: 'INDIRECT',
          basis_code: 'REVENUE',
          status_code: 'ACTIVE',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cost-run-1',
          run_no: 'CRN-202604-00001',
          run_date: '2026-04-01',
          status_code: 'POSTED',
          line_count: 1,
          total_cost: '7.5000',
        },
      ])
      .mockResolvedValueOnce([
        {
          branch_id: 'branch-1',
          branch_name: 'Main Branch',
          total_cost: '7.5000',
          latest_run_no: 'CRN-202604-00001',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'branch-1',
          name: 'Main Branch',
          name2: 'الفرع الرئيسي',
          code: 'B001',
        },
      ]);

    const snapshot = await ErpLitePhase10Service.getDashboardSnapshot('en');

    expect(snapshot.profitability_rows).toEqual([
      {
        branch_id: 'branch-1',
        branch_name: 'Main Branch',
        direct_revenue: 120,
        direct_expense: 35,
        direct_profit: 85,
        allocated_in: 4.5,
        allocated_out: 1.25,
        allocated_profit: 88.25,
      },
    ]);
    expect(snapshot.latest_alloc_run_no).toBe('APR-202604-00001');
    expect(snapshot.latest_cost_run_no).toBe('CRN-202604-00001');
    expect(snapshot.cost_summary_rows).toEqual([
      {
        branch_id: 'branch-1',
        branch_name: 'Main Branch',
        total_cost: 7.5,
      },
    ]);
  });

  it('creates a tenant-scoped allocation rule with generated code', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00.000Z'));

    mockQueryRaw
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([]);

    await ErpLitePhase10Service.createAllocationRule({
      name: 'Revenue Share',
      basis_code: 'REVENUE',
    });

    const seqQuery = mockQueryRaw.mock.calls[0]?.[0];
    expect(seqQuery?.values).toContain('tenant-123');
    expect(seqQuery?.values).toContain('ALR-202604%');

    const insertQuery = mockQueryRaw.mock.calls[1]?.[0];
    expect(insertQuery?.values).toContain('ALR-202604-00003');
    expect(insertQuery?.values).toContain('Revenue Share');

    jest.useRealTimers();
  });
});
