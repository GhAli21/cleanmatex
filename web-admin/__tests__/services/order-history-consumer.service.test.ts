/**
 * Unit tests for BVM Phase 5 order-history outbox consumer.
 *
 * Covers (PRD §22):
 *   - lib/services/order-history-consumer.service.ts
 *
 * Asserts:
 *   1. ORDER_COMPLETED maps directly (aggregate_id IS the order id).
 *   2. VOUCHER_POSTED_AND_WIRED resolves order_id via org_fin_vouchers_mst.
 *   3. AR_INVOICE_ISSUED resolves order_id via org_invoice_mst.
 *   4. Voucher with no linked order → SKIPPED_NOT_ORDER_LINKED (manual voucher).
 *   5. AR invoice with NULL order_id → SKIPPED_NOT_ORDER_LINKED (multi-order).
 *   6. Unrelated event types (e.g. PAYMENT_RECEIVED) → SKIPPED_UNSUPPORTED_EVENT.
 *   7. Idempotency: upsert uses the (tenant_org_id, outbox_event_id) composite
 *      key, replays return WRITTEN without creating duplicates.
 *   8. Multi-tenant: tenant id forwarded into every Prisma where clause.
 *   9. consumeOrderHistoryBatch returns outcomes 1:1 with events.
 */

const mockHistoryUpsert = jest.fn();
const mockVoucherFindFirst = jest.fn();
const mockInvoiceFindFirst = jest.fn();
const mockPaymentFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_order_history: { upsert: (...a: unknown[]) => mockHistoryUpsert(...a) },
    org_fin_vouchers_mst: { findFirst: (...a: unknown[]) => mockVoucherFindFirst(...a) },
    org_invoice_mst: { findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a) },
    org_order_payments_dtl: { findFirst: (...a: unknown[]) => mockPaymentFindFirst(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async <T,>(tenantId: string, fn: (id: string) => Promise<T>) => fn(tenantId)),
}));

import {
  consumeOrderHistoryEvent,
  consumeOrderHistoryBatch,
  type OutboxEventForHistory,
} from '@/lib/services/order-history-consumer.service';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '00000000-0000-0000-0000-0000000000aa';
const VOUCHER_ID = '00000000-0000-0000-0000-0000000000bb';
const INVOICE_ID = '00000000-0000-0000-0000-0000000000cc';
const PAYMENT_ID = '00000000-0000-0000-0000-0000000000dd';
const EVENT_ID = '00000000-0000-0000-0000-0000000000ee';
const NOW = new Date('2026-05-30T12:00:00Z');

function baseEvent(overrides: Partial<OutboxEventForHistory>): OutboxEventForHistory {
  return {
    id: EVENT_ID,
    tenant_org_id: TENANT_A,
    event_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
    aggregate_type: 'order',
    aggregate_id: ORDER_ID,
    payload: {},
    created_at: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHistoryUpsert.mockResolvedValue({ id: 'hist-1' });
});

