/**
 * Tests: customer-receipt-posting.service (CLF W6)
 *
 * The receipt is a RECEIPT_VOUCHER with ONE CUSTOMER_CREDIT_RECEIPT line posted
 * through postAndWireBizVoucher in INTERACTIVE mode (the cash-drawer ledger
 * gate decides the drawer). The allocation executor stays the only writer of
 * business effects. No direct drawer-movement writes, no header-only POSTED.
 */

const mockVoucherFindFirst = jest.fn();
const mockVoucherUpdateMany = jest.fn();
const mockMethodFindFirst = jest.fn();
const mockMovementCreate = jest.fn();

const mockTx = {
  org_fin_vouchers_mst: {
    findFirst: (...a: unknown[]) => mockVoucherFindFirst(...a),
    updateMany: (...a: unknown[]) => mockVoucherUpdateMany(...a),
  },
  org_payment_methods_cf: { findFirst: (...a: unknown[]) => mockMethodFindFirst(...a) },
  org_cash_drawer_movements_dtl: { create: (...a: unknown[]) => mockMovementCreate(...a) },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

const mockCreateBizVoucher = jest.fn();
jest.mock('@/lib/services/voucher-biz.service', () => ({
  createBizVoucher: (...a: unknown[]) => mockCreateBizVoucher(...a),
}));

const mockAddVoucherLine = jest.fn();
jest.mock('@/lib/services/voucher-line.service', () => ({
  addVoucherLine: (...a: unknown[]) => mockAddVoucherLine(...a),
}));

const mockPostAndWire = jest.fn();
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...a: unknown[]) => mockPostAndWire(...a),
}));

const mockExecuteAllocation = jest.fn();
jest.mock('@/lib/services/customer-receipt-excess-executor.service', () => ({
  executeAllocationPreviewTx: (...a: unknown[]) => mockExecuteAllocation(...a),
}));

const mockGetPreview = jest.fn();
jest.mock('@/lib/services/customer-receipt-allocation-preview.service', () => ({
  getAllocationPreview: (...a: unknown[]) => mockGetPreview(...a),
}));

jest.mock('@/lib/services/customer-receipt-allocation-validator.service', () => ({
  validateAllocationPreview: jest.fn(),
}));

jest.mock('@/lib/services/customer-receipt-allocation-policy.service', () => ({
  resolveReceiptAllocationPolicy: jest.fn().mockResolvedValue({}),
}));

import { postCustomerAccountReceipt } from '@/lib/services/customer-receipt-posting.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = 'user-1';
const CUSTOMER = '33333333-3333-3333-3333-333333333333';
const PREVIEW = '55555555-5555-5555-5555-555555555555';
const METHOD = '66666666-6666-6666-6666-666666666666';
const SESSION = '77777777-7777-7777-7777-777777777777';

const baseInput = {
  customerId: CUSTOMER,
  previewId: PREVIEW,
  paymentMethodId: METHOD,
  receiptAmount: 30,
  currencyCode: 'OMR',
  idempotencyKey: `car_${PREVIEW}`,
};

function method(code: string, requiresDrawer = code === 'CASH') {
  return { id: METHOD, payment_method_code: code, requires_cash_drawer: requiresDrawer, gateway_code: null };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVoucherFindFirst.mockResolvedValue(null);
  mockGetPreview.mockResolvedValue({
    previewStatus: 'CONFIRMED',
    receiptAmount: 30,
    remainingUnallocatedAmount: 0,
  });
  mockMethodFindFirst.mockResolvedValue(method('CASH'));
  mockCreateBizVoucher.mockResolvedValue({ id: 'vch-1', voucher_no: 'RV-0001' });
  mockAddVoucherLine.mockResolvedValue({ id: 'line-1', line_no: 1 });
  mockPostAndWire.mockResolvedValue({ voucherId: 'vch-1' });
  mockExecuteAllocation.mockResolvedValue(undefined);
});

