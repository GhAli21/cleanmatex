jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
  },
}));

const mockQueryRaw = jest.fn();
const mockTransaction = jest.fn();
const mockTxQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) =>
    fn('tenant-123')
  ),
}));

jest.mock('@/lib/services/erp-lite-auto-post.service', () => ({
  ErpLiteAutoPostService: {
    dispatchExpenseRecordedInTransaction: jest.fn(),
    dispatchPettyCashTransactionInTransaction: jest.fn(),
  },
}));

import { ErpLiteExpensesService } from '@/lib/services/erp-lite-expenses.service';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';

const mockDispatchExpenseRecordedInTransaction =
  ErpLiteAutoPostService.dispatchExpenseRecordedInTransaction as jest.Mock;
const mockDispatchPettyCashTransactionInTransaction =
  ErpLiteAutoPostService.dispatchPettyCashTransactionInTransaction as jest.Mock;

describe('ErpLiteExpensesService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: { $queryRaw: typeof mockTxQueryRaw }) => Promise<unknown>) =>
      fn({ $queryRaw: mockTxQueryRaw })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an expense with tenant-scoped numbering and dispatches governed posting', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([{ id: 'branch-1' }])
      .mockResolvedValueOnce([{ usage_code_id: 'usage-expense' }])
      .mockResolvedValueOnce([{ count: 4 }])
      .mockResolvedValueOnce([
        {
          id: 'expense-1',
          expense_no: 'EXP-202603-00005',
          tenant_org_id: 'tenant-123',
          branch_id: 'branch-1',
          expense_date: '2026-03-31',
          currency_code: 'OMR',
          exchange_rate: 1,
          subtotal_amount: 10,
          tax_amount: 0.5,
          total_amount: 10.5,
          settlement_code: 'BANK',
        },
      ])
      .mockResolvedValueOnce([]);

    mockDispatchExpenseRecordedInTransaction.mockResolvedValue({
      status: 'executed',
      execute_result: { success: true },
    });

    const result = await ErpLiteExpensesService.createExpense({
      branch_id: 'branch-1',
      expense_date: '2026-03-31',
      currency_code: 'OMR',
      subtotal_amount: 10,
      tax_amount: 0.5,
      payee_name: 'Vendor A',
      description: 'Detergent',
      settlement_code: 'BANK',
      created_by: 'tester',
    });

    expect(result).toEqual({
      posting_status: 'executed',
      posting_success: true,
      skip_reason: undefined,
    });
    expect(mockDispatchExpenseRecordedInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        expense_id: 'expense-1',
        expense_no: 'EXP-202603-00005',
        settlement_code: 'BANK',
        total_amount: 10.5,
      })
    );

    const seqQuery = mockTxQueryRaw.mock.calls[2]?.[0];
    expect(seqQuery?.values).toContain('tenant-123');
    expect(seqQuery?.values).toContain('EXP-202603%');
  });

  it('creates a petty cash transaction with tenant-scoped numbering and dispatches governed posting', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ id: 'cashbox-1', branch_id: 'branch-2', currency_code: 'OMR' }])
      .mockResolvedValueOnce([
        {
          id: 'txn-1',
          txn_no: 'PCT-202603-00003',
          tenant_org_id: 'tenant-123',
          branch_id: 'branch-2',
          txn_date: '2026-03-31',
          currency_code: 'OMR',
          exchange_rate: 1,
          amount_total: 7.25,
          txn_type_code: 'SPEND',
          cashbox_id: 'cashbox-1',
        },
      ]);

    mockDispatchPettyCashTransactionInTransaction.mockResolvedValue({
      status: 'skipped',
      skip_reason: 'POLICY_DISABLED',
    });

    const result = await ErpLiteExpensesService.createCashTransaction({
      cashbox_id: 'cashbox-1',
      txn_type_code: 'SPEND',
      txn_date: '2026-03-31',
      currency_code: 'OMR',
      amount_total: 7.25,
      description: 'Taxi',
      created_by: 'tester',
    });

    expect(result).toEqual({
      posting_status: 'skipped',
      posting_success: undefined,
      skip_reason: 'POLICY_DISABLED',
    });
    expect(mockDispatchPettyCashTransactionInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        cash_txn_id: 'txn-1',
        txn_no: 'PCT-202603-00003',
        txn_type_code: 'SPEND',
        amount_total: 7.25,
      })
    );

    const seqQuery = mockTxQueryRaw.mock.calls[0]?.[0];
    expect(seqQuery?.values).toContain('tenant-123');
    expect(seqQuery?.values).toContain('PCT-202603%');
  });

  it('rejects a petty cash transaction when the cashbox currency does not match', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ id: 'cashbox-1', branch_id: 'branch-2', currency_code: 'USD' }]);

    await expect(
      ErpLiteExpensesService.createCashTransaction({
        cashbox_id: 'cashbox-1',
        txn_type_code: 'TOPUP',
        txn_date: '2026-03-31',
        currency_code: 'OMR',
        amount_total: 1,
      })
    ).rejects.toThrow('Petty cash transaction currency must match the cashbox currency');

    expect(mockDispatchPettyCashTransactionInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a cashbox when the selected account is not mapped as petty cash', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(
      ErpLiteExpensesService.createCashbox({
        account_id: 'acct-1',
        name: 'Front Desk Box',
        currency_code: 'OMR',
      })
    ).rejects.toThrow('Selected account is not an active petty cash account for this tenant');
  });
});
