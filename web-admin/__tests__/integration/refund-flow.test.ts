/**
 * Integration test: refund flow — initiate → approve → process
 *
 * Verifies the three-step lifecycle against the current transactional refund
 * service shape.
 *
 * @jest-environment node
 *
 * Node env required: the service builds refund numbers with `Prisma.sql`
 * (fn_next_fin_doc_no), whose tag throws under the jsdom/browser Prisma build.
 */
/// <reference types="jest" />

const mockTransaction = jest.fn();
const mockOrderFind = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundCount = jest.fn();
const mockRefundCreate = jest.fn();
const mockRefundFind = jest.fn();
const mockRefundFindFirst = jest.fn();
const mockRefundUpdate = jest.fn();
const mockRefundFindMany = jest.fn();
const mockOutboxCreate = jest.fn();
const mockTopUpWallet = jest.fn();
const mockRecalculateSnapshot = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-refund-int')
  ),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: (...args: unknown[]) => mockTopUpWallet(...args),
  issueCreditNote: jest.fn().mockResolvedValue({ id: 'cn-1' }),
  issueCreditNoteTx: jest.fn().mockResolvedValue({ id: 'cn-tx-1' }),
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...args: unknown[]) => mockRecalculateSnapshot(...args),
}));

// CLF W4: a CASH refund always executes through a voucher, so the voucher
// services are mocked here; this suite asserts reopen / classification logic,
// order-refund-b9-execution.test.ts covers the execution branch itself.
jest.mock('@/lib/services/voucher-biz.service', () => ({
  createBizVoucher: jest.fn().mockResolvedValue({ id: 'vch-test', voucher_no: 'RFV-TEST' }),
}));
jest.mock('@/lib/services/voucher-line.service', () => ({
  addVoucherLine: jest.fn().mockResolvedValue({ id: 'vch-line-test', line_no: 1 }),
}));
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: jest.fn().mockResolvedValue({ voucherId: 'vch-test', fromCache: false }),
}));
jest.mock('@/lib/services/pos-session.service', () => ({
  assertOpenPosSessionForFinanceTx: jest.fn().mockResolvedValue(null),
}));

/** Drawer-session hint every CASH refund now needs (CLF W4). */
const CASH_EXECUTION = { enabled: false, cashDrawerSessionId: 'drawer-session-test' };

import { approveRefund, initiateRefund, processRefund } from '@/lib/services/order-refund.service';
import { Decimal } from '@prisma/client/runtime/library';

const TENANT = 'tenant-refund-int';
const ORDER = 'order-refund-int';
const REFUND = 'refund-refund-int';
const REQUESTER = 'staff-001';
const APPROVER = 'manager-001';

const makeOrder = (paid = 100, credits = 0) => ({
  id: ORDER,
  tenant_org_id: TENANT,
  order_no: 'ORD-INT-001',
  total_paid_amount: new Decimal(String(paid)),
  total_credit_applied_amount: new Decimal(String(credits)),
  customer_id: 'cust-1',
  currency_code: 'OMR',
});

const makeRefund = (status = 'PENDING_APPROVAL') => ({
  id: REFUND,
  tenant_org_id: TENANT,
  order_id: ORDER,
  refund_no: 'REF-000001',
  refund_amount: new Decimal('30'),
  refund_method_code: 'CASH',
  currency_code: 'OMR',
  refund_status: status,
  refund_source_type: 'GOODWILL_CONCESSION',
  refund_context: 'STANDARD',
  reopens_due_amount: new Decimal('0'),
  metadata: {},
  original_payment_id: null,
  original_credit_app_id: null,
});

