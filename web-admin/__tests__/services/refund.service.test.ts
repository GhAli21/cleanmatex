/**
 * Tests: order-refund.service
 *
 * Covers:
 * - initiateRefund creates a PENDING_APPROVAL refund
 * - initiateRefund rejects above refundable balance
 * - approveRefund moves a refund to APPROVED
 * - approveRefund rejects when the refund is not awaiting approval
 */

const mockTransaction = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundCount = jest.fn();
const mockRefundCreate = jest.fn();
const mockRefundFindFirstOrThrow = jest.fn();
const mockRefundUpdate = jest.fn();
const mockRefundFindMany = jest.fn();
const mockOutboxCreate = jest.fn();

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
}));

import { approveRefund, initiateRefund } from '@/lib/services/order-refund.service';
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
  metadata: {},
});

const baseParams = {
  orderId: ORDER,
  amount: 30,
  reason: 'QUALITY' as const,
  method: 'CASH' as const,
  requestedBy: REQUESTER,
  currencyCode: 'OMR',
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
        }),
      })
    );
  });

  it('generates sequential refund number', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
    mockRefundCount.mockResolvedValue(4);
    mockRefundCreate.mockResolvedValue(makeRefundRecord());

    await initiateRefund(TENANT, baseParams);

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
});
