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

  it('consumes the exact tenant-stop receipt before committing the workflow transition', async () => {
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
      .mockResolvedValueOnce([{
        id: EVIDENCE_ID,
        evidence_type: 'signature',
        object_key: `${COMMAND.tenantId}/delivery/${COMMAND.stopId}/${EVIDENCE_ID}.jpeg`,
      }])
      .mockResolvedValueOnce([{ id: EVIDENCE_ID }]);

    const result = await completeDelivery({
      ...COMMAND,
      signatureEvidenceId: EVIDENCE_ID,
    });

    expect(result).toMatchObject({ stopId: COMMAND.stopId, orderId });
    expect(mockPodCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenant_org_id: COMMAND.tenantId,
        signature_object_key: `${COMMAND.tenantId}/delivery/${COMMAND.stopId}/${EVIDENCE_ID}.jpeg`,
        photo_object_keys: [],
        pod_notes: COMMAND.podNotes,
      }),
    }));
    expect(mockQueryRaw).toHaveBeenCalledTimes(5);
    expect(mockExecuteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: COMMAND.tenantId,
        orderId,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        input: expect.objectContaining({ podId: '55555555-5555-4555-8555-555555555555' }),
      }),
      expect.anything(),
    );
  });
});