function installTxMock() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txMock = {
      org_orders_mst: {
        findFirstOrThrow: mockOrderFind,
      },
      org_cash_drawer_movements_dtl: { findFirst: jest.fn().mockResolvedValue({ id: 'mvt-test' }) },
      org_order_refunds_dtl: {
        aggregate: mockRefundAggregate,
        count: mockRefundCount,
        create: mockRefundCreate,
        findFirst: mockRefundFindFirst,
        findFirstOrThrow: mockRefundFind,
        update: mockRefundUpdate,
        findMany: mockRefundFindMany,
      },
      org_order_payments_dtl: {
        findFirst: jest.fn(),
      },
      org_domain_events_outbox: {
        create: mockOutboxCreate,
      },
      // B14 — issueCorrectionTaxDocumentTx no-ops when there's no ISSUED
      // original tax document (the case for every tenant today).
      org_tax_documents_mst: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: mockQueryRaw,
    };

    return fn(txMock);
  });
}

describe('refund-flow integration — full lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installTxMock();
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
    mockRefundFindMany.mockResolvedValue([]);
    mockRecalculateSnapshot.mockResolvedValue({
      paymentStatus: 'PARTIALLY_PAID',
      outstandingAmount: 70,
    });
  });

  it('step 1: initiateRefund creates PENDING_APPROVAL record', async () => {
    mockOrderFind.mockResolvedValue(makeOrder(100));
    // Refund number now minted atomically via fn_next_fin_doc_no ($queryRaw).
    mockQueryRaw.mockResolvedValue([{ doc_no: 'REF-000001' }]);
    mockRefundCreate.mockResolvedValue(makeRefund('PENDING_APPROVAL'));

    const result = await initiateRefund(TENANT, {
      orderId: ORDER,
      amount: 30,
      reason: 'QUALITY',
      method: 'CASH',
      refundContext: 'STANDARD',
      notes: 'integration goodwill reason',
      requestedBy: REQUESTER,
      currencyCode: 'OMR',
      idempotencyKey: 'int-idem-1',
    });

    expect(result.refund_status).toBe('PENDING_APPROVAL');
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refund_status: 'PENDING_APPROVAL' }),
      })
    );
  });

  it('step 2: approveRefund moves status to APPROVED', async () => {
    mockRefundFind.mockResolvedValue(makeRefund('PENDING_APPROVAL'));
    mockRefundUpdate.mockResolvedValue({ ...makeRefund('APPROVED') });

    await approveRefund(TENANT, REFUND, APPROVER);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_status: 'APPROVED',
          approved_by: APPROVER,
        }),
      })
    );
  });

  it('step 3: processRefund routes CASH refund and emits outbox event', async () => {
    const refund = makeRefund('APPROVED');
    const order = makeOrder(100);
    mockRefundFind.mockResolvedValue(refund);
    mockOrderFind.mockResolvedValue(order);
    mockRefundUpdate.mockResolvedValue({ ...refund, refund_status: 'PROCESSED' });
    mockOutboxCreate.mockResolvedValue({});
    mockQueryRaw.mockResolvedValue([{ id: REFUND }]); // F-R2: FOR UPDATE lock acquired

    await processRefund(TENANT, REFUND, APPROVER, CASH_EXECUTION);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refund_status: 'PROCESSED' }),
      })
    );
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id: TENANT,
          event_type: 'REFUND_PROCESSED',
        }),
      })
    );
  });

  it('guard: initiateRefund rejects when amount > total paid', async () => {
    mockOrderFind.mockResolvedValue(makeOrder(20));

    await expect(
      initiateRefund(TENANT, {
        orderId: ORDER,
        amount: 50,
        reason: 'QUALITY',
        method: 'CASH',
        refundContext: 'STANDARD',
        notes: 'integration goodwill reason',
        requestedBy: REQUESTER,
        currencyCode: 'OMR',
        idempotencyKey: 'int-idem-2',
      })
    ).rejects.toThrow(/exceeds/i);
  });

  it('guard: approveRefund fails when refund not in PENDING_APPROVAL', async () => {
    mockRefundFind.mockRejectedValue(new Error('No record found matching PENDING_APPROVAL'));

    await expect(approveRefund(TENANT, 'already-approved', APPROVER)).rejects.toThrow();
  });
});
