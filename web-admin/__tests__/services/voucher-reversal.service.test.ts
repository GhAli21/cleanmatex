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
  org_order_payments_dtl: {
    findFirst: jest.fn(),
  },
  org_order_credit_apps_dtl: {
    findFirst: jest.fn(),
  },
  org_cash_drawer_sessions_mst: {
    findFirst: jest.fn(),
  },
  org_customers_mst: {
    findFirst: jest.fn(),
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

const mockCanAccess = jest.fn().mockResolvedValue(false);
jest.mock('@/lib/services/feature-flags.service', () => ({
  canAccess: (...args: unknown[]) => mockCanAccess(...args),
}));

const mockTransitionPaymentTx = jest.fn();
jest.mock('@/lib/services/payment-transition.service', () => ({
  transitionPaymentTx: (...args: unknown[]) => mockTransitionPaymentTx(...args),
}));

const mockReverseCreditApplicationTx = jest.fn();
jest.mock('@/lib/services/credit-application-reversal.service', () => ({
  reverseCreditApplicationTx: (...args: unknown[]) => mockReverseCreditApplicationTx(...args),
}));

const mockUnwindStoredValueFundingLine = jest.fn();
jest.mock('@/lib/services/voucher-funding-unwind.service', () => ({
  isStoredValueFundingRole: (role: string) =>
    ['WALLET_TOPUP', 'GIFT_CARD_SALE', 'CUSTOMER_ADVANCE_RECEIPT', 'CUSTOMER_CREDIT_ISSUE', 'CUSTOMER_CREDIT_RECEIPT'].includes(role),
  unwindStoredValueFundingLine: (...args: unknown[]) => mockUnwindStoredValueFundingLine(...args),
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: jest.fn().mockResolvedValue({}),
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
  voucher_category: 'CASH',
  voucher_subtype: null,
  voucher_status: status,
  total_amount: '200',
  subtotal_amount: '200',
  discount_amount: null,
  tax_amount: null,
  fee_amount: null,
  paid_amount: '200',
  refunded_amount: null,
  outstanding_amount: '0',
  currency_code: 'OMR',
  currency_ex_rate: '1',
  branch_id: '44444444-4444-4444-4444-444444444444',
  direction: 'IN',
  party_type: 'CUSTOMER',
  party_name: 'Demo Customer',
  supplier_id: null,
  employee_id: null,
  customer_id: '66666666-6666-6666-6666-666666666666',
  order_id: '55555555-5555-5555-5555-555555555555',
  invoice_id: null,
  source_module: 'ORDERS',
  source_ref_type: 'ORDER',
  source_ref_id: '55555555-5555-5555-5555-555555555555',
  reason_code: null,
  notes: 'Counter receipt',
  description: 'Cash receipt',
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
    mockCanAccess.mockResolvedValue(false);
  });

  it('creates a reversal voucher, mirror lines, and side effects', async () => {
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue(makePostedLines());
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-1' });
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
          posting_status: 'POSTED',
          party_name: 'Demo Customer',
          paid_amount: 200,
          outstanding_amount: 0,
          ref_voucher_id: VOUCHER_ID,
          reversal_reason: 'Customer refund',
          posted_by: USER_ID,
          notes: 'Counter receipt',
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
          party_name: 'Demo Customer',
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
          reversed_by_voucher_id: 'reversal-1',
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
    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
    expect(mockTx.org_customers_mst.findFirst).not.toHaveBeenCalled();
  });

  it('fills party_name from the customer when the original header left it blank', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ ...makeOriginalVoucher(), party_name: null }]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([makePostedLines()[0]]);
    mockTx.org_customers_mst.findFirst.mockResolvedValue({
      display_name: null,
      name: 'Walk-in Customer',
      name2: null,
      first_name: null,
      last_name: null,
    });
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-1' });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTx.org_customers_mst.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '66666666-6666-6666-6666-666666666666', tenant_org_id: TENANT },
      })
    );
    expect(mockTx.org_fin_vouchers_mst.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          party_name: 'Walk-in Customer',
          customer_id: '66666666-6666-6666-6666-666666666666',
          ref_voucher_id: VOUCHER_ID,
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

  it('B13: when unwind is ON, reverses the linked ORDER_PAYMENT via B10', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([makePostedLines()[0]]);
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-1' });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_order_payments_dtl.findFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: '55555555-5555-5555-5555-555555555555',
      payment_status: 'COMPLETED',
      payment_method_code: 'CARD',
      cash_drawer_session_id: null,
    });
    mockTransitionPaymentTx.mockResolvedValue({ flipped: true });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTransitionPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-1',
        action: 'REVERSE',
        cashDrawerSessionId: undefined,
        idempotencyKey: 'voucher_unwind:reversal-1:line-1',
      })
    );
    expect(mockTx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-line-1', tenant_org_id: TENANT },
        data: expect.objectContaining({ wiring_status: 'WIRED' }),
      })
    );
  });

  it('B13: cash ORDER_PAYMENT unwind requires an OPEN drawer session', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([makePostedLines()[0]]);
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-1' });
    mockTx.org_order_payments_dtl.findFirst.mockResolvedValue({
      id: 'pay-cash',
      order_id: '55555555-5555-5555-5555-555555555555',
      payment_status: 'COMPLETED',
      payment_method_code: 'CASH',
      cash_drawer_session_id: 'sess-closed',
    });
    mockTx.org_cash_drawer_sessions_mst.findFirst.mockResolvedValue(null);

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID)
    ).rejects.toThrow('VOUCHER_UNWIND_DRAWER_SESSION_REQUIRED');
    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
  });

  it('B13: when unwind is ON, restores ORDER_CREDIT_APPLICATION via D006', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([
      {
        id: 'line-ca',
        line_no: 1,
        line_type: 'RECEIPT',
        line_role: 'ORDER_CREDIT_APPLICATION',
        target_type: 'ORDER',
        target_id: 'order-1',
        order_id: '55555555-5555-5555-5555-555555555555',
        customer_id: '66666666-6666-6666-6666-666666666666',
        payment_method_code: null,
        amount: 8,
        currency_code: 'OMR',
        direction: 'IN',
      },
    ]);
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-ca' });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockTx.org_order_credit_apps_dtl.findFirst.mockResolvedValue({
      id: 'ca-1',
      order_id: '55555555-5555-5555-5555-555555555555',
      credit_type: 'WALLET',
      credit_source_id: null,
      applied_amount: '8',
      currency_code: 'OMR',
      application_status: 'APPLIED',
      fin_voucher_trx_line_id: 'line-ca',
    });
    mockReverseCreditApplicationTx.mockResolvedValue({ restoredAmount: 8, status: 'REVERSED' });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockReverseCreditApplicationTx).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        orderId: '55555555-5555-5555-5555-555555555555',
        idempotencyPrefix: 'voucher_unwind:reversal-1',
      }),
      expect.objectContaining({ id: 'ca-1' }),
      '66666666-6666-6666-6666-666666666666',
      expect.any(Array),
    );
    expect(mockTx.org_fin_voucher_trx_lines_dtl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-line-ca', tenant_org_id: TENANT },
        data: expect.objectContaining({ wiring_status: 'WIRED' }),
      }),
    );
  });

  it('B13: when unwind is ON, claws back WALLET_TOPUP funding', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockTx.$queryRaw.mockResolvedValue([makeOriginalVoucher()]);
    mockTx.org_fin_voucher_trx_lines_dtl.findMany.mockResolvedValue([
      {
        id: 'line-w',
        line_no: 1,
        line_type: 'RECEIPT',
        line_role: 'WALLET_TOPUP',
        target_type: 'WALLET',
        target_id: 'wallet-1',
        order_id: null,
        customer_id: '66666666-6666-6666-6666-666666666666',
        payment_method_code: 'CASH',
        amount: 20,
        currency_code: 'OMR',
        direction: 'IN',
      },
    ]);
    mockTx.org_fin_vouchers_mst.create.mockResolvedValue({
      id: 'reversal-1',
      voucher_no: 'RV-REV-2026-000001',
    });
    mockTx.org_fin_voucher_trx_lines_dtl.create.mockResolvedValue({ id: 'rev-line-w' });
    mockTx.org_fin_voucher_trx_lines_dtl.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_vouchers_mst.updateMany.mockResolvedValue({ count: 1 });
    mockTx.org_fin_voucher_audit_log.create.mockResolvedValue({});
    mockTx.org_domain_events_outbox.create.mockResolvedValue({});
    mockUnwindStoredValueFundingLine.mockResolvedValue(undefined);

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockUnwindStoredValueFundingLine).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        originalLineId: 'line-w',
        originalLineRole: 'WALLET_TOPUP',
        reversalLineId: 'rev-line-w',
      }),
    );
  });
});
