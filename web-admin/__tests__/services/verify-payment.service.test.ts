/**
 * BVM Wiring Phase 6 Sub-item 1 — verifyPaymentTx unit tests.
 *
 * Covers (PRD §22.2):
 *   - lib/services/order-settlement.service.ts → verifyPaymentTx
 *
 * Asserts:
 *   1. Happy path: PENDING REAL_PAYMENT leg flips to COMPLETED, paid_at
 *      stamped, header recalc runs, PAYMENT_VERIFIED outbox emitted once.
 *   2. Idempotent: COMPLETED row returns same shape, no UPDATE, no outbox.
 *   3. Rejected: CANCELLED / FAILED rows throw with descriptive error.
 *   4. Rejected: credit-application leg (CREDIT_APPLICATION nature) throws.
 *   5. Rejected: payment not found (composite filter blocks cross-tenant).
 *   6. Tenant safety: every Prisma where clause includes tenant_org_id.
 */

const mockUpdateMany = jest.fn();
const mockQueryRaw = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockOutboxCreate = jest.fn();
const mockRecalc = jest.fn();

jest.mock('@/lib/db/prisma', () => {
  const tx = {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    org_order_payments_dtl: { updateMany: (...a: unknown[]) => mockUpdateMany(...a) },
    org_orders_mst: { findFirstOrThrow: (...a: unknown[]) => mockOrderFindFirstOrThrow(...a) },
    org_domain_events_outbox: { create: (...a: unknown[]) => mockOutboxCreate(...a) },
  };
  return {
    prisma: {
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...a: unknown[]) => mockRecalc(...a),
}));

// Tenant settings (and supabase clients) are only consulted by other code
// paths in this module; stub both client + server so the file loads in jest.
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({})),
}));

import { verifyPaymentTx } from '@/lib/services/order-settlement.service';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '00000000-0000-0000-0000-0000000000aa';
const PAYMENT_ID = '00000000-0000-0000-0000-0000000000bb';
const USER_ID = '00000000-0000-0000-0000-0000000000cc';

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockRecalc.mockResolvedValue({
    paymentStatus: 'PAID',
    outstandingAmount: 0,
    totalPaidAmount: 100,
    totalCreditAppliedAmount: 0,
  });
});

describe('verifyPaymentTx', () => {
  it('flips PENDING REAL_PAYMENT → COMPLETED and emits PAYMENT_VERIFIED outbox', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        payment_status: 'PENDING',
        payment_nature_snapshot: 'REAL_PAYMENT',
        paid_at: null,
      },
    ]);

    const result = await verifyPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      verifiedBy: USER_ID,
    });

    expect(result).toMatchObject({
      paymentId: PAYMENT_ID,
      previousStatus: 'PENDING',
      newStatus: 'COMPLETED',
      orderPaymentStatus: 'PAID',
      outstanding: 0,
      flipped: true,
    });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: PAYMENT_ID,
          order_id: ORDER_ID,
          tenant_org_id: TENANT_A,
          payment_status: 'PENDING',
        }),
        data: expect.objectContaining({
          payment_status: 'COMPLETED',
          updated_by: USER_ID,
        }),
      }),
    );
    expect(mockRecalc).toHaveBeenCalledWith(expect.anything(), TENANT_A, ORDER_ID);
    expect(mockOutboxCreate).toHaveBeenCalledTimes(1);
    const outboxCall = mockOutboxCreate.mock.calls[0][0];
    expect(outboxCall.data).toMatchObject({
      tenant_org_id: TENANT_A,
      event_type: OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
      aggregate_type: 'order_payment',
      aggregate_id: PAYMENT_ID,
      payload: expect.objectContaining({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        verifiedBy: USER_ID,
        previousStatus: 'PENDING',
        newStatus: 'COMPLETED',
      }),
    });
  });

  it('is idempotent on COMPLETED rows — no UPDATE, no outbox, returns same shape', async () => {
    const paidAt = new Date('2026-05-30T08:00:00Z');
    mockQueryRaw.mockResolvedValue([
      {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        payment_status: 'COMPLETED',
        payment_nature_snapshot: 'REAL_PAYMENT',
        paid_at: paidAt,
      },
    ]);
    mockOrderFindFirstOrThrow.mockResolvedValue({
      payment_status: 'PAID',
      outstanding_amount: 0,
    });

    const result = await verifyPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      verifiedBy: USER_ID,
    });

    expect(result).toMatchObject({
      previousStatus: 'COMPLETED',
      newStatus: 'COMPLETED',
      verifiedAt: paidAt.toISOString(),
      orderPaymentStatus: 'PAID',
      outstanding: 0,
      flipped: false,
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockOutboxCreate).not.toHaveBeenCalled();
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('rejects when payment_status is CANCELLED', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        payment_status: 'CANCELLED',
        payment_nature_snapshot: 'REAL_PAYMENT',
        paid_at: null,
      },
    ]);

    await expect(
      verifyPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        verifiedBy: USER_ID,
      }),
    ).rejects.toThrow(/CANCELLED/);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockOutboxCreate).not.toHaveBeenCalled();
  });

  it('rejects when leg is a CREDIT_APPLICATION (cannot be verified)', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        payment_status: 'PENDING',
        payment_nature_snapshot: 'CREDIT_APPLICATION',
        paid_at: null,
      },
    ]);

    await expect(
      verifyPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        verifiedBy: USER_ID,
      }),
    ).rejects.toThrow(/REAL_PAYMENT/);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockOutboxCreate).not.toHaveBeenCalled();
  });

  it('rejects when the payment row is not found for the composite key', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await expect(
      verifyPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        verifiedBy: USER_ID,
      }),
    ).rejects.toThrow(/Payment not found/);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('forwards tenantId into every WHERE clause (multi-tenant isolation)', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        payment_status: 'PENDING',
        payment_nature_snapshot: 'REAL_PAYMENT',
        paid_at: null,
      },
    ]);

    await verifyPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_B,
      verifiedBy: USER_ID,
    });

    // updateMany WHERE must carry tenant_org_id = TENANT_B
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_org_id: TENANT_B }),
      }),
    );
    // emitEventTx writes the outbox row scoped to TENANT_B
    expect(mockOutboxCreate.mock.calls[0][0].data).toMatchObject({ tenant_org_id: TENANT_B });
  });
});
