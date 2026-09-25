/**
 * Tests: voucher-reversal.service (CLF — thin wrapper over reverseVoucherLinesInTx)
 *
 * `reverseVoucherLinesInTx` itself (mirror creation, gate dispatch, party_name,
 * "not found" / "no POSTED lines" rejections) is covered by
 * voucher-line-reversal.service.test.ts — this file only tests what
 * `reverseBizVoucher` does on top of that core: dispatch to the per-role
 * unwind functions, the idempotency-key / idempotency-prefix format, passing
 * `pair.reversalSessionId` through untouched, per-distinct-order recalculation,
 * and the `unwindEnabled=false` short-circuit.
 */

const mockVoucherLineUpdateMany = jest.fn();
const mockOrderPaymentFindFirst = jest.fn();
const mockOrderCreditAppFindFirst = jest.fn();

const mockTx = {
  org_fin_voucher_trx_lines_dtl: { updateMany: (...a: unknown[]) => mockVoucherLineUpdateMany(...a) },
  org_order_payments_dtl: { findFirst: (...a: unknown[]) => mockOrderPaymentFindFirst(...a) },
  org_order_credit_apps_dtl: { findFirst: (...a: unknown[]) => mockOrderCreditAppFindFirst(...a) },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

const mockCanAccess = jest.fn().mockResolvedValue(false);
jest.mock('@/lib/services/feature-flags.service', () => ({
  canAccess: (...args: unknown[]) => mockCanAccess(...args),
}));

const mockReverseVoucherLinesInTx = jest.fn();
jest.mock('@/lib/services/voucher-line-reversal.service', () => ({
  reverseVoucherLinesInTx: (...a: unknown[]) => mockReverseVoucherLinesInTx(...a),
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

const mockRecalc = jest.fn();
jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...args: unknown[]) => mockRecalc(...args),
}));

import { reverseBizVoucher } from '@/lib/services/voucher-reversal.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-002';
const ORDER_ID = '55555555-5555-5555-5555-555555555555';
const CUSTOMER_ID = '66666666-6666-6666-6666-666666666666';

/** Shape returned by the mocked core — only the fields the wrapper reads. */
function coreResult(pairs: Array<Record<string, unknown>> = []) {
  return {
    reversalVoucherId: 'reversal-1',
    reversalVoucherNo: 'RV-REV-2026-000001',
    originalStatus: 'REVERSED',
    pairs,
  };
}

function paymentPair(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    originalLineId: 'line-1',
    originalLineRole: 'ORDER_PAYMENT',
    originalOrderId: ORDER_ID,
    originalCustomerId: CUSTOMER_ID,
    reversalLineId: 'rev-line-1',
    reversalSessionId: 'session-xyz',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanAccess.mockResolvedValue(false);
  mockVoucherLineUpdateMany.mockResolvedValue({ count: 1 });
  mockRecalc.mockResolvedValue({});
});

describe('reverseBizVoucher — delegates to the core', () => {
  it('calls reverseVoucherLinesInTx with tenant/voucher/reason/actor and returns its result shape', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult());

    const result = await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(result).toEqual({
      reversalVoucherId: 'reversal-1',
      reversalVoucherNo: 'RV-REV-2026-000001',
      originalStatus: 'REVERSED',
    });
    expect(mockReverseVoucherLinesInTx).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        tenantOrgId: TENANT,
        voucherId: VOUCHER_ID,
        reason: 'Customer refund',
        userId: USER_ID,
        lineIds: undefined,
        cashDrawerId: undefined,
      }),
    );
  });

  it('passes opts.lineIds and opts.cashDrawerId straight through', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult());

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Partial refund', USER_ID, {
      lineIds: ['line-1', 'line-2'],
      cashDrawerId: 'drawer-2',
    });

    expect(mockReverseVoucherLinesInTx).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ lineIds: ['line-1', 'line-2'], cashDrawerId: 'drawer-2' }),
    );
  });

  it('unwindEnabled=false: core is called but no unwind dispatch and no recalc run at all', async () => {
    mockCanAccess.mockResolvedValue(false);
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
    expect(mockReverseCreditApplicationTx).not.toHaveBeenCalled();
    expect(mockUnwindStoredValueFundingLine).not.toHaveBeenCalled();
    expect(mockRecalc).not.toHaveBeenCalled();
    expect(mockVoucherLineUpdateMany).not.toHaveBeenCalled();
  });
});

