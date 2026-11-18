/** @jest-environment node */

const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();
const mockPodCreate = jest.fn();
const mockPodUpdateMany = jest.fn();
const mockStopUpdateMany = jest.fn();
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
  hashPayload: jest.fn(() => 'delivery-payload-hash'),
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
  completeDelivery,
  DeliveryCompletionError,
} from '@/lib/services/delivery/delivery-completion.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

const COMMAND = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  stopId: '22222222-2222-2222-2222-222222222222',
  actorUserId: '33333333-3333-3333-3333-333333333333',
  actorName: 'Delivery User',
  expectedStateVersion: 5,
  idempotencyKey: 'delivery-complete-001',
  podMethodCode: 'SIGNATURE',
  podNotes: 'Customer received all pieces at the front door.',
};

const EVIDENCE_ID = '44444444-4444-4444-8444-444444444444';
const ROUTE_ID = '66666666-6666-4666-8666-666666666666';
const ORDER_ID = '77777777-7777-4777-8777-777777777777';

function lockedStop(overrides: Record<string, unknown> = {}) {
  return {
    stop_id: COMMAND.stopId,
    stop_status_code: 'in_transit',
    route_id: ROUTE_ID,
    order_id: ORDER_ID,
    branch_id: null,
    payment_type_code: 'PAY_IN_ADVANCE',
    outstanding_amount: '0.0000',
    ...overrides,
  };
}