describe('postCustomerAccountReceipt', () => {
  it('creates one CUSTOMER_CREDIT_RECEIPT line and posts through the gate in INTERACTIVE mode', async () => {
    const result = await postCustomerAccountReceipt(TENANT, USER, {
      ...baseInput,
      cashTendered: 50,
      cashDrawerSessionId: SESSION,
    });

    expect(result).toEqual({ voucherId: 'vch-1', voucherNo: 'RV-0001', previewId: PREVIEW, receiptAmount: 30 });

    expect(mockCreateBizVoucher).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        voucher_type: 'RECEIPT_VOUCHER',
        source_ref_type: 'CUSTOMER_ACCOUNT_PAYMENT',
        total_amount: 30,
        idempotency_key: baseInput.idempotencyKey,
      }),
      USER,
      mockTx,
    );

    expect(mockAddVoucherLine).toHaveBeenCalledTimes(1);
    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT,
      'vch-1',
      expect.objectContaining({
        line_type: 'RECEIPT',
        line_role: 'CUSTOMER_CREDIT_RECEIPT',
        direction: 'IN',
        target_type: 'CUSTOMER',
        target_id: CUSTOMER,
        customer_id: CUSTOMER,
        payment_method_code: 'CASH',
        org_payment_method_id: METHOD,
        payment_status: 'COMPLETED',
        amount: 30,
        currency_code: 'OMR',
        cash_drawer_session_id: SESSION,
        tendered_amount: 50,
        idempotency_key: `${baseInput.idempotencyKey}_line`,
      }),
      USER,
      undefined,
      mockTx,
    );

    expect(mockExecuteAllocation).toHaveBeenCalledWith(
      expect.objectContaining({ tx: mockTx, voucherId: 'vch-1', previewId: PREVIEW, paymentMethodCode: 'CASH' }),
    );
    expect(mockPostAndWire).toHaveBeenCalledWith(
      TENANT,
      'vch-1',
      USER,
      'INTERACTIVE',
      `${baseInput.idempotencyKey}_vch_post`,
      mockTx,
    );
  });

  it('never writes drawer movements or flips the header to POSTED itself', async () => {
    await postCustomerAccountReceipt(TENANT, USER, { ...baseInput, cashDrawerSessionId: SESSION });
    expect(mockMovementCreate).not.toHaveBeenCalled();
    expect(mockVoucherUpdateMany).not.toHaveBeenCalled();
  });

  it('defaults tendered cash to the receipt amount when none is given', async () => {
    await postCustomerAccountReceipt(TENANT, USER, baseInput);
    expect(mockAddVoucherLine.mock.calls[0][2]).toEqual(expect.objectContaining({ tendered_amount: 30 }));
  });

  it('does not pass a session hint when the method is not drawer-tracked', async () => {
    mockMethodFindFirst.mockResolvedValue(method('CARD', false));
    await postCustomerAccountReceipt(TENANT, USER, { ...baseInput, cashDrawerSessionId: SESSION });
    const line = mockAddVoucherLine.mock.calls[0][2];
    expect(line.cash_drawer_session_id).toBeUndefined();
    expect(line.tendered_amount).toBeUndefined();
  });

  it('passes bank reference / cheque details onto the line', async () => {
    mockMethodFindFirst.mockResolvedValue(method('BANK_TRANSFER', false));
    await postCustomerAccountReceipt(TENANT, USER, { ...baseInput, bankReference: ' TRX-9 ' });
    expect(mockAddVoucherLine.mock.calls[0][2]).toEqual(expect.objectContaining({ bank_reference: 'TRX-9' }));

    mockMethodFindFirst.mockResolvedValue(method('CHECK', false));
    await postCustomerAccountReceipt(TENANT, USER, {
      ...baseInput,
      checkNumber: '1001',
      checkBank: 'Bank Muscat',
      checkDate: '2026-10-01',
    });
    expect(mockAddVoucherLine.mock.calls[1][2]).toEqual(
      expect.objectContaining({ check_number: '1001', check_bank: 'Bank Muscat', check_date: '2026-10-01' }),
    );
  });

  it('returns the existing voucher for a repeated idempotency key without posting again', async () => {
    mockVoucherFindFirst.mockResolvedValue({ id: 'vch-old', voucher_no: 'RV-0000' });
    const result = await postCustomerAccountReceipt(TENANT, USER, baseInput);
    expect(result.voucherId).toBe('vch-old');
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
    expect(mockPostAndWire).not.toHaveBeenCalled();
  });

  it.each([
    ['CUSTOMER_RECEIPT_METHOD_UNAVAILABLE', () => mockMethodFindFirst.mockResolvedValue(null), {}],
    ['CUSTOMER_RECEIPT_CASH_TENDERED_TOO_LOW', () => undefined, { cashTendered: 10 }],
    ['CUSTOMER_RECEIPT_BANK_REFERENCE_REQUIRED', () => mockMethodFindFirst.mockResolvedValue(method('BANK_TRANSFER', false)), { bankReference: '  ' }],
    ['CUSTOMER_RECEIPT_CHECK_DETAILS_REQUIRED', () => mockMethodFindFirst.mockResolvedValue(method('CHECK', false)), { checkNumber: '1', checkBank: 'X' }],
  ])('rejects with %s before creating anything', async (code, arrange, extra) => {
    arrange();
    await expect(postCustomerAccountReceipt(TENANT, USER, { ...baseInput, ...extra })).rejects.toThrow(code);
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
    expect(mockPostAndWire).not.toHaveBeenCalled();
  });

  it.each([
    ['RECEIPT_ALLOCATION_IDEMPOTENCY_CONFLICT', { previewStatus: 'POSTED', receiptAmount: 30, remainingUnallocatedAmount: 0 }],
    ['RECEIPT_ALLOCATION_BLOCKED', { previewStatus: 'DRAFT', receiptAmount: 30, remainingUnallocatedAmount: 0 }],
    ['RECEIPT_ALLOCATION_UNBALANCED', { previewStatus: 'CONFIRMED', receiptAmount: 25, remainingUnallocatedAmount: 0 }],
    ['RECEIPT_ALLOCATION_EXCESS_UNRESOLVED', { previewStatus: 'CONFIRMED', receiptAmount: 30, remainingUnallocatedAmount: 5 }],
  ])('rejects preview state %s', async (code, preview) => {
    mockGetPreview.mockResolvedValue(preview);
    await expect(postCustomerAccountReceipt(TENANT, USER, baseInput)).rejects.toThrow(code);
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('propagates a gate refusal from posting (the whole transaction rolls back)', async () => {
    const refusal = Object.assign(new Error('refused'), { code: 'CASH_DRAWER_SESSION_NOT_OPEN' });
    mockPostAndWire.mockRejectedValue(refusal);
    await expect(postCustomerAccountReceipt(TENANT, USER, baseInput)).rejects.toBe(refusal);
  });
});
