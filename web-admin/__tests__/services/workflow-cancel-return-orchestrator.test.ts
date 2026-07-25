/**
 * Cancel/return orchestrator — disposition gate + Fin unwind after engine action.
 */

const mockQueryRaw = jest.fn();
const mockHasPermissionServer = jest.fn();
const mockUnwind = jest.fn();
const mockExecuteAction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...args: unknown[]) => mockHasPermissionServer(...args),
}));

jest.mock('@/lib/services/order-cancel-financials.service', () => ({
  CANCEL_DISPOSITIONS: {
    REFUND: 'REFUND',
    STORE_CREDIT: 'STORE_CREDIT',
    KEEP_ON_ACCOUNT: 'KEEP_ON_ACCOUNT',
  },
  unwindOrderFinancialsOnCancel: (...args: unknown[]) => mockUnwind(...args),
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

import {
  CancelReturnOrchestratorError,
  executeCancelOrReturnAction,
} from '@/lib/services/workflow/cancel-return-orchestrator.service';

describe('executeCancelOrReturnAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects cancel without long enough reason', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'processing', current_status: 'processing', paid: 0 },
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

  it('rejects cancel when status is delivered', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'delivered', current_status: 'delivered', paid: 0 },
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
        input: { cancelled_note: 'Trying to cancel a delivered order' },
      }),
    ).rejects.toMatchObject({ code: 'CANCEL_NOT_ALLOWED' });
  });

  it('requires disposition when order has paid amount', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'processing', current_status: 'processing', paid: 12.5 },
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
        input: { cancelled_note: 'Customer cancelled after payment' },
      }),
    ).rejects.toMatchObject({ code: 'CANCEL_DISPOSITION_REQUIRED' });
  });

  it('executes cancel + Fin unwind when disposition provided', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'processing', current_status: 'processing', paid: 5 },
    ]);
    mockExecuteAction.mockResolvedValueOnce({
      ok: true,
      currentStatus: 'cancelled',
      stateVersion: 2,
    });
    mockUnwind.mockResolvedValueOnce({
      reversedCreditApplications: 0,
      restoredStoredValueAmount: 0,
      paidAmountDisposed: 5,
      disposition: 'REFUND',
      refundIds: ['r1'],
      creditNoteId: null,
      warnings: [],
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
        cancelled_note: 'Customer cancelled after payment',
        cancellation_disposition: 'REFUND',
      },
    });

    expect(result.currentStatus).toBe('cancelled');
    expect(mockExecuteAction).toHaveBeenCalled();
    expect(mockUnwind).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: 'REFUND' }),
    );
  });

  it('rejects return when status is still in ops', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'ready', current_status: 'ready', paid: 0 },
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
    ).rejects.toMatchObject({ code: 'RETURN_NOT_ALLOWED' });
  });

  it('forces return preferredToStatus to returned', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { status: 'delivered', current_status: 'delivered', paid: 0 },
    ]);
    mockExecuteAction.mockResolvedValueOnce({
      ok: true,
      currentStatus: 'returned',
      stateVersion: 3,
    });

    await executeCancelOrReturnAction({
      tenantId: 't1',
      orderId: 'o1',
      screen: 'returning',
      actionCode: 'RETURN_ORDER',
      expectedStateVersion: 2,
      actorUserId: 'u1',
      idempotencyKey: 'k2',
      input: {
        return_reason: 'Quality issue reported by customer',
        preferredToStatus: 'cancelled',
      },
    });

    expect(mockExecuteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          preferredToStatus: 'returned',
          return_reason: 'Quality issue reported by customer',
        }),
      }),
    );
    expect(mockHasPermissionServer).not.toHaveBeenCalled();
  });
});
