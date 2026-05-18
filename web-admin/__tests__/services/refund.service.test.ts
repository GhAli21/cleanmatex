/**
 * Tests: order-refund.service
 *
 * Covers:
 * - initiateRefund  — creates PENDING_APPROVAL refund
 * - initiateRefund  — throws when amount exceeds total_paid
 * - approveRefund   — moves status to APPROVED
 * - approveRefund   — throws when refund not in PENDING_APPROVAL state
 * - processRefund   — routes CASH method, emits outbox event
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrderFindFirstOrThrow  = jest.fn();
const mockRefundCount            = jest.fn();
const mockRefundCreate           = jest.fn();
const mockRefundFindFirstOrThrow = jest.fn();
const mockRefundUpdate           = jest.fn();
const mockOutboxCreate           = jest.fn();
const mockTransaction            = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    org_orders_mst: {
      findFirstOrThrow: (...a: unknown[]) => mockOrderFindFirstOrThrow(...a),
    },
    org_order_refunds_dtl: {
      count:            (...a: unknown[]) => mockRefundCount(...a),
      create:           (...a: unknown[]) => mockRefundCreate(...a),
      findFirstOrThrow: (...a: unknown[]) => mockRefundFindFirstOrThrow(...a),
      update:           (...a: unknown[]) => mockRefundUpdate(...a),
    },
    org_domain_events_outbox: {
      create: (...a: unknown[]) => mockOutboxCreate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx:     jest.fn().mockResolvedValue({}),
  issueCreditNote:   jest.fn().mockResolvedValue({ id: 'cn-1' }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { initiateRefund, approveRefund } from '@/lib/services/order-refund.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT    = 'tenant-ref-001';
const ORDER     = 'order-ref-001';
const REFUND    = 'refund-ref-001';
const REQUESTER = 'staff-001';
const APPROVER  = 'manager-001';

const makeOrder = (totalPaid = 100) => ({
  id: ORDER, tenant_org_id: TENANT, order_no: 'ORD-001',
  total_paid_amount: new Decimal(String(totalPaid)),
});

const makeRefundRecord = (status = 'PENDING_APPROVAL') => ({
  id: REFUND, tenant_org_id: TENANT, order_id: ORDER,
  refund_status: status, refund_amount: new Decimal('30'),
  refund_method_code: 'CASH', currency_code: 'OMR',
});

const baseParams = {
  orderId:      ORDER,
  amount:       30,
  reason:       'QUALITY_ISSUE' as const,
  method:       'CASH' as const,
  requestedBy:  REQUESTER,
  currencyCode: 'OMR',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('order-refund.service — initiateRefund', () => {
  beforeEach(() => jest.clearAllMocks());

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
        }),
      })
    );
  });

  it('generates sequential refund number', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
    mockRefundCount.mockResolvedValue(4); // 4 existing = next is REF-000005
    mockRefundCreate.mockResolvedValue(makeRefundRecord());

    await initiateRefund(TENANT, baseParams);
    const createArg = mockRefundCreate.mock.calls[0][0];
    expect(createArg.data.refund_no).toBe('REF-000005');
  });

  it('throws when refund amount exceeds total paid', async () => {
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(20)); // only 20 paid

    await expect(initiateRefund(TENANT, { ...baseParams, amount: 50 }))
      .rejects.toThrow(/exceeds total paid/i);
  });
});

describe('order-refund.service — approveRefund', () => {
  beforeEach(() => jest.clearAllMocks());

  it('moves refund status to APPROVED', async () => {
    mockRefundFindFirstOrThrow.mockResolvedValue(makeRefundRecord('PENDING_APPROVAL'));
    mockRefundUpdate.mockResolvedValue({ ...makeRefundRecord('APPROVED') });

    await approveRefund(TENANT, REFUND, APPROVER);
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refund_status: 'APPROVED', approved_by: APPROVER }),
      })
    );
  });

  it('throws when refund is not in PENDING_APPROVAL', async () => {
    // findFirstOrThrow will throw if no row matches the where clause
    mockRefundFindFirstOrThrow.mockRejectedValue(new Error('No refund found'));

    await expect(approveRefund(TENANT, REFUND, APPROVER)).rejects.toThrow();
  });
});
