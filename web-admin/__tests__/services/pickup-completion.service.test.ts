/** @jest-environment node */

const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();
const mockIdempotencyUpdateMany = jest.fn();
const mockClaimIdempotencyKey = jest.fn();
const mockDeleteIdempotencyHash = jest.fn();
const mockExecuteAction = jest.fn();
const mockLoadArtifact = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    org_idempotency_keys: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/utils/idempotency', () => ({
  claimIdempotencyKey: (...args: unknown[]) => mockClaimIdempotencyKey(...args),
  deleteIdempotencyHash: (...args: unknown[]) => mockDeleteIdempotencyHash(...args),
  hashPayload: jest.fn(() => 'pickup-payload-hash'),
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

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn() },
}));

import {
  completePickup,
  PickupCompletionError,
} from '@/lib/services/pickup/pickup-completion.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const COMMAND = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  orderId: '22222222-2222-2222-2222-222222222222',
  actorUserId: '33333333-3333-3333-3333-333333333333',
  actorName: 'Counter User',
  expectedStateVersion: 7,
  idempotencyKey: 'pickup-service-001',
};

describe('completePickup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaimIdempotencyKey.mockResolvedValue({ status: 'CLAIMED' });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mockQueryRaw,
      $executeRaw: mockExecuteRaw,
      org_idempotency_keys: { updateMany: mockIdempotencyUpdateMany },
    }));
    mockExecuteRaw.mockResolvedValue(1);
    mockIdempotencyUpdateMany.mockResolvedValue({ count: 1 });
    mockExecuteAction.mockResolvedValue({ ok: true, currentStatus: 'delivered', stateVersion: 8 });
    mockLoadArtifact.mockResolvedValue({
      allow_direct_counter_pickup: false,
      evidence: [],
    });
  });

  it('blocks pay-on-collection pickup before a release or workflow write', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: COMMAND.orderId,
        current_status: 'ready_for_pickup',
        payment_type_code: 'PAY_ON_COLLECTION',
        outstanding_amount: '2.5000',
      },
    ]);

    await expect(completePickup(COMMAND)).rejects.toMatchObject<PickupCompletionError>({
      code: 'PICKUP_COLLECTION_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockDeleteIdempotencyHash).toHaveBeenCalledWith(
      COMMAND.tenantId,
      COMMAND.idempotencyKey,
      'pickup_complete',
    );
  });

  it('fulfils the pickup release and transitions through CONFIRM_PICKUP in one transaction', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: COMMAND.orderId,
          current_status: 'ready_for_pickup',
          payment_type_code: 'PAY_IN_ADVANCE',
          outstanding_amount: '0.0000',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '44444444-4444-4444-4444-444444444444',
          release_type: 'pickup',
          release_status: 'released',
          has_release_lines: false,
        },
      ]);

    const result = await completePickup({
      ...COMMAND,
      handoverNotes: 'Collected at the branch counter.',
    });

    expect(result).toMatchObject({
      orderId: COMMAND.orderId,
      releaseIds: ['44444444-4444-4444-4444-444444444444'],
      workflow: { currentStatus: 'delivered', stateVersion: 8 },
    });
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: COMMAND.tenantId,
        orderId: COMMAND.orderId,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_PICKUP,
        screen: 'pickup_handover',
        expectedStateVersion: COMMAND.expectedStateVersion,
        channel: 'staff_web',
      }),
      expect.anything(),
    );
    expect(mockIdempotencyUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_org_id: COMMAND.tenantId }),
    }));
  });

  it('rejects ready_for_pickup without its required release instead of manufacturing audit history', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: COMMAND.orderId,
          current_status: 'ready_for_pickup',
          payment_type_code: 'PAY_IN_ADVANCE',
          outstanding_amount: '0.0000',
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(completePickup(COMMAND)).rejects.toMatchObject<PickupCompletionError>({
      code: 'PICKUP_RELEASE_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('completes an explicit direct counter handover from ready and creates a fulfilled pickup audit', async () => {
    mockLoadArtifact.mockResolvedValue({ allow_direct_counter_pickup: true });
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: COMMAND.orderId,
          current_status: 'ready',
          payment_type_code: 'PAY_IN_ADVANCE',
          outstanding_amount: '0.0000',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: '55555555-5555-5555-5555-555555555555' }]);

    const result = await completePickup(COMMAND);

    expect(result.releaseIds).toEqual(['55555555-5555-5555-5555-555555555555']);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockExecuteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionCode: WORKFLOW_ACTIONS.CONFIRM_PICKUP,
        input: expect.objectContaining({ handoverMode: 'direct' }),
      }),
      expect.anything(),
    );
    const directReleaseInsert = mockQueryRaw.mock.calls[mockQueryRaw.mock.calls.length - 1];
    expect(directReleaseInsert).toContain(COMMAND.expectedStateVersion + 1);
  });

  it('rejects a ready-status handover when live policy does not allow direct counter pickup', async () => {
    mockLoadArtifact.mockResolvedValue({ allow_direct_counter_pickup: false });
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: COMMAND.orderId,
        current_status: 'ready',
        payment_type_code: 'PAY_IN_ADVANCE',
        outstanding_amount: '0.0000',
      },
    ]);

    await expect(completePickup(COMMAND)).rejects.toMatchObject<PickupCompletionError>({
      code: 'PICKUP_DIRECT_NOT_ALLOWED',
      httpStatus: 422,
    });

    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('rejects an unbound order instead of confirming pickup without live policy', async () => {
    mockLoadArtifact.mockResolvedValue(null);
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: COMMAND.orderId,
        current_status: 'ready_for_pickup',
        payment_type_code: 'PAY_IN_ADVANCE',
        outstanding_amount: '0.0000',
      },
    ]);

    await expect(completePickup(COMMAND)).rejects.toMatchObject<PickupCompletionError>({
      code: 'PICKUP_POLICY_UNAVAILABLE',
      httpStatus: 422,
    });

    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('rejects compiled required pickup notes before a release or workflow write', async () => {
    mockLoadArtifact.mockResolvedValue({
      evidence: [{
        fulfilment_channel: 'pickup',
        evidence_method_code: 'notes',
        is_required: true,
        minimum_count: 0,
        display_order: 1,
      }],
    });
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: COMMAND.orderId,
        current_status: 'ready_for_pickup',
        payment_type_code: 'PAY_IN_ADVANCE',
        outstanding_amount: '0.0000',
      },
    ]);

    await expect(completePickup(COMMAND)).rejects.toMatchObject<PickupCompletionError>({
      code: 'PICKUP_NOTES_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
