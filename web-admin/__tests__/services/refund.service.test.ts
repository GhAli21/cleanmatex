/**
 * Tests: order-refund.service
 *
 * Covers:
 * - initiateRefund creates a PENDING_APPROVAL refund
 * - initiateRefund rejects above refundable balance
 * - approveRefund moves a refund to APPROVED
 * - approveRefund rejects when the refund is not awaiting approval
 *
 * @jest-environment node
 *
 * Node env required: the service builds refund numbers with `Prisma.sql`
 * (fn_next_fin_doc_no), whose tag throws under the jsdom/browser Prisma build.
 */

const mockTransaction = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundCount = jest.fn();
const mockRefundCreate = jest.fn();
const mockRefundFindFirst = jest.fn();
const mockRefundFindFirstOrThrow = jest.fn();
const mockRefundUpdate = jest.fn();
const mockRefundFindMany = jest.fn();
const mockOutboxCreate = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

const mockTopUpWalletTx = jest.fn().mockResolvedValue({});
const mockIssueCreditNoteTx = jest.fn().mockResolvedValue({ id: 'cn-tx-1' });
jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: (...args: unknown[]) => mockTopUpWalletTx(...args),
  issueCreditNote: jest.fn().mockResolvedValue({ id: 'cn-1' }),
  issueCreditNoteTx: (...args: unknown[]) => mockIssueCreditNoteTx(...args),
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: jest
    .fn()
    .mockResolvedValue({ paymentStatus: 'REFUNDED', outstandingAmount: 0 }),
}));

import { approveRefund, initiateRefund, processRefund } from '@/lib/services/order-refund.service';
import { Decimal } from '@prisma/client/runtime/library';

const TENANT = 'tenant-ref-001';
const ORDER = 'order-ref-001';
const REFUND = 'refund-ref-001';
const REQUESTER = 'staff-001';
const APPROVER = 'manager-001';

const makeOrder = (totalPaid = 100, totalCredit = 0) => ({
  id: ORDER,
  tenant_org_id: TENANT,
  order_no: 'ORD-001',
  customer_id: 'cust-001',
  currency_code: 'OMR',
  total_paid_amount: new Decimal(String(totalPaid)),
  total_credit_applied_amount: new Decimal(String(totalCredit)),
});

const makeRefundRecord = (status = 'PENDING_APPROVAL') => ({
  id: REFUND,
  tenant_org_id: TENANT,
  order_id: ORDER,
  refund_status: status,
  refund_amount: new Decimal('30'),
  refund_method_code: 'CASH',
  currency_code: 'OMR',
  refund_source_type: 'GOODWILL_CONCESSION',
  refund_context: 'STANDARD',
  original_payment_id: null,
  original_credit_app_id: null,
  reopens_due_amount: new Decimal('0'),
  metadata: {},
});

// B01: refundContext + idempotencyKey are mandatory; no lineage + a reason
// note derives GOODWILL_CONCESSION (D002 v2).
const baseParams = {
  orderId: ORDER,
  amount: 30,
  reason: 'QUALITY' as const,
  method: 'CASH' as const,
  refundContext: 'STANDARD' as const,
  notes: 'goodwill test reason',
  requestedBy: REQUESTER,
  currencyCode: 'OMR',
  idempotencyKey: 'idem-base',
};

function installTxMock() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txMock = {
      org_orders_mst: {
        findFirstOrThrow: mockOrderFindFirstOrThrow,
      },
      org_order_refunds_dtl: {
        aggregate: mockRefundAggregate,
        count: mockRefundCount,
        create: mockRefundCreate,
        findFirst: mockRefundFindFirst,
        findFirstOrThrow: mockRefundFindFirstOrThrow,
        update: mockRefundUpdate,
        findMany: mockRefundFindMany,
      },
      org_order_payments_dtl: {
        findFirst: jest.fn(),
      },
      org_domain_events_outbox: {
        create: mockOutboxCreate,
      },
      $queryRaw: mockQueryRaw,
    };

    return fn(txMock);
  });
}

describe('order-refund.service — initiateRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installTxMock();
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
    mockRefundFindMany.mockResolvedValue([]);
    // Refund number now comes from the atomic fn_next_fin_doc_no via $queryRaw (F-R3).
    mockQueryRaw.mockResolvedValue([{ doc_no: 'REF-000001' }]);
  });

  it('creates a refund with PENDING_APPROVAL status', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
    mockRefundCount.mockResolvedValue(0);
    mockRefundCreate.mockResolvedValue(makeRefundRecord());

    const result = await initiateRefund(TENANT, baseParams);

    expect(result).toMatchObject({ refund_status: 'PENDING_APPROVAL' });
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_status: 'PENDING_APPROVAL',
          refund_amount: 30,
          tenant_org_id: TENANT,
          reason_code: 'QUALITY',
          // B01: the service is the only classifier — no lineage + reason
          // note derives GOODWILL_CONCESSION; context is stamped verbatim.
          refund_source_type: 'GOODWILL_CONCESSION',
          refund_context: 'STANDARD',
        }),
      })
    );
  });

  it('mints the refund number atomically via fn_next_fin_doc_no (no count(*) race)', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
    // The atomic finance doc-sequence returns the next formatted number.
    mockQueryRaw.mockResolvedValue([{ doc_no: 'REF-000005' }]);
    mockRefundCreate.mockResolvedValue(makeRefundRecord());

    await initiateRefund(TENANT, baseParams);

    // Number comes from the locked sequence, not org_order_refunds_dtl.count().
    expect(mockRefundCount).not.toHaveBeenCalled();
    const createArg = mockRefundCreate.mock.calls[0][0];
    expect(createArg.data.refund_no).toBe('REF-000005');
  });

  it('throws when refund amount exceeds refundable balance', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(20));

    await expect(initiateRefund(TENANT, { ...baseParams, amount: 50 })).rejects.toThrow(
      /exceeds refundable balance/i
    );
  });
});

