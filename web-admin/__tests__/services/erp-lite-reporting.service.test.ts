import { ErpLiteReportingService } from '@/lib/services/erp-lite-reporting.service';

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

describe('ErpLiteReportingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns numeric trial balance rows and uses localized account names', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        account_id: 'acct-1',
        account_code: '1100',
        account_name: 'الذمم المدينة',
        total_debit: '25.5000',
        total_credit: '10.2500',
        balance: '15.2500',
      },
    ]);

    const rows = await ErpLiteReportingService.getTrialBalance('ar');

    expect(rows).toEqual([
      {
        account_id: 'acct-1',
        account_code: '1100',
        account_name: 'الذمم المدينة',
        total_debit: 25.5,
        total_credit: 10.25,
        balance: 15.25,
      },
    ]);

    const query = mockQueryRaw.mock.calls[0][0];
    expect(JSON.stringify(query.values)).toContain("COALESCE(NULLIF(a.name2, ''), a.name)");
  });

  it('returns signed profit and loss rows from posted-journal aggregates', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        section_code: 'REVENUE',
        account_type_code: 'REVENUE',
        account_id: 'acct-2',
        account_code: '4100',
        account_name: 'Laundry Revenue',
        amount: '120.0000',
      },
      {
        section_code: 'EXPENSES',
        account_type_code: 'EXPENSE',
        account_id: 'acct-3',
        account_code: '5100',
        account_name: 'Branch Supplies',
        amount: '35.2500',
      },
    ]);

    const rows = await ErpLiteReportingService.getProfitAndLoss('en');

    expect(rows).toEqual([
      {
        section_code: 'REVENUE',
        account_type_code: 'REVENUE',
        account_id: 'acct-2',
        account_code: '4100',
        account_name: 'Laundry Revenue',
        amount: 120,
      },
      {
        section_code: 'EXPENSES',
        account_type_code: 'EXPENSE',
        account_id: 'acct-3',
        account_code: '5100',
        account_name: 'Branch Supplies',
        amount: 35.25,
      },
    ]);

    const query = mockQueryRaw.mock.calls[0][0];
    expect(JSON.stringify(query.values)).toContain('PROFIT_LOSS');
  });

  it('returns AR aging rows from posted invoice balances only', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        customer_id: 'cust-1',
        customer_name: 'Acme Laundry',
        invoice_id: 'inv-1',
        invoice_no: 'INV-001',
        invoice_date: '2026-03-01',
        due_date: '2026-03-10',
        days_overdue: '12',
        outstanding_amount: '44.7500',
        bucket_code: 'DUE_1_30',
        currency_code: 'OMR',
      },
    ]);

    const rows = await ErpLiteReportingService.getArAging('en');

    expect(rows).toEqual([
      {
        customer_id: 'cust-1',
        customer_name: 'Acme Laundry',
        invoice_id: 'inv-1',
        invoice_no: 'INV-001',
        invoice_date: '2026-03-01',
        due_date: '2026-03-10',
        days_overdue: 12,
        outstanding_amount: 44.75,
        bucket_code: 'DUE_1_30',
        currency_code: 'OMR',
      },
    ]);

    const query = mockQueryRaw.mock.calls[0][0];
    expect(JSON.stringify(query.strings)).toContain('org_fin_post_log_tr');
    expect(JSON.stringify(query.strings)).toContain("log.txn_event_code = 'ORDER_INVOICED'");
  });
});
