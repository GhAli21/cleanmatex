/**
 * B30 — payment-transition.service.ts unit tests.
 *
 * Covers:
 *   - VERIFY happy path (PENDING -> COMPLETED), idempotent no-op, race detection
 *   - CANCEL / FAIL_BOUNCE mandatory reason + D009 fallback classification
 *   - D009 payment_type_code reclassification (PAY_ON_COLLECTION / AR_CREDIT_INVOICE only)
 *   - D010 idempotency replay (same key+payload) and conflict (same key, different payload)
 *   - D001 legality gate (only PENDING/PROCESSING may transition; REAL_PAYMENT only)
 *   - B32 deferred cash-drawer movement creation on VERIFY
 *   - B30 orphan-movement trip-wire on CANCEL/FAIL_BOUNCE (logs, does not auto-reverse)
 */

const mockQueryRaw = jest.fn();
const mockPaymentUpdateMany = jest.fn();
const mockOrderFindFirst = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockOrderUpdate = jest.fn();
const mockOutboxCreate = jest.fn();
const mockRecalc = jest.fn();
const mockIdempotencyFindFirst = jest.fn();
const mockIdempotencyUpsert = jest.fn();
const mockMovementFindFirst = jest.fn();
const mockMovementCreate = jest.fn();
const mockSessionFindFirst = jest.fn();
const mockVoucherLineUpdateMany = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/lib/db/prisma', () => {
  const tx = {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    org_order_payments_dtl: { updateMany: (...a: unknown[]) => mockPaymentUpdateMany(...a) },
    org_orders_mst: {
      findFirst: (...a: unknown[]) => mockOrderFindFirst(...a),
      findFirstOrThrow: (...a: unknown[]) => mockOrderFindFirstOrThrow(...a),
      update: (...a: unknown[]) => mockOrderUpdate(...a),
    },
    org_domain_events_outbox: { create: (...a: unknown[]) => mockOutboxCreate(...a) },
    org_idempotency_keys: {
      findFirst: (...a: unknown[]) => mockIdempotencyFindFirst(...a),
      upsert: (...a: unknown[]) => mockIdempotencyUpsert(...a),
    },
    org_cash_drawer_movements_dtl: {
      findFirst: (...a: unknown[]) => mockMovementFindFirst(...a),
      create: (...a: unknown[]) => mockMovementCreate(...a),
    },
    org_cash_drawer_sessions_mst: { findFirst: (...a: unknown[]) => mockSessionFindFirst(...a) },
    org_fin_voucher_trx_lines_dtl: { updateMany: (...a: unknown[]) => mockVoucherLineUpdateMany(...a) },
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

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: (...a: unknown[]) => mockLoggerWarn(...a), error: jest.fn(), info: jest.fn() },
}));

import { transitionPaymentTx } from '@/lib/services/payment-transition.service';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '00000000-0000-0000-0000-0000000000aa';
const PAYMENT_ID = '00000000-0000-0000-0000-0000000000bb';
const USER_ID = '00000000-0000-0000-0000-0000000000cc';

function pendingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PAYMENT_ID,
    order_id: ORDER_ID,
    payment_status: 'PENDING',
    payment_nature_snapshot: 'REAL_PAYMENT',
    payment_method_code: 'CHECK',
    amount: '100.00',
    currency_code: 'SAR',
    cash_drawer_session_id: null,
    tendered_amount: null,
    change_returned_amount: null,
    fin_voucher_id: null,
    fin_voucher_trx_line_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPaymentUpdateMany.mockResolvedValue({ count: 1 });
  mockIdempotencyFindFirst.mockResolvedValue(null);
  mockIdempotencyUpsert.mockResolvedValue({});
  mockMovementFindFirst.mockResolvedValue(null);
  mockRecalc.mockResolvedValue({
    paymentStatus: 'PARTIAL',
    outstandingAmount: 100,
    totalPaidAmount: 0,
    totalCreditAppliedAmount: 0,
  });
});