describe('consumeOrderHistoryEvent', () => {
  it('writes ORDER_COMPLETED directly using aggregate_id as order_id', async () => {
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
      payload: { paymentStatus: 'PAID', grandTotal: 100, settled: true },
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome).toEqual({ status: 'WRITTEN', historyId: 'hist-1' });
    expect(mockVoucherFindFirst).not.toHaveBeenCalled();
    expect(mockInvoiceFindFirst).not.toHaveBeenCalled();
    expect(mockHistoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenant_org_id_outbox_event_id: {
            tenant_org_id: TENANT_A,
            outbox_event_id: EVENT_ID,
          },
        },
        update: {},
        create: expect.objectContaining({
          tenant_org_id: TENANT_A,
          order_id: ORDER_ID,
          action_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
          to_value: 'PAID',
          outbox_event_id: EVENT_ID,
          payload: expect.objectContaining({
            source: 'outbox',
            event_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
            settled: true,
          }),
        }),
      }),
    );
  });

  it('resolves order_id from voucher for VOUCHER_POSTED_AND_WIRED', async () => {
    mockVoucherFindFirst.mockResolvedValue({
      id: VOUCHER_ID,
      order_id: ORDER_ID,
      voucher_no: 'VCH-001',
    });
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
      aggregate_type: 'fin_voucher',
      aggregate_id: VOUCHER_ID,
      payload: {
        voucher_id: VOUCHER_ID,
        voucher_no: 'VCH-001',
        voucher_status: 'POSTED',
        posted_by: 'user-1',
        lines_wired: 3,
      },
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome.status).toBe('WRITTEN');
    expect(mockVoucherFindFirst).toHaveBeenCalledWith({
      where: { id: VOUCHER_ID, tenant_org_id: TENANT_A },
      select: expect.objectContaining({ id: true, order_id: true, voucher_no: true }),
    });
    expect(mockHistoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          order_id: ORDER_ID,
          action_type: OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
          to_value: 'VCH-001',
          done_by: 'user-1',
          outbox_event_id: EVENT_ID,
        }),
      }),
    );
  });

  it('skips VOUCHER_POSTED_AND_WIRED when the voucher has no linked order', async () => {
    mockVoucherFindFirst.mockResolvedValue({
      id: VOUCHER_ID,
      order_id: null, // manual financial voucher
      voucher_no: 'VCH-002',
    });
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
      aggregate_type: 'fin_voucher',
      aggregate_id: VOUCHER_ID,
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome).toEqual({ status: 'SKIPPED_NOT_ORDER_LINKED' });
    expect(mockHistoryUpsert).not.toHaveBeenCalled();
  });

  it('resolves order_id from invoice for AR_INVOICE_ISSUED', async () => {
    mockInvoiceFindFirst.mockResolvedValue({
      id: INVOICE_ID,
      order_id: ORDER_ID,
      invoice_no: 'ARI-100',
    });
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
      aggregate_type: 'ar_invoice',
      aggregate_id: INVOICE_ID,
      payload: { invoice_no: 'ARI-100', issued_at: '2026-05-30T10:00:00Z' },
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome.status).toBe('WRITTEN');
    expect(mockInvoiceFindFirst).toHaveBeenCalledWith({
      where: { id: INVOICE_ID, tenant_org_id: TENANT_A },
      select: expect.objectContaining({ id: true, order_id: true, invoice_no: true }),
    });
    expect(mockHistoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          order_id: ORDER_ID,
          action_type: OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
          to_value: 'ARI-100',
          outbox_event_id: EVENT_ID,
        }),
      }),
    );
  });

  it('skips AR_INVOICE_ISSUED when invoice has NULL order_id (multi-order)', async () => {
    mockInvoiceFindFirst.mockResolvedValue({
      id: INVOICE_ID,
      order_id: null,
      invoice_no: 'ARI-101',
    });
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
      aggregate_type: 'ar_invoice',
      aggregate_id: INVOICE_ID,
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome).toEqual({ status: 'SKIPPED_NOT_ORDER_LINKED' });
    expect(mockHistoryUpsert).not.toHaveBeenCalled();
  });

  it('resolves order_id from payment for PAYMENT_VERIFIED (BVM Phase 6)', async () => {
    mockPaymentFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      payment_method_code: 'CARD',
    });
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
      aggregate_type: 'order_payment',
      aggregate_id: PAYMENT_ID,
      payload: {
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        verified_by: 'user-xyz',
        previousStatus: 'PENDING',
        newStatus: 'COMPLETED',
      },
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome.status).toBe('WRITTEN');
    expect(mockPaymentFindFirst).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID, tenant_org_id: TENANT_A },
      select: expect.objectContaining({ id: true, order_id: true, payment_method_code: true }),
    });
    expect(mockHistoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          order_id: ORDER_ID,
          action_type: OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
          from_value: 'PENDING',
          to_value: 'COMPLETED',
          done_by: 'user-xyz',
          outbox_event_id: EVENT_ID,
        }),
      }),
    );
  });

  it('skips PAYMENT_VERIFIED when the payment row was hard-deleted', async () => {
    mockPaymentFindFirst.mockResolvedValue(null);
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
      aggregate_type: 'order_payment',
      aggregate_id: PAYMENT_ID,
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome).toEqual({ status: 'SKIPPED_NOT_ORDER_LINKED' });
    expect(mockHistoryUpsert).not.toHaveBeenCalled();
  });

  it('skips events outside the BVM history scope', async () => {
    const event = baseEvent({
      event_type: 'PAYMENT_RECEIVED', // owned by a different consumer
      aggregate_type: 'payment',
      aggregate_id: ORDER_ID,
    });

    const outcome = await consumeOrderHistoryEvent(event);

    expect(outcome).toEqual({ status: 'SKIPPED_UNSUPPORTED_EVENT' });
    expect(mockHistoryUpsert).not.toHaveBeenCalled();
    expect(mockVoucherFindFirst).not.toHaveBeenCalled();
    expect(mockInvoiceFindFirst).not.toHaveBeenCalled();
  });

  it('is idempotent — replaying the same event uses the unique-key upsert', async () => {
    const event = baseEvent({
      event_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED,
      payload: { paymentStatus: 'PAID', settled: true },
    });

    await consumeOrderHistoryEvent(event);
    await consumeOrderHistoryEvent(event);

    expect(mockHistoryUpsert).toHaveBeenCalledTimes(2);
    // Both calls use the same composite unique key — DB collapses to no-op.
    const firstCallWhere = mockHistoryUpsert.mock.calls[0][0].where;
    const secondCallWhere = mockHistoryUpsert.mock.calls[1][0].where;
    expect(firstCallWhere).toEqual(secondCallWhere);
    // The `update: {}` clause keeps the existing row untouched on retry —
    // this is the "no clobber" guarantee.
    expect(mockHistoryUpsert.mock.calls[0][0].update).toEqual({});
  });

  it('forwards tenant id into every Prisma where clause (multi-tenant isolation)', async () => {
    mockVoucherFindFirst.mockResolvedValue({ id: VOUCHER_ID, order_id: ORDER_ID, voucher_no: 'VCH-T' });
    const event = baseEvent({
      tenant_org_id: TENANT_B, // different tenant
      event_type: OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED,
      aggregate_type: 'fin_voucher',
      aggregate_id: VOUCHER_ID,
    });

    await consumeOrderHistoryEvent(event);

    expect(mockVoucherFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_org_id: TENANT_B }),
      }),
    );
    expect(mockHistoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_org_id_outbox_event_id: expect.objectContaining({ tenant_org_id: TENANT_B }),
        }),
        create: expect.objectContaining({ tenant_org_id: TENANT_B }),
      }),
    );
  });
});

describe('consumeOrderHistoryBatch', () => {
  it('returns outcomes 1:1 with events, preserving order', async () => {
    mockInvoiceFindFirst.mockResolvedValue({ id: INVOICE_ID, order_id: ORDER_ID, invoice_no: 'ARI-9' });
    const events: OutboxEventForHistory[] = [
      baseEvent({ id: 'e-1', event_type: OUTBOX_EVENT_TYPES.ORDER_COMPLETED }),
      baseEvent({ id: 'e-2', event_type: 'PAYMENT_RECEIVED' }),
      baseEvent({
        id: 'e-3',
        event_type: OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
        aggregate_type: 'ar_invoice',
        aggregate_id: INVOICE_ID,
      }),
    ];

    const outcomes = await consumeOrderHistoryBatch(events);

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].status).toBe('WRITTEN');
    expect(outcomes[1].status).toBe('SKIPPED_UNSUPPORTED_EVENT');
    expect(outcomes[2].status).toBe('WRITTEN');
  });
});
