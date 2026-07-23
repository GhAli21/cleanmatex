/**
 * B9 — Refund Execution Parity: processRefund's CASH/ORIGINAL_METHOD
 * execution branch.
 *
 * Covers:
 *  - flag-off (execution omitted/false) preserves the exact pre-B9
 *    record-only behavior — no voucher, no drawer movement.
 *  - CASH execution: requires an OPEN drawer session, creates a REFUND_VOUCHER
 *    wired to a CASH_OUT movement, backfills the 3 lineage columns.
 *  - ORIGINAL_METHOD execution: requires a manual-settlement reference,
 *    creates a REFUND_VOUCHER (no drawer movement), backfills lineage +
 *    gateway_refund_id.
 *  - WALLET/CREDIT_NOTE destinations are untouched by the execution flag.
 *
 * @jest-environment node
 */

const mockTransaction = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundFindFirst = jest.fn();
const mockRefundFindFirstOrThrow = jest.fn();
const mockRefundUpdate = jest.fn();
const mockPaymentFindFirst = jest.fn();
const mockCreditAppFindFirst = jest.fn();
const mockOutboxCreate = jest.fn();
const mockQueryRaw = jest.fn();
const mockRecalculateSnapshot = jest.fn();
const mockCashDrawerSessionFindFirst = jest.fn();
const mockCashDrawerMovementFindFirst = jest.fn();
const mockAssertOpenPosSession = jest.fn().mockResolvedValue(null);

const mockCreateBizVoucher = jest.fn();
const mockAddVoucherLine = jest.fn();
const mockPostAndWireBizVoucher = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: jest.fn().mockResolvedValue({}),
  issueCreditNote: jest.fn().mockResolvedValue({ id: 'cn-1' }),
  issueCreditNoteTx: jest.fn().mockResolvedValue({ id: 'cn-tx-1' }),
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...args: unknown[]) => mockRecalculateSnapshot(...args),
}));

jest.mock('@/lib/services/pos-session.service', () => ({
  assertOpenPosSessionForFinanceTx: (...args: unknown[]) => mockAssertOpenPosSession(...args),
}));

jest.mock('@/lib/services/voucher-biz.service', () => ({
  createBizVoucher: (...args: unknown[]) => mockCreateBizVoucher(...args),
}));

jest.mock('@/lib/services/voucher-line.service', () => ({
  addVoucherLine: (...args: unknown[]) => mockAddVoucherLine(...args),
}));

jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...args: unknown[]) => mockPostAndWireBizVoucher(...args),
}));

import { processRefund, RefundValidationError } from '@/lib/services/order-refund.service';
import { REFUND_CONTEXTS, REFUND_ERROR_CODES, REFUND_SOURCE_TYPES } from '@/lib/constants/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

const TENANT = 'tenant-b9';
const ORDER = 'order-b9';
const REFUND = 'refund-b9';
const PAYMENT = 'payment-b9';
const PROCESSOR = 'manager-b9';
const DRAWER_SESSION = 'drawer-session-b9';

const makeOrder = () => ({
  id: ORDER,
  tenant_org_id: TENANT,
  order_no: 'ORD-B9',
  customer_id: 'cust-b9',
  branch_id: 'branch-b9',
  currency_code: 'OMR',
  total_paid_amount: new Decimal('100'),
  total_credit_applied_amount: new Decimal('0'),
});

const makeApprovedRefund = (overrides: Record<string, unknown> = {}) => ({
  id: REFUND,
  tenant_org_id: TENANT,
  order_id: ORDER,
  refund_no: 'REF-B9',
  refund_amount: new Decimal('30'),
  refund_method_code: 'CASH',
  currency_code: 'OMR',
  refund_status: 'APPROVED',
  refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
  refund_context: REFUND_CONTEXTS.STANDARD,
  original_payment_id: PAYMENT,
  original_credit_app_id: null,
  reopens_due_amount: new Decimal('0'),
  metadata: {},
  ...overrides,
});

function installTxMock() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txMock = {
      org_orders_mst: { findFirstOrThrow: mockOrderFindFirstOrThrow },
      org_order_refunds_dtl: {
        aggregate: mockRefundAggregate,
        findFirst: mockRefundFindFirst,
        findFirstOrThrow: mockRefundFindFirstOrThrow,
        update: mockRefundUpdate,
      },
      org_order_payments_dtl: { findFirst: mockPaymentFindFirst },
      org_order_credit_apps_dtl: { findFirst: mockCreditAppFindFirst },
      org_domain_events_outbox: { create: mockOutboxCreate },
      org_cash_drawer_sessions_mst: { findFirst: mockCashDrawerSessionFindFirst },
      org_cash_drawer_movements_dtl: { findFirst: mockCashDrawerMovementFindFirst },
      $queryRaw: mockQueryRaw,
    };
    return fn(txMock);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  installTxMock();
  mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
  mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder());
  mockQueryRaw.mockResolvedValue([{ id: REFUND }]); // FOR UPDATE lock
  mockRefundUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: REFUND,
    ...args.data,
  }));
  mockRecalculateSnapshot.mockResolvedValue({ paymentStatus: 'PAID', outstandingAmount: 70 });
  mockPaymentFindFirst.mockResolvedValue({ id: PAYMENT, amount: new Decimal('100') });
  mockCreateBizVoucher.mockResolvedValue({ id: 'vch-b9', voucher_no: 'RFV-1' });
  mockAddVoucherLine.mockResolvedValue({ id: 'line-b9', line_no: 1 });
  mockPostAndWireBizVoucher.mockResolvedValue({ voucherId: 'vch-b9', fromCache: false });
  mockCashDrawerSessionFindFirst.mockResolvedValue({ id: DRAWER_SESSION });
  mockCashDrawerMovementFindFirst.mockResolvedValue({ id: 'mvt-b9' });
});