describe('order-refund.service — approveRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installTxMock();
  });

  it('moves refund status to APPROVED', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeRefundRecord('PENDING_APPROVAL'));
    mockRefundUpdate.mockResolvedValue({ ...makeRefundRecord('APPROVED') });

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

  it('throws when refund is not in PENDING_APPROVAL', async () => {
    mockRefundFindFirstOrThrow.mockRejectedValue(new Error('No refund found'));

    await expect(approveRefund(TENANT, REFUND, APPROVER)).rejects.toThrow();
  });

  it('blocks self-approval (B34 maker≠checker) with the typed 403 code', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue({
      ...makeRefundRecord('PENDING_APPROVAL'),
      created_by: APPROVER, // approver is the requester
    });

    await expect(approveRefund(TENANT, REFUND, APPROVER)).rejects.toMatchObject({
      code: 'REFUND_SELF_APPROVAL_BLOCKED',
      httpStatus: 403,
    });
    expect(mockRefundUpdate).not.toHaveBeenCalled();
  });

  it('allows a different user to approve (maker≠checker satisfied)', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue({
      ...makeRefundRecord('PENDING_APPROVAL'),
      created_by: REQUESTER,
    });
    mockRefundUpdate.mockResolvedValue({ ...makeRefundRecord('APPROVED') });

    await expect(approveRefund(TENANT, REFUND, APPROVER)).resolves.toMatchObject({
      refund_status: 'APPROVED',
    });
  });
});

// F-R1 (D-12 §4): keyed retries must replay the existing refund, not create a second.
describe('order-refund.service — initiateRefund idempotency (F-R1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installTxMock();
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
    mockRefundFindMany.mockResolvedValue([]);
    mockRefundFindFirst.mockResolvedValue(null);
  });

  it('returns the existing refund and skips create when the idempotency key already exists', async () => {
    const existing = { ...makeRefundRecord('APPROVED'), idempotency_key: 'idem-1' };
    mockRefundFindFirst.mockResolvedValue(existing);

    const result = await initiateRefund(TENANT, { ...baseParams, idempotencyKey: 'idem-1' });

    expect(result).toBe(existing);
    expect(mockRefundFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_org_id: TENANT, idempotency_key: 'idem-1' }),
      })
    );
    expect(mockRefundCreate).not.toHaveBeenCalled(); // no duplicate row
  });

  it('proceeds to create when no prior refund matches the idempotency key', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
    mockRefundCount.mockResolvedValue(0);
    mockRefundCreate.mockResolvedValue(makeRefundRecord());
    mockRefundFindFirst.mockResolvedValue(null);

    await initiateRefund(TENANT, { ...baseParams, idempotencyKey: 'idem-new' });

    expect(mockRefundCreate).toHaveBeenCalledTimes(1);
  });
});

// F-R2 (D-12 §4): processRefund must lock the row + issue stored value idempotently.
describe('order-refund.service — processRefund concurrency + idempotency (F-R2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installTxMock();
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
    mockQueryRaw.mockResolvedValue([{ id: REFUND }]); // lock acquired
    mockRefundUpdate.mockResolvedValue(makeRefundRecord('PROCESSED'));
  });

  it('acquires a FOR UPDATE lock before issuing and aborts when the row is no longer APPROVED', async () => {
    mockQueryRaw.mockResolvedValue([]); // lock returns no APPROVED row (already processed)

    await expect(processRefund(TENANT, REFUND, APPROVER)).rejects.toThrow(/not awaiting processing/i);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockRefundFindFirstOrThrow).not.toHaveBeenCalled();
    expect(mockTopUpWalletTx).not.toHaveBeenCalled();
    expect(mockIssueCreditNoteTx).not.toHaveBeenCalled();
  });

  it('issues a CREDIT_NOTE via the tx-composed, idempotent writer with a per-refund key', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue({ ...makeRefundRecord('APPROVED'), refund_method_code: 'CREDIT_NOTE' });

    await processRefund(TENANT, REFUND, APPROVER);

    expect(mockIssueCreditNoteTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: `refund-${REFUND}-cn`, tenantId: TENANT })
    );
  });

  it('tops up the WALLET only after acquiring the FOR UPDATE lock (the wallet-path guard)', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue({ ...makeRefundRecord('APPROVED'), refund_method_code: 'WALLET' });

    await processRefund(TENANT, REFUND, APPROVER);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1); // lock acquired before issuing
    // B01 §12: the wallet destination now carries its own idempotency key
    // (defense-in-depth beside the FOR UPDATE lock).
    expect(mockTopUpWalletTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        amount: 30,
        idempotencyKey: `refund-${REFUND}-wallet`,
      })
    );
  });

  it('writes reopens_due_amount = 0 for a STANDARD commercial refund (D003 v2)', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeRefundRecord('APPROVED'));

    await processRefund(TENANT, REFUND, APPROVER);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_status: 'PROCESSED',
          reopens_due_amount: 0,
        }),
      })
    );
  });
});
