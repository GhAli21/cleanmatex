/** @jest-environment node */

const queryRawMock = jest.fn();
const orderUpdateManyMock = jest.fn();
const idempotencyUpdateManyMock = jest.fn();
const transactionMock = jest.fn();
const claimIdempotencyKeyMock = jest.fn();
const deleteIdempotencyHashMock = jest.fn();
const executeActionMock = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionMock(fn),
    org_idempotency_keys: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/utils/idempotency', () => ({
  claimIdempotencyKey: (...args: unknown[]) => claimIdempotencyKeyMock(...args),
  deleteIdempotencyHash: (...args: unknown[]) => deleteIdempotencyHashMock(...args),
  hashPayload: (value: unknown) => JSON.stringify(value),
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  executeAction: (...args: unknown[]) => executeActionMock(...args),
}));

import { completePreparationCommand } from '@/lib/services/preparation/preparation-completion.service';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '22222222-2222-2222-2222-222222222222';

describe('completePreparationCommand — ready_by_at preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimIdempotencyKeyMock.mockResolvedValue({ status: 'CLAIMED' });
    orderUpdateManyMock.mockResolvedValue({ count: 1 });
    idempotencyUpdateManyMock.mockResolvedValue({ count: 1 });
    executeActionMock.mockResolvedValue({
      ok: true,
      currentStatus: 'processing',
      stateVersion: 3,
    });
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: queryRawMock,
        org_orders_mst: { updateMany: orderUpdateManyMock },
        org_idempotency_keys: { updateMany: idempotencyUpdateManyMock },
      }),
    );
  });

  it('preserves existing order.ready_by_at without overwriting when readyByOverride is omitted', async () => {
    const existingReadyBy = new Date('2026-11-28T14:00:00.000Z');
    queryRawMock.mockResolvedValue([
      { id: ORDER_ID, preparation_status: 'in_progress', ready_by_at: existingReadyBy },
    ]);

    const result = await completePreparationCommand({
      tenantId: TENANT_ID,
      orderId: ORDER_ID,
      actorUserId: USER_ID,
      expectedStateVersion: 2,
      idempotencyKey: 'prep-keep-ready-by',
      internalNotes: 'Checked and tagged',
    });

    expect(result.readyBy).toBe('2026-11-28T14:00:00.000Z');
    expect(orderUpdateManyMock).toHaveBeenCalledTimes(1);
    const updateData = orderUpdateManyMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData).not.toHaveProperty('ready_by_at');
    expect(updateData.internal_notes).toBe('Checked and tagged');
  });

  it('returns null and skips stage update when ready_by_at is unset and no override/notes are provided', async () => {
    queryRawMock.mockResolvedValue([
      { id: ORDER_ID, preparation_status: 'pending', ready_by_at: null },
    ]);

    const result = await completePreparationCommand({
      tenantId: TENANT_ID,
      orderId: ORDER_ID,
      actorUserId: USER_ID,
      expectedStateVersion: 2,
      idempotencyKey: 'prep-null-ready-by',
    });

    expect(result.readyBy).toBeNull();
    expect(orderUpdateManyMock).not.toHaveBeenCalled();
  });

  it('updates ready_by_at only when the user explicitly provides readyByOverride', async () => {
    const existingReadyBy = new Date('2026-11-28T14:00:00.000Z');
    const explicitOverride = new Date('2026-11-29T16:30:00.000Z');
    queryRawMock.mockResolvedValue([
      { id: ORDER_ID, preparation_status: 'in_progress', ready_by_at: existingReadyBy },
    ]);

    const result = await completePreparationCommand({
      tenantId: TENANT_ID,
      orderId: ORDER_ID,
      actorUserId: USER_ID,
      expectedStateVersion: 2,
      idempotencyKey: 'prep-explicit-override',
      readyByOverride: explicitOverride,
    });

    expect(result.readyBy).toBe('2026-11-29T16:30:00.000Z');
    expect(orderUpdateManyMock).toHaveBeenCalledTimes(1);
    const updateData = orderUpdateManyMock.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.ready_by_at).toEqual(explicitOverride);
  });
});