describe('processRefund — B9 execution flag off (record-only, backward compatible)', () => {
  it('CASH refund with no execution param: no voucher, no drawer check, no lineage backfill', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeApprovedRefund());

    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
    expect(mockAddVoucherLine).not.toHaveBeenCalled();
    expect(mockPostAndWireBizVoucher).not.toHaveBeenCalled();
    expect(mockRefundUpdate).toHaveBeenCalledTimes(1);
    expect(mockRefundUpdate.mock.calls[0][0].data).not.toHaveProperty('fin_voucher_id');
  });

  it('CASH refund with execution.enabled=false: same record-only behavior', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeApprovedRefund());

    await processRefund(TENANT, REFUND, PROCESSOR, { enabled: false });

    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });
});

describe('processRefund — B9 execution flag on, CASH destination', () => {
  it('requires a cash-drawer session', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeApprovedRefund());

    await expect(
      processRefund(TENANT, REFUND, PROCESSOR, { enabled: true }),
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_CASH_DRAWER_SESSION_REQUIRED });
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('rejects a drawer session that is not OPEN', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeApprovedRefund());
    mockCashDrawerSessionFindFirst.mockResolvedValue(null);

    await expect(
      processRefund(TENANT, REFUND, PROCESSOR, {
        enabled: true,
        cashDrawerSessionId: DRAWER_SESSION,
      }),
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_CASH_DRAWER_SESSION_NOT_OPEN });
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('creates a REFUND_VOUCHER wired to a CASH_OUT movement and backfills lineage', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeApprovedRefund({ refund_amount: new Decimal('30') }));

    await processRefund(TENANT, REFUND, PROCESSOR, {
      enabled: true,
      cashDrawerSessionId: DRAWER_SESSION,
    });

    expect(mockCreateBizVoucher).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({
        voucher_type: 'REFUND_VOUCHER',
        direction: 'OUT',
        party_type: 'CUSTOMER',
        order_id: ORDER,
        total_amount: 30,
        idempotency_key: `refund-${REFUND}-vch`,
      }),
      PROCESSOR,
      expect.anything(),
    );
    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT,
      'vch-b9',
      expect.objectContaining({
        line_role: 'ORDER_REFUND',
        direction: 'OUT',
        payment_method_code: 'CASH',
        amount: 30,
        cash_drawer_session_id: DRAWER_SESSION,
        idempotency_key: `refund-${REFUND}-vch-line`,
      }),
      PROCESSOR,
      undefined,
      expect.anything(),
    );
    expect(mockPostAndWireBizVoucher).toHaveBeenCalledWith(
      TENANT, 'vch-b9', PROCESSOR, `refund-${REFUND}-vch-post`, expect.anything(),
    );
    // Two updates: the lineage backfill, then the PROCESSED status update.
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fin_voucher_id: 'vch-b9',
          fin_voucher_trx_line_id: 'line-b9',
          cash_drawer_movement_id: 'mvt-b9',
        }),
      }),
    );
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refund_status: 'PROCESSED' }) }),
    );
  });
});

describe('processRefund — B9 execution flag on, ORIGINAL_METHOD destination', () => {
  it('requires a manual settlement reference', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_method_code: 'ORIGINAL_METHOD' }),
    );

    await expect(
      processRefund(TENANT, REFUND, PROCESSOR, { enabled: true }),
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_MANUAL_SETTLEMENT_REFERENCE_REQUIRED });
    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });

  it('creates a REFUND_VOUCHER carrying the manual reference, no drawer movement', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_method_code: 'ORIGINAL_METHOD', refund_amount: new Decimal('30') }),
    );

    await processRefund(TENANT, REFUND, PROCESSOR, {
      enabled: true,
      manualSettlementReference: '  BANK-REF-42  ',
    });

    expect(mockAddVoucherLine).toHaveBeenCalledWith(
      TENANT,
      'vch-b9',
      expect.objectContaining({
        payment_method_code: 'ORIGINAL_METHOD',
        gateway_reference: 'BANK-REF-42',
      }),
      PROCESSOR,
      undefined,
      expect.anything(),
    );
    expect(mockCashDrawerSessionFindFirst).not.toHaveBeenCalled();
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fin_voucher_id: 'vch-b9',
          fin_voucher_trx_line_id: 'line-b9',
          gateway_refund_id: 'BANK-REF-42',
        }),
      }),
    );
  });
});

describe('processRefund — B9 execution flag on, non-refund-voucher destinations untouched', () => {
  it('WALLET destination never calls createBizVoucher even with execution.enabled=true', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_method_code: 'WALLET', refund_source_type: 'WALLET_RESTORE' }),
    );

    await processRefund(TENANT, REFUND, PROCESSOR, { enabled: true });

    expect(mockCreateBizVoucher).not.toHaveBeenCalled();
  });
});
