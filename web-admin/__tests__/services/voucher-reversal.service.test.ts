/**
 * Tests: voucher-reversal.service
 *
 * Covers:
 * - reverseBizVoucher -> creates a mirror reversal voucher
 * - reverseBizVoucher -> flips line directions and marks originals reversed
 * - reverseBizVoucher -> writes audit and outbox rows
 * - reverseBizVoucher -> rejects invalid source states
 */

const mockTx = {
  $queryRaw: jest.fn(),
  org_fin_vouchers_mst: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  org_fin_voucher_trx_lines_dtl: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  org_fin_voucher_audit_log: {
    create: jest.fn(),
  },
  org_domain_events_outbox: {
    create: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/voucher-number.service', () => ({
  generateBizVoucherNo: jest.fn().mockResolvedValue('RV-REV-2026-000001'),
}));

import { reverseBizVoucher } from '@/lib/services/voucher-reversal.service';
import { VOUCHER_STATUS, VOUCHER_TYPE } from '@/lib/constants/voucher';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-002';

const makeOriginalVoucher = (status = VOUCHER_STATUS.POSTED) => ({
  id: VOUCHER_ID,
  voucher_no: 'RV-2026-000123',
  voucher_type: VOUCHER_TYPE.RECEIPT,
  voucher_status: status,
  total_amount: '200',
  currency_code: 'OMR',
  branch_id: '44444444-4444-4444-4444-444444444444',
});

const makePostedLines = () => [
  {
    id: 'line-1',
    line_no: 1,
    line_type: 'RECEIPT',
    line_role: 'ORDER_PAYMENT',
    target_type: 'ORDER',
    target_id: 'target-1',
    order_id: '55555555-5555-5555-5555-555555555555',
    customer_id: '66666666-6666-6666-6666-666666666666',
    payment_method_code: 'CASH',
    amount: 120,
    currency_code: 'OMR',
    direction: 'IN',
  },
  {
    id: 'line-2',
    line_no: 2,
    line_type: 'FEE',
    line_role: 'CUSTOMER_CREDIT_RECEIPT',
    target_type: 'CUSTOMER',
    target_id: 'target-2',
    order_id: null,
    customer_id: '77777777-7777-7777-7777-777777777777',
    payment_method_code: 'CARD',
    amount: 80,
    currency_code: 'OMR',
    direction: 'OUT',
  },
];

describe('voucher-reversal.service -> reverseBizVoucher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a reversal voucher, mirror lines, and side effects', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makePostedLines());
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({});
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});

    const result = await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(result).toEqual({
      reversalVoucherId: 'reversal-1',
      reversalVoucherNo: 'RV-REV-2026-000001',
    });

    expect(mockTx.org_fin_vouchers_mst.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          voucher_type: VOUCHER_TYPE.RECEIPT,
          voucher_status: VOUCHER_STATUS.POSTED,
          reversal_reason: 'Customer refund',
          posted_by: USER_ID,
        }),
      })
    );

    expect(mockTx.org_fin_voucher_trx_lines_dtl.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          voucher_id: 'reversal-1',
          reversed_line_id: 'line-1',
          direction: 'OUT',
          line_status: 'POSTED',
        }),
      })
    );

    expect(mockTx.org_fin_voucher_trx_lines_dtl.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          voucher_id: 'reversal-1',
          reversed_line_id: 'line-2',
          direction: 'IN',
          line_status: 'POSTED',
        }),
      })
    );

    expect(mockTx.org_fin_vouchers_mst.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VOUCHER_ID, tenant_org_id: TENANT },
        data: expect.objectContaining({
          voucher_status: VOUCHER_STATUS.REVERSED,
          reversal_reason: 'Customer refund',
          reversed_by: USER_ID,
        }),
      })
    );

    expect(mockTx.org_fin_voucher_audit_log.create).toHaveBeenCalledTimes(1);
    expect(mockTx.org_domain_events_outbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'VOUCHER_REVERSED',
          aggregate_id: VOUCHER_ID,
        }),
      })
    );
  });

  it('throws when the original voucher is not found', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Missing source', USER_ID)
    ).rejects.toThrow(/not found/i);
  });

  it('throws when the original voucher is not POSTED', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher(VOUCHER_STATUS.DRAFT)]);

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Bad state', USER_ID)
    ).rejects.toThrow(/Invalid voucher status transition/i);
  });

  it('throws when there are no POSTED lines to reverse', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([]);

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'No lines', USER_ID)
    ).rejects.toThrow(/No POSTED lines found to reverse/i);
  });
});
