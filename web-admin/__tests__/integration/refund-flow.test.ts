/// <reference types="jest" />
/**
 * Integration test: refund flow — initiate → approve → process
 *
 * Verifies the three-step lifecycle:
 * 1. initiateRefund  — creates PENDING_APPROVAL record
 * 2. approveRefund   — moves to APPROVED
 * 3. processRefund   — routes refund back via method, emits outbox event
 *
 * Cross-cutting concerns:
 * - Amount cannot exceed total_paid
 * - Status guard: approve requires PENDING_APPROVAL
 * - Outbox REFUND_PROCESSED event is emitted after processing
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrderFind     = jest.fn();
const mockRefundCount   = jest.fn();
const mockRefundCreate  = jest.fn();
const mockRefundFind    = jest.fn();
const mockRefundUpdate  = jest.fn();
const mockOutboxCreate  = jest.fn();
const mockTransaction   = jest.fn();
const mockTopUpWallet   = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    org_orders_mst: {
      findFirstOrThrow: (...a: unknown[]) => mockOrderFind(...a),
    },
    org_order_refunds_dtl: {
      count:            (...a: unknown[]) => mockRefundCount(...a),
      create:           (...a: unknown[]) => mockRefundCreate(...a),
      findFirstOrThrow: (...a: unknown[]) => mockRefundFind(...a),
      update:           (...a: unknown[]) => mockRefundUpdate(...a),
    },
    org_domain_events_outbox: {
      create: (...a: unknown[]) => mockOutboxCreate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-refund-int')
  ),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx:   (...a: unknown[]) => mockTopUpWallet(...a),
  issueCreditNote: jest.fn().mockResolvedValue({ id: 'cn-1' }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { initiateRefund, approveRefund, processRefund } from '@/lib/services/order-refund.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT    = 'tenant-refund-int';
const ORDER     = 'order-refund-int';
const REFUND    = 'refund-refund-int';
const REQUESTER = 'staff-001';
const APPROVER  = 'manager-001';

const makeOrder = (paid = 100) => ({
  id: ORDER, tenant_org_id: TENANT, order_no: 'ORD-INT-001',
  total_paid_amount: new Decimal(String(paid)),
  customer_id: 'cust-1',
});

const makeRefund = (status = 'PENDING_APPROVAL') => ({
  id: REFUND, tenant_org_id: TENANT, order_id: ORDER,
  refund_no: 'REF-000001', refund_amount: new Decimal('30'),
  refund_method_code: 'CASH', currency_code: 'OMR',
  refund_status: status, customer_id: 'cust-1',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('refund-flow integration — full lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('step 1: initiateRefund creates PENDING_APPROVAL record', async () => {
    mockOrderFind.mockResolvedValue(makeOrder(100));
    mockRefundCount.mockResolvedValue(0);
    mockRefundCreate.mockResolvedValue(makeRefund('PENDING_APPROVAL'));

    const result = await initiateRefund(TENANT, {
      orderId: ORDER, amount: 30, reason: 'QUALITY_ISSUE',
      method: 'CASH', requestedBy: REQUESTER, currencyCode: 'OMR',
    });

    expect(result.refund_status).toBe('PENDING_APPROVAL');
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refund_status: 'PENDING_APPROVAL' }) })
    );
  });

  it('step 2: approveRefund moves status to APPROVED', async () => {
    mockRefundFind.mockResolvedValue(makeRefund('PENDING_APPROVAL'));
    mockRefundUpdate.mockResolvedValue({ ...makeRefund('APPROVED') });

    await approveRefund(TENANT, REFUND, APPROVER);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refund_status: 'APPROVED', approved_by: APPROVER }),
      })
    );
  });

  it('step 3: processRefund routes CASH refund and emits outbox event', async () => {
    const refund = makeRefund('APPROVED');
    const order  = makeOrder(100);
    mockRefundUpdate.mockResolvedValue({ ...refund, refund_status: 'PROCESSED' });
    mockOutboxCreate.mockResolvedValue({});

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        org_order_refunds_dtl: {
          findFirstOrThrow: jest.fn().mockResolvedValue(refund),
          update: mockRefundUpdate,
        },
        org_orders_mst: {
          findFirstOrThrow: jest.fn().mockResolvedValue(order),
          update: jest.fn().mockResolvedValue(order),
        },
        org_domain_events_outbox: { create: mockOutboxCreate },
      };
      return fn(txMock);
    });

    await processRefund(TENANT, REFUND);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refund_status: 'PROCESSED' }) })
    );
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id: TENANT,
          event_type:    'REFUND_PROCESSED',
        }),
      })
    );
  });

  it('guard: initiateRefund rejects when amount > total_paid', async () => {
    mockOrderFind.mockResolvedValue(makeOrder(20));

    await expect(
      initiateRefund(TENANT, {
        orderId: ORDER, amount: 50, reason: 'QUALITY_ISSUE',
        method: 'CASH', requestedBy: REQUESTER, currencyCode: 'OMR',
      })
    ).rejects.toThrow(/exceeds/i);
  });

  it('guard: approveRefund fails when refund not in PENDING_APPROVAL', async () => {
    mockRefundFind.mockRejectedValue(new Error('No record found matching PENDING_APPROVAL'));

    await expect(approveRefund(TENANT, 'already-approved', APPROVER)).rejects.toThrow();
  });
});