describe('completeDelivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaimIdempotencyKey.mockResolvedValue({ status: 'CLAIMED' });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mockQueryRaw,
      $executeRaw: mockExecuteRaw,
      org_dlv_pod_tr: { create: mockPodCreate, updateMany: mockPodUpdateMany },
      org_dlv_stops_dtl: { updateMany: mockStopUpdateMany },
      org_idempotency_keys: { updateMany: mockIdempotencyUpdateMany },
    }));
    mockPodCreate.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555' });
    mockPodUpdateMany.mockResolvedValue({ count: 1 });
    mockStopUpdateMany.mockResolvedValue({ count: 1 });
    mockIdempotencyUpdateMany.mockResolvedValue({ count: 1 });
    mockExecuteRaw.mockResolvedValue(1);
    mockExecuteAction.mockResolvedValue({ ok: true, currentStatus: 'delivered', stateVersion: 6 });
    mockLoadArtifact.mockResolvedValue({ evidence: [] });
  });

  it('rejects over-limit photo receipts inside the shared command before a workflow write', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        stop_id: COMMAND.stopId,
        stop_status_code: 'in_transit',
        route_id: '66666666-6666-4666-8666-666666666666',
        order_id: '77777777-7777-4777-8777-777777777777',
        branch_id: null,
        payment_type_code: 'PAY_IN_ADVANCE',
        outstanding_amount: '0.0000',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: 'PHOTO' }]);

    await expect(completeDelivery({
      ...COMMAND,
      podMethodCode: 'PHOTO',
      photoEvidenceIds: Array.from({ length: 11 }, (_, index) =>
        `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
      ),
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'POD_EVIDENCE_INVALID',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockStopUpdateMany).not.toHaveBeenCalled();
  });

  it('locks the exact tenant-order-stop proof file before committing the workflow transition', async () => {
    const routeId = '66666666-6666-4666-8666-666666666666';
    const orderId = '77777777-7777-4777-8777-777777777777';
    mockQueryRaw
      .mockResolvedValueOnce([{
        stop_id: COMMAND.stopId,
        stop_status_code: 'in_transit',
        route_id: routeId,
        order_id: orderId,
        branch_id: null,
        payment_type_code: 'PAY_IN_ADVANCE',
        outstanding_amount: '0.0000',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: 'SIGNATURE' }])
      .mockResolvedValueOnce([{ id: EVIDENCE_ID, purpose_code: 'SIGNATURE' }])
      .mockResolvedValueOnce([{ id: EVIDENCE_ID }]);
    mockExecuteAction.mockImplementationOnce(async () => {
      // CONFIRM_DELIVERY must see the stop as active while its staged gate runs.
      expect(mockStopUpdateMany).not.toHaveBeenCalled();
      return { ok: true, currentStatus: 'delivered', stateVersion: 6 };
    });

    const result = await completeDelivery({
      ...COMMAND,
      signatureEvidenceId: EVIDENCE_ID,
    });

    expect(result).toMatchObject({ stopId: COMMAND.stopId, orderId });
    expect(mockPodCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_org_id: COMMAND.tenantId,
        pod_notes: COMMAND.podNotes,
      }),
    }));
    expect(mockQueryRaw).toHaveBeenCalledTimes(5);
    // The file must be a READY, unlocked ORDER_FILE of this tenant, this stop's order and this stop.
    const [select, ...selectValues] = mockQueryRaw.mock.calls[3];
    expect(select.join('?')).toMatch(/FROM public\.org_file_mst[\s\S]*locked_at IS NULL[\s\S]*FOR UPDATE/);
    expect(selectValues).toEqual(expect.arrayContaining([COMMAND.tenantId, orderId, COMMAND.stopId, 'ORDER_FILE', 'DELIVERY_STOP', 'READY', [EVIDENCE_ID]]));
    // ...and is locked as proof in the same transaction.
    const [lock, ...lockValues] = mockQueryRaw.mock.calls[4];
    expect(lock.join('?')).toMatch(/UPDATE public\.org_file_mst[\s\S]*SET locked_at/);
    expect(lockValues).toEqual(expect.arrayContaining([COMMAND.tenantId, [EVIDENCE_ID], COMMAND.actorUserId]));
    expect(mockExecuteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: COMMAND.tenantId,
        orderId,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        channel: 'staff_web',
        input: expect.objectContaining({ podId: '55555555-5555-4555-8555-555555555555', signatureEvidenceId: EVIDENCE_ID, photoEvidenceIds: [] }),
      }),
      expect.anything(),
    );
  });

  it('rejects a proof file that is already used, unfinished, or from another stop', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: 'SIGNATURE' }])
      .mockResolvedValueOnce([]); // the locked-file query found nothing usable

    await expect(completeDelivery({ ...COMMAND, signatureEvidenceId: EVIDENCE_ID }))
      .rejects.toMatchObject<DeliveryCompletionError>({ code: 'POD_EVIDENCE_INVALID', httpStatus: 422 });
    expect(mockPodCreate).not.toHaveBeenCalled();
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('rejects a delivery photo offered as the signature', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: 'SIGNATURE' }])
      .mockResolvedValueOnce([{ id: EVIDENCE_ID, purpose_code: 'DELIVERY_PROOF' }]);

    await expect(completeDelivery({ ...COMMAND, signatureEvidenceId: EVIDENCE_ID }))
      .rejects.toMatchObject<DeliveryCompletionError>({ code: 'POD_EVIDENCE_INVALID', httpStatus: 422 });
    expect(mockPodCreate).not.toHaveBeenCalled();
  });

  it('blocks pay-on-collection completion while an outstanding balance remains', async () => {
    mockQueryRaw.mockResolvedValueOnce([lockedStop({
      payment_type_code: 'PAY_ON_COLLECTION',
      outstanding_amount: '4.5000',
    })]);

    await expect(completeDelivery({
      ...COMMAND,
      signatureEvidenceId: EVIDENCE_ID,
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'DELIVERY_COLLECTION_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockStopUpdateMany).not.toHaveBeenCalled();
    expect(mockPodCreate).not.toHaveBeenCalled();
  });

  it('rejects OTP until durable expiry and retry controls exist', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([]);

    await expect(completeDelivery({
      ...COMMAND,
      podMethodCode: 'OTP',
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'POD_METHOD_INVALID',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('requires both signature and photo receipts for MIXED proof', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: 'MIXED' }])
      .mockResolvedValueOnce([{ id: EVIDENCE_ID, purpose_code: 'SIGNATURE' }]);

    await expect(completeDelivery({
      ...COMMAND,
      podMethodCode: 'MIXED',
      signatureEvidenceId: EVIDENCE_ID,
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'POD_EVIDENCE_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockStopUpdateMany).not.toHaveBeenCalled();
  });

  it('does not reveal another tenant stop', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    await expect(completeDelivery({
      ...COMMAND,
      signatureEvidenceId: EVIDENCE_ID,
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'STOP_NOT_FOUND',
      httpStatus: 404,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('rejects an unbound stop instead of confirming delivery without live policy', async () => {
    mockLoadArtifact.mockResolvedValue(null);
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([]);

    await expect(completeDelivery({
      ...COMMAND,
      signatureEvidenceId: EVIDENCE_ID,
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'DELIVERY_POLICY_UNAVAILABLE',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('rejects a catalog POD method that the compiled delivery evidence does not permit', async () => {
    const photoId = '44444444-4444-4444-8444-444444444445';
    mockLoadArtifact.mockResolvedValue({
      evidence: [{
        fulfilment_channel: 'delivery',
        evidence_method_code: 'signature',
        is_required: true,
        minimum_count: 1,
        display_order: 1,
      }],
    });
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: photoId, purpose_code: 'DELIVERY_PROOF' }]);

    await expect(completeDelivery({
      ...COMMAND,
      podMethodCode: 'PHOTO',
      photoEvidenceIds: [photoId],
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'POD_METHOD_INVALID',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockPodCreate).not.toHaveBeenCalled();
  });

  it('completes compiled POD confirmation without photo or signature uploads', async () => {
    mockLoadArtifact.mockResolvedValue({
      evidence: [{
        fulfilment_channel: 'delivery',
        evidence_method_code: 'pod',
        is_required: false,
        minimum_count: 0,
        display_order: 1,
      }],
    });
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([]);

    const result = await completeDelivery({
      ...COMMAND,
      podMethodCode: 'POD',
    });

    expect(result).toMatchObject({ stopId: COMMAND.stopId, orderId: ORDER_ID });
    expect(mockPodCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pod_method_code: 'POD',
        pod_notes: COMMAND.podNotes,
      }),
    }));
    expect(mockExecuteAction).toHaveBeenCalled();
  });

  it('requires compiled delivery notes even when POD confirmation is otherwise complete', async () => {
    mockLoadArtifact.mockResolvedValue({
      evidence: [{
        fulfilment_channel: 'delivery',
        evidence_method_code: 'notes',
        is_required: true,
        minimum_count: 0,
        display_order: 1,
      }],
    });
    mockQueryRaw
      .mockResolvedValueOnce([lockedStop()])
      .mockResolvedValueOnce([]);

    await expect(completeDelivery({
      ...COMMAND,
      podMethodCode: 'POD',
      podNotes: '   ',
    })).rejects.toMatchObject<DeliveryCompletionError>({
      code: 'POD_EVIDENCE_REQUIRED',
      httpStatus: 422,
    });

    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockPodCreate).not.toHaveBeenCalled();
  });
});
