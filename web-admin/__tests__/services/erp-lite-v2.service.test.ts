jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
    raw: (value: string) => ({ __raw: value }),
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

import { ErpLiteV2Service } from '@/lib/services/erp-lite-v2.service';

describe('ErpLiteV2Service', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    jest.clearAllMocks();
    mockTransaction.mockImplementation(
      async (fn: (tx: { $queryRaw: typeof mockTxQueryRaw }) => Promise<unknown>) =>
        fn({ $queryRaw: mockTxQueryRaw })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a supplier with tenant-scoped numbering', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'branch-1' }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ usage_code_id: 'usage-expense' }])
      .mockResolvedValueOnce([{ id: 'supplier-1', supplier_code: 'SUP-202604-00002' }]);

    await ErpLiteV2Service.createSupplier({
      branch_id: 'branch-1',
      name: 'Vendor A',
      currency_code: 'OMR',
    });

    const seqQuery = mockQueryRaw.mock.calls[1]?.[0];
    expect(seqQuery?.values).toContain('tenant-123');
    expect(seqQuery?.values).toContain('SUP-202604%');
  });

  it('creates an AP payment and updates invoice open amount', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'supp-1',
          branch_id: 'branch-1',
          payable_acct_id: 'acct-1',
          currency_code: 'OMR',
          status_code: 'ACTIVE',
          posting_hold: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'inv-1',
          supplier_id: 'supp-1',
          branch_id: 'branch-1',
          currency_code: 'OMR',
          open_amount: 15,
          status_code: 'POSTED',
        },
      ])
      .mockResolvedValueOnce([{ id: 'branch-1' }])
      .mockResolvedValueOnce([
        {
          id: 'bank-1',
          branch_id: 'branch-1',
          currency_code: 'OMR',
          status_code: 'ACTIVE',
        },
      ])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ id: 'payment-1', ap_pmt_no: 'APP-202604-00004' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await ErpLiteV2Service.createApPayment({
      supplier_id: 'supp-1',
      ap_invoice_id: 'inv-1',
      branch_id: 'branch-1',
      bank_account_id: 'bank-1',
      payment_date: '2026-04-01',
      currency_code: 'OMR',
      amount_total: 10,
      settlement_code: 'BANK',
    });

    const seqQuery = mockTxQueryRaw.mock.calls[4]?.[0];
    expect(seqQuery?.values).toContain('tenant-123');
    expect(seqQuery?.values).toContain('APP-202604%');

    const updateQuery = mockTxQueryRaw.mock.calls[7]?.[0];
    expect(updateQuery?.values).toContain(5);
    expect(updateQuery?.values).toContain('PARTIAL');
  });

  it('rejects AP payment when bank account currency does not match', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'supp-1',
          branch_id: 'branch-1',
          payable_acct_id: 'acct-1',
          currency_code: 'OMR',
          status_code: 'ACTIVE',
          posting_hold: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'inv-1',
          supplier_id: 'supp-1',
          branch_id: 'branch-1',
          currency_code: 'OMR',
          open_amount: 12,
          status_code: 'POSTED',
        },
      ])
      .mockResolvedValueOnce([{ id: 'branch-1' }])
      .mockResolvedValueOnce([
        {
          id: 'bank-1',
          branch_id: 'branch-1',
          currency_code: 'USD',
          status_code: 'ACTIVE',
        },
      ]);

    await expect(
      ErpLiteV2Service.createApPayment({
        supplier_id: 'supp-1',
        ap_invoice_id: 'inv-1',
        branch_id: 'branch-1',
        bank_account_id: 'bank-1',
        payment_date: '2026-04-01',
        currency_code: 'OMR',
        amount_total: 5,
        settlement_code: 'BANK',
      })
    ).rejects.toThrow('Selected bank account currency must match the AP payment currency');
  });

  it('returns AP aging rows on the AP dashboard snapshot', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'aging-1',
          ap_inv_no: 'API-202604-00001',
          supplier_name: 'Vendor A',
          due_date: '2026-03-01',
          days_overdue: 31,
          open_amount: 12,
          currency_code: 'OMR',
          aging_bucket: 'DUE_31_60',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const snapshot = await ErpLiteV2Service.getApDashboardSnapshot('en');

    expect(snapshot.ap_aging_list).toHaveLength(1);
    expect(snapshot.ap_aging_list[0]).toEqual(
      expect.objectContaining({
        ap_inv_no: 'API-202604-00001',
        aging_bucket: 'DUE_31_60',
        open_amount: 12,
      })
    );
  });

  it('creates a bank match and reduces unmatched reconciliation amount', async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: { $queryRaw: typeof mockTxQueryRaw }) => Promise<unknown>) =>
        fn({ $queryRaw: mockTxQueryRaw })
    );

    mockTxQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'stmt-line-1',
          bank_stmt_id: 'stmt-1',
          bank_account_id: 'bank-1',
          debit_amount: 10,
          credit_amount: 0,
          match_status: 'UNMATCHED',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'pmt-1',
          amount_total: 10,
          status_code: 'POSTED',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'recon-1',
          status_code: 'OPEN',
          unmatched_amount: 10,
        },
      ])
      .mockResolvedValueOnce([{ amount: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await ErpLiteV2Service.createBankMatch({
      bank_stmt_line_id: 'stmt-line-1',
      bank_recon_id: 'recon-1',
      ap_payment_id: 'pmt-1',
      match_amount: 10,
    });

    const updateStmtLineQuery = mockTxQueryRaw.mock.calls[5]?.[0];
    expect(updateStmtLineQuery?.values).toContain('MATCHED');

    const updateReconQuery = mockTxQueryRaw.mock.calls[6]?.[0];
    expect(updateReconQuery?.values).toContain(0);
  });

  it('rejects bank reconciliation close when unmatched amount remains', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: 'recon-1',
        status_code: 'OPEN',
        unmatched_amount: 2,
      },
    ]);

    await expect(ErpLiteV2Service.closeBankRecon('recon-1')).rejects.toThrow(
      'Bank reconciliation cannot be closed while unmatched amount remains'
    );
  });

  it('imports statement lines into the selected statement batch', async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: { $queryRaw: typeof mockTxQueryRaw }) => Promise<unknown>) =>
        fn({ $queryRaw: mockTxQueryRaw })
    );

    mockTxQueryRaw
      .mockResolvedValueOnce([{ id: 'stmt-1', bank_account_id: 'bank-1' }])
      .mockResolvedValueOnce([{ next_line_no: 1 }])
      .mockResolvedValueOnce([{ id: 'line-1', line_no: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ next_line_no: 2 }])
      .mockResolvedValueOnce([{ id: 'line-2', line_no: 2 }])
      .mockResolvedValueOnce([]);

    await ErpLiteV2Service.importBankStatementLines({
      bank_stmt_id: 'stmt-1',
      rows: [
        {
          bank_account_id: 'bank-1',
          txn_date: '2026-04-01',
          description: 'Deposit',
          debit_amount: 10,
          credit_amount: 0,
        },
        {
          bank_account_id: 'bank-1',
          txn_date: '2026-04-02',
          description: 'Fee',
          debit_amount: 0,
          credit_amount: 1,
        },
      ],
    });

    expect(mockTxQueryRaw).toHaveBeenCalledTimes(7);
    const secondInsert = mockTxQueryRaw.mock.calls[5]?.[0];
    expect(secondInsert?.values).toContain(2);
  });

  it('reverses a confirmed bank match and reopens reconciliation balances', async () => {
    mockTransaction.mockImplementation(
      async (fn: (tx: { $queryRaw: typeof mockTxQueryRaw }) => Promise<unknown>) =>
        fn({ $queryRaw: mockTxQueryRaw })
    );

    mockTxQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'match-1',
          bank_stmt_line_id: 'stmt-line-1',
          bank_recon_id: 'recon-1',
          match_amount: 10,
          status_code: 'CONFIRMED',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'recon-1',
          status_code: 'CLOSED',
          unmatched_amount: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 0 }])
      .mockResolvedValueOnce([
        {
          id: 'stmt-line-1',
          bank_stmt_id: 'stmt-1',
          bank_account_id: 'bank-1',
          debit_amount: 10,
          credit_amount: 0,
          match_status: 'MATCHED',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'recon-1',
          status_code: 'CLOSED',
          unmatched_amount: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    await ErpLiteV2Service.reverseBankMatch('match-1');

    const stmtUpdate = mockTxQueryRaw.mock.calls[5]?.[0];
    expect(stmtUpdate?.values).toContain('UNMATCHED');

    const reconUpdate = mockTxQueryRaw.mock.calls[7]?.[0];
    expect(reconUpdate?.values).toContain(10);
  });

  it('locks a closed bank reconciliation', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'recon-1',
          status_code: 'CLOSED',
          unmatched_amount: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    await ErpLiteV2Service.lockBankRecon('recon-1');

    const updateQuery = mockQueryRaw.mock.calls[1]?.[0];
    expect(updateQuery?.values).toContain('recon-1');
  });
});
