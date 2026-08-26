/** @jest-environment node */

const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockIdempotencyUpdateMany = jest.fn();
const mockClaimIdempotencyKey = jest.fn();
const mockDeleteIdempotencyHash = jest.fn();
const mockExecuteAction = jest.fn();
const mockLoadArtifact = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    org_idempotency_keys: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/utils/idempotency', () => ({
  claimIdempotencyKey: (...args: unknown[]) => mockClaimIdempotencyKey(...args),
  deleteIdempotencyHash: (...args: unknown[]) => mockDeleteIdempotencyHash(...args),
  hashPayload: jest.fn(() => 'delivery-order-payload-hash'),
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
}));

jest.mock('@/lib/services/workflow/semantic-workflow-artifact.service', () => ({
  loadSemanticWorkflowArtifactForOrder: (...args: unknown[]) => mockLoadArtifact(...args),
  SemanticWorkflowArtifactError: class SemanticWorkflowArtifactError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = 'SemanticWorkflowArtifactError';
    }
  },
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn() } }));

import {
  completeDeliveryByOrder,
  DeliveryCompletionError,
} from '@/lib/services/delivery/delivery-completion.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const COMMAND = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  orderId: '77777777-7777-4777-8777-777777777777',
  actorUserId: '33333333-3333-3333-3333-333333333333',
  actorName: 'Delivery User',
  expectedStateVersion: 5,
  idempotencyKey: 'delivery-order-complete-001',
  podNotes: 'Handed to the customer at the door.',
};

function lockedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMAND.orderId,
    current_status: 'out_for_delivery',
    payment_type_code: 'PAY_IN_ADVANCE',
    outstanding_amount: '0.0000',
    ...overrides,
  };
}

describe('completeDeliveryByOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaimIdempotencyKey.mockResolvedValue({ status: 'CLAIMED' });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mockQueryRaw,
      org_idempotency_keys: { updateMany: mockIdempotencyUpdateMany },
    }));
    mockIdempotencyUpdateMany.mockResolvedValue({ count: 1 });
    mockExecuteAction.mockResolvedValue({ ok: true, currentStatus: 'delivered', stateVersion: 6 });
    mockLoadArtifact.mockResolvedValue(null);
  });

  it('blocks pay-on-collection handover before a workflow write', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedOrder({
        payment_type_code: 'PAY_ON_COLLECTION',
        outstanding_amount: '4.5000',
      })])
      .mockResolvedValueOnce([]);

    await expect(completeDeliveryByOrder(COMMAND)).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'DELIVERY_COLLECTION_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('refuses to invent a dummy route when an active stop already exists', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedOrder()])
      .mockResolvedValueOnce([{ stop_id: '22222222-2222-2222-2222-222222222222' }]);

    await expect(completeDeliveryByOrder(COMMAND)).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'USE_STOP_COMPLETE_COMMAND',
      httpStatus: 409,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('confirms delivery from the floor when the profile does not require a stop', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedOrder()])
      .mockResolvedValueOnce([]);

    const result = await completeDeliveryByOrder(COMMAND);

    expect(result).toMatchObject({
      orderId: COMMAND.orderId,
      workflow: { currentStatus: 'delivered', stateVersion: 6 },
    });
    expect(mockExecuteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: COMMAND.tenantId,
        orderId: COMMAND.orderId,
        screen: 'driver_delivery',
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        input: expect.objectContaining({
          handoverMode: 'ad_hoc',
          podMethodCode: 'NOTES',
          handoverNotes: COMMAND.podNotes,
        }),
      }),
      expect.anything(),
    );
  });

  it('rejects compiled photo proof when there is no stop to attach evidence to', async () => {
    mockLoadArtifact.mockResolvedValue({
      evidence: [{
        fulfilment_channel: 'delivery',
        evidence_method_code: 'photo',
        is_required: true,
        minimum_count: 1,
        display_order: 1,
      }],
    });
    mockQueryRaw
      .mockResolvedValueOnce([lockedOrder()])
      .mockResolvedValueOnce([]);

    await expect(completeDeliveryByOrder(COMMAND)).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'POD_METHOD_INVALID',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
  });
});