describe('reverseBizVoucher — B13 unwind ON, ORDER_PAYMENT role', () => {
  beforeEach(() => {
    mockCanAccess.mockResolvedValue(true);
  });

  it('REVERSE branch (COMPLETED source): idempotency key format, cash session passed through untouched, stamps WIRED, recalculates the order once', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'COMPLETED',
      payment_method_code: 'CASH',
    });
    mockTransitionPaymentTx.mockResolvedValue({ flipped: true });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTransitionPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        orderId: ORDER_ID,
        paymentId: 'pay-1',
        actorId: USER_ID,
        action: 'REVERSE',
        reason: 'Voucher reverse: Customer refund',
        idempotencyKey: 'voucher_unwind:reversal-1:line-1',
        // Session comes straight from pair.reversalSessionId — never re-resolved.
        cashDrawerSessionId: 'session-xyz',
      }),
      mockTx,
    );
    expect(mockVoucherLineUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-line-1', tenant_org_id: TENANT },
        data: expect.objectContaining({ wiring_status: 'WIRED' }),
      }),
    );
    expect(mockRecalc).toHaveBeenCalledTimes(1);
    expect(mockRecalc).toHaveBeenCalledWith(mockTx, TENANT, ORDER_ID, {});
  });

  it('a non-cash leg REVERSE omits cashDrawerSessionId even when the pair carries a session', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'COMPLETED',
      payment_method_code: 'CARD',
    });
    mockTransitionPaymentTx.mockResolvedValue({ flipped: true });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTransitionPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REVERSE', cashDrawerSessionId: undefined }),
      mockTx,
    );
  });

  it('a cash leg REVERSE with reversalSessionId=null (gate placed it in the next window) throws VOUCHER_UNWIND_DRAWER_SESSION_REQUIRED', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair({ reversalSessionId: null })]));
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'COMPLETED',
      payment_method_code: 'CASH',
    });

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID),
    ).rejects.toThrow('VOUCHER_UNWIND_DRAWER_SESSION_REQUIRED');
    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
  });

  it('VOID branch (still-PENDING source): dispatches VOID, no cashDrawerSessionId even for a cash leg', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'PENDING',
      payment_method_code: 'CASH',
    });
    mockTransitionPaymentTx.mockResolvedValue({ flipped: true });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTransitionPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VOID', cashDrawerSessionId: undefined }),
      mockTx,
    );
  });

  it('an already-REVERSED payment short-circuits (no transitionPaymentTx call)', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'REVERSED',
      payment_method_code: 'CASH',
    });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
  });

  it('an unsupported source payment_status throws VOUCHER_UNWIND_UNSUPPORTED_PAYMENT_STATUS', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'DRAFT',
      payment_method_code: 'CASH',
    });

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID),
    ).rejects.toThrow('VOUCHER_UNWIND_UNSUPPORTED_PAYMENT_STATUS:DRAFT');
  });

  it('throws VOUCHER_UNWIND_PAYMENT_NOT_FOUND when no payment row links to the original line', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([paymentPair()]));
    mockOrderPaymentFindFirst.mockResolvedValue(null);

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID),
    ).rejects.toThrow('VOUCHER_UNWIND_PAYMENT_NOT_FOUND');
  });
});

