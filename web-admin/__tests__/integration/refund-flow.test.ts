/// <reference types="jest" />
/**
 * Integration test: refund flow — initiate → approve → process
 *
 * Verifies the three-step lifecycle against the current transactional refund
 * service shape.
 */

const mockTransaction = jest.fn();
const mockOrderFind = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundCount = jest.fn();
const mockRefundCreate = jest.fn();
const mockRefundFind = jest.fn();
const mockRefundUpdate = jest.fn();
const mockRefundFindMany = jest.fn();
const mockOutboxCreate = jest.fn();
const mockTopUpWallet = jest.fn();
const mockRecalculateSnapshot = jest.fn();

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
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...args: unknown[]) => mockRecalculateSnapshot(...args),
}));

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
  metadata: {},
  original_payment_id: null,
});

function installTxMock() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txMock = {
      org_orders_mst: {
        findFirstOrThrow: mockOrderFind,
      },
      org_order_refunds_dtl: {
        aggregate: mockRefundAggregate,
        count: mockRefundCount,
        create: mockRefundCreate,
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
    mockRefundCount.mockResolvedValue(0);
    mockRefundCreate.mockResolvedValue(makeRefund('PENDING_APPROVAL'));

    const result = await initiateRefund(TENANT, {
      orderId: ORDER,
      amount: 30,
      reason: 'QUALITY',
      method: 'CASH',
      requestedBy: REQUESTER,
      currencyCode: 'OMR',
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

    await processRefund(TENANT, REFUND, APPROVER);

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
        requestedBy: REQUESTER,
        currencyCode: 'OMR',
      })
    ).rejects.toThrow(/exceeds/i);
  });

  it('guard: approveRefund fails when refund not in PENDING_APPROVAL', async () => {
    mockRefundFind.mockRejectedValue(new Error('No record found matching PENDING_APPROVAL'));

    await expect(approveRefund(TENANT, 'already-approved', APPROVER)).rejects.toThrow();
  });
});