describe('transitionPaymentTx — VERIFY', () => {
  it('flips PENDING -> COMPLETED, stamps verified_by/at, emits PAYMENT_VERIFIED', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'VERIFY',
      idempotencyKey: 'key-verify-1',
    });

    expect(result).toMatchObject({ previousStatus: 'PENDING', newStatus: 'COMPLETED', flipped: true });
    expect(mockPaymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_status: 'COMPLETED',
          verified_by: USER_ID,
          transition_reason: null,
          fallback_classification: null,
        }),
      }),
    );
    expect(mockOutboxCreate.mock.calls[0][0].data).toMatchObject({
      event_type: OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
    });
  });

  it('is idempotent on an already-COMPLETED row (no-op, no UPDATE, no outbox)', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow({ payment_status: 'COMPLETED' })]);
    mockOrderFindFirstOrThrow.mockResolvedValue({ payment_status: 'PAID', outstanding_amount: 0 });

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'VERIFY',
      idempotencyKey: 'key-verify-2',
    });

    expect(result.flipped).toBe(false);
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
    expect(mockOutboxCreate).not.toHaveBeenCalled();
  });

  it('creates the B32 deferred cash-drawer movement for a CASH + drawer leg with no existing movement', async () => {
    const sessionId = 'session-1';
    mockQueryRaw.mockResolvedValue([
      pendingRow({ payment_method_code: 'CASH', cash_drawer_session_id: sessionId }),
    ]);
    mockMovementFindFirst.mockResolvedValue(null);
    mockSessionFindFirst.mockResolvedValue({
      id: sessionId,
      cash_drawer_id: 'drawer-1',
      branch_id: 'branch-1',
      currency_code: 'SAR',
    });
    mockMovementCreate.mockResolvedValue({ id: 'movement-1' });

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'VERIFY',
      idempotencyKey: 'key-verify-cash',
    });

    expect(result.deferredCashMovementCreated).toBe(true);
    expect(mockMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ movement_type: 'CASH_SALE', order_payment_id: PAYMENT_ID }),
      }),
    );
  });

  it('does not create a deferred movement when the drawer session is no longer OPEN (no silent mutation)', async () => {
    mockQueryRaw.mockResolvedValue([
      pendingRow({ payment_method_code: 'CASH', cash_drawer_session_id: 'session-closed' }),
    ]);
    mockMovementFindFirst.mockResolvedValue(null);
    mockSessionFindFirst.mockResolvedValue(null); // not OPEN / not found

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'VERIFY',
      idempotencyKey: 'key-verify-closed',
    });

    expect(result.deferredCashMovementCreated).toBe(false);
    expect(mockMovementCreate).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});

describe('transitionPaymentTx — CANCEL / FAIL_BOUNCE', () => {
  it('requires a non-empty reason', async () => {
    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'CANCEL',
        idempotencyKey: 'key-noreason',
      }),
    ).rejects.toThrow('TRANSITION_REASON_REQUIRED');
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
  });

  it('requires a fallback classification', async () => {
    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'CANCEL',
        reason: 'customer disputed',
        idempotencyKey: 'key-nofallback',
      }),
    ).rejects.toThrow('FALLBACK_CLASSIFICATION_REQUIRED');
  });

  it('rejects an invalid fallback classification', async () => {
    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'CANCEL',
        reason: 'customer disputed',
        // @ts-expect-error deliberately invalid at the runtime boundary
        fallbackClassification: 'NOT_A_REAL_CODE',
        idempotencyKey: 'key-badfallback',
      }),
    ).rejects.toThrow('INVALID_FALLBACK_CLASSIFICATION');
  });

  it('CANCEL with PAY_ON_COLLECTION reclassifies org_orders_mst.payment_type_code', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);
    mockOrderFindFirst.mockResolvedValue({ payment_type_code: 'PAY_IN_ADVANCE' });

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'CANCEL',
      reason: 'check bounced',
      fallbackClassification: 'PAY_ON_COLLECTION',
      idempotencyKey: 'key-cancel-poc',
    });

    expect(result).toMatchObject({ newStatus: 'CANCELLED', reclassifiedPaymentType: true });
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payment_type_code: 'PAY_ON_COLLECTION' }) }),
    );
    expect(mockOutboxCreate.mock.calls[0][0].data).toMatchObject({
      event_type: OUTBOX_EVENT_TYPES.PAYMENT_CANCELLED,
    });
  });

  it('FAIL_BOUNCE with MANUAL_REVIEW does NOT reclassify payment_type_code', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'FAIL_BOUNCE',
      reason: 'bank rejected the transfer',
      fallbackClassification: 'MANUAL_REVIEW',
      idempotencyKey: 'key-fail-manual',
    });

    expect(result).toMatchObject({ newStatus: 'FAILED', reclassifiedPaymentType: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockOutboxCreate.mock.calls[0][0].data).toMatchObject({
      event_type: OUTBOX_EVENT_TYPES.PAYMENT_FAILED,
    });
  });

  it('warns (does not auto-reverse) when an orphan movement unexpectedly exists', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);
    mockMovementFindFirst.mockResolvedValue({ id: 'unexpected-movement' });

    await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'CANCEL',
      reason: 'test',
      fallbackClassification: 'MANUAL_REVIEW',
      idempotencyKey: 'key-orphan',
    });

    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockMovementCreate).not.toHaveBeenCalled();
  });
});

