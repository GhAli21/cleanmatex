/**
 * Cancel orchestrator — ADR: narrow cancel, no auto Fin unwind, return deferred.
 */

const mockQueryRaw = jest.fn();
const mockExecuteAction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  WorkflowEngineError: class WorkflowEngineError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
}));

import { executeCancelOrReturnAction } from '@/lib/services/workflow/cancel-return-orchestrator.service';

describe('executeCancelOrReturnAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects cancel without long enough reason', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'intake', current_status: 'intake', preparation_status: null },
    ]);

    await expect(
      executeCancelOrReturnAction({
        tenantId: 't1',
        orderId: 'o1',
        screen: 'canceling',
        actionCode: 'CANCEL_ORDER',
        expectedStateVersion: 0,
        actorUserId: 'u1',
        idempotencyKey: 'k1',
        input: { cancelled_note: 'short' },
      }),
    ).rejects.toMatchObject({ code: 'CANCEL_REASON_REQUIRED' });
  });

  it('rejects cancel when status is processing', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        status: 'processing',
        current_status: 'processing',
        preparation_status: 'completed',
      },
    ]);

    await expect(
      executeCancelOrReturnAction({
        tenantId: 't1',
        orderId: 'o1',
        screen: 'canceling',
        actionCode: 'CANCEL_ORDER',
        expectedStateVersion: 1,
        actorUserId: 'u1',
        idempotencyKey: 'k1',
        input: { cancelled_note: 'Trying to cancel after processing started' },
      }),
    ).rejects.toMatchObject({ code: 'CANCEL_NOT_ALLOWED' });
  });

  it('rejects cancel when preparing but prep completed', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        status: 'preparing',
        current_status: 'preparing',
        preparation_status: 'completed',
      },
    ]);

    await expect(
      executeCancelOrReturnAction({
        tenantId: 't1',
        orderId: 'o1',
        screen: 'canceling',
        actionCode: 'CANCEL_ORDER',
        expectedStateVersion: 1,
        actorUserId: 'u1',
        idempotencyKey: 'k1',
        input: { cancelled_note: 'Prep done so cancel should fail now' },
      }),
    ).rejects.toMatchObject({ code: 'CANCEL_NOT_ALLOWED' });
  });

  it('executes cancel without Fin unwind even when historically paid', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'intake', current_status: 'intake', preparation_status: null },
    ]);
    mockExecuteAction.mockResolvedValueOnce({
      ok: true,
      currentStatus: 'cancelled',
      stateVersion: 2,
    });

    const result = await executeCancelOrReturnAction({
      tenantId: 't1',
      orderId: 'o1',
      screen: 'canceling',
      actionCode: 'CANCEL_ORDER',
      expectedStateVersion: 1,
      actorUserId: 'u1',
      idempotencyKey: 'k1',
      input: {
        cancelled_note: 'Customer cancelled before preparation',
        cancellation_disposition: 'REFUND',
      },
    });

    expect(result.currentStatus).toBe('cancelled');
    expect(mockExecuteAction).toHaveBeenCalled();
    expect(result).not.toHaveProperty('financialWarnings');
  });

  it('rejects RETURN_ORDER as deferred to V1.1', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        status: 'delivered',
        current_status: 'delivered',
        preparation_status: 'completed',
      },
    ]);

    await expect(
      executeCancelOrReturnAction({
        tenantId: 't1',
        orderId: 'o1',
        screen: 'returning',
        actionCode: 'RETURN_ORDER',
        expectedStateVersion: 2,
        actorUserId: 'u1',
        idempotencyKey: 'k2',
        input: { return_reason: 'Quality issue reported by customer' },
      }),
    ).rejects.toMatchObject({ code: 'RETURN_DEFERRED_V11' });
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('throws CancelReturnOrchestratorError for unknown actions via WorkflowEngineError path', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'intake', current_status: 'intake', preparation_status: null },
    ]);

    await expect(
      executeCancelOrReturnAction({
        tenantId: 't1',
        orderId: 'o1',
        screen: 'canceling',
        actionCode: 'COMPLETE_PACKING',
        expectedStateVersion: 0,
        actorUserId: 'u1',
        idempotencyKey: 'k3',
        input: {},
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
