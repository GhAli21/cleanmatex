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
});