describe('transitionPaymentTx — D001 legality + D010 idempotency', () => {
  it('rejects NOT_REAL_PAYMENT_LEG for a CREDIT_APPLICATION nature row', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow({ payment_nature_snapshot: 'CREDIT_APPLICATION' })]);

    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'VERIFY',
        idempotencyKey: 'key-credit-app',
      }),
    ).rejects.toThrow('NOT_REAL_PAYMENT_LEG');
  });

  it('rejects PAYMENT_NOT_FOUND when no row matches the composite key', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'VERIFY',
        idempotencyKey: 'key-notfound',
      }),
    ).rejects.toThrow('PAYMENT_NOT_FOUND');
  });

  it('rejects ILLEGAL_TRANSITION for a COMPLETED row (needs B10 reversal, not this service)', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow({ payment_status: 'COMPLETED' })]);

    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'CANCEL',
        reason: 'test',
        fallbackClassification: 'MANUAL_REVIEW',
        idempotencyKey: 'key-illegal',
      }),
    ).rejects.toThrow('ILLEGAL_TRANSITION');
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects PAYMENT_TRANSITION_RACE_DETECTED when the concurrent updateMany affects zero rows', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);
    mockPaymentUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'VERIFY',
        idempotencyKey: 'key-race',
      }),
    ).rejects.toThrow('PAYMENT_TRANSITION_RACE_DETECTED');
  });

  it('replays the cached result for the same idempotency key + identical payload (zero new effects)', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);
    const cachedResult = {
      paymentId: PAYMENT_ID,
      action: 'VERIFY',
      previousStatus: 'PENDING',
      newStatus: 'COMPLETED',
      transitionedAt: '2026-01-01T00:00:00.000Z',
      orderPaymentStatus: 'PAID',
      outstanding: 0,
      flipped: true,
      fallbackClassification: null,
      reclassifiedPaymentType: false,
      deferredCashMovementCreated: false,
    };
    mockIdempotencyFindFirst.mockResolvedValue({
      response_cache: {
        payload_hash: expect.any(String),
        result: cachedResult,
      },
    });
    // Recompute the real hash so the cached record matches exactly what the
    // service will compute for this payload.
    const { hashPayload } = require('@/lib/utils/idempotency');
    const requestHash = hashPayload({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      action: 'VERIFY',
      reason: null,
      fallbackClassification: null,
    });
    mockIdempotencyFindFirst.mockResolvedValue({
      response_cache: { payload_hash: requestHash, result: cachedResult },
    });

    const result = await transitionPaymentTx({
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      tenantId: TENANT_A,
      actorId: USER_ID,
      action: 'VERIFY',
      idempotencyKey: 'replayed-key',
    });

    expect(result).toEqual(cachedResult);
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
    expect(mockOutboxCreate).not.toHaveBeenCalled();
  });

  it('throws IDEMPOTENCY_CONFLICT when the same key carries a different payload', async () => {
    mockQueryRaw.mockResolvedValue([pendingRow()]);
    mockIdempotencyFindFirst.mockResolvedValue({
      response_cache: { payload_hash: 'a-completely-different-hash', result: {} },
    });

    await expect(
      transitionPaymentTx({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        tenantId: TENANT_A,
        actorId: USER_ID,
        action: 'VERIFY',
        idempotencyKey: 'conflicting-key',
      }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
  });
});