describe('reverseBizVoucher — B13 unwind ON, ORDER_CREDIT_APPLICATION role', () => {
  beforeEach(() => {
    mockCanAccess.mockResolvedValue(true);
  });

  const creditAppPair = () =>
    paymentPair({
      originalLineId: 'line-ca',
      originalLineRole: 'ORDER_CREDIT_APPLICATION',
      reversalLineId: 'rev-line-ca',
    });

  it('restores the credit application with the voucher_unwind idempotency prefix, stamps WIRED', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([creditAppPair()]));
    mockOrderCreditAppFindFirst.mockResolvedValue({
      id: 'ca-1',
      order_id: ORDER_ID,
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
        orderId: ORDER_ID,
        userId: USER_ID,
        reason: 'Voucher reverse: Customer refund',
        idempotencyPrefix: 'voucher_unwind:reversal-1',
      }),
      expect.objectContaining({ id: 'ca-1' }),
      CUSTOMER_ID,
      expect.any(Array),
    );
    expect(mockVoucherLineUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-line-ca', tenant_org_id: TENANT },
        data: expect.objectContaining({ wiring_status: 'WIRED' }),
      }),
    );
  });

  it('throws VOUCHER_UNWIND_CREDIT_APP_NOT_FOUND when no application links to the original line', async () => {
    mockReverseVoucherLinesInTx.mockResolvedValue(coreResult([creditAppPair()]));
    mockOrderCreditAppFindFirst.mockResolvedValue(null);

    await expect(
      reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID),
    ).rejects.toThrow('VOUCHER_UNWIND_CREDIT_APP_NOT_FOUND');
  });
});

describe('reverseBizVoucher — B13 unwind ON, stored-value funding roles', () => {
  it('claws back a WALLET_TOPUP line via unwindStoredValueFundingLine, stamps WIRED', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockReverseVoucherLinesInTx.mockResolvedValue(
      coreResult([
        paymentPair({
          originalLineId: 'line-w',
          originalLineRole: 'WALLET_TOPUP',
          reversalLineId: 'rev-line-w',
        }),
      ]),
    );
    mockUnwindStoredValueFundingLine.mockResolvedValue(undefined);

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockUnwindStoredValueFundingLine).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        tenantOrgId: TENANT,
        originalLineId: 'line-w',
        originalLineRole: 'WALLET_TOPUP',
        reversalVoucherId: 'reversal-1',
        reversalLineId: 'rev-line-w',
        reason: 'Customer refund',
        userId: USER_ID,
      }),
    );
    expect(mockVoucherLineUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-line-w', tenant_org_id: TENANT },
        data: expect.objectContaining({ wiring_status: 'WIRED' }),
      }),
    );
  });
});

describe('reverseBizVoucher — per-distinct-order recalculation', () => {
  it('recalculates once per distinct order even with two unwound pairs on the same order', async () => {
    mockCanAccess.mockResolvedValue(true);
    mockReverseVoucherLinesInTx.mockResolvedValue(
      coreResult([
        paymentPair(),
        paymentPair({
          originalLineId: 'line-ca',
          originalLineRole: 'ORDER_CREDIT_APPLICATION',
          reversalLineId: 'rev-line-ca',
        }),
      ]),
    );
    mockOrderPaymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      order_id: ORDER_ID,
      payment_status: 'COMPLETED',
      payment_method_code: 'CARD',
    });
    mockTransitionPaymentTx.mockResolvedValue({ flipped: true });
    mockOrderCreditAppFindFirst.mockResolvedValue({
      id: 'ca-1',
      order_id: ORDER_ID,
      credit_type: 'WALLET',
      credit_source_id: null,
      applied_amount: '8',
      currency_code: 'OMR',
      application_status: 'APPLIED',
      fin_voucher_trx_line_id: 'line-ca',
    });
    mockReverseCreditApplicationTx.mockResolvedValue({ restoredAmount: 8, status: 'REVERSED' });

    await reverseBizVoucher(TENANT, VOUCHER_ID, 'Customer refund', USER_ID);

    expect(mockRecalc).toHaveBeenCalledTimes(1);
    expect(mockRecalc).toHaveBeenCalledWith(mockTx, TENANT, ORDER_ID, {});
  });
});
