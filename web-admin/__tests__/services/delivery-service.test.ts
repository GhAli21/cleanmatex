/** @jest-environment node */

const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  executeAction: jest.fn(),
  listAvailableActions: jest.fn(),
}));

jest.mock('@/lib/constants/workflow-actions', () => ({
  WORKFLOW_ACTIONS: {
    CONFIRM_DELIVERY: 'CONFIRM_DELIVERY',
  },
}));

import { DeliveryService } from '@/lib/services/delivery-service';
import {
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';

function createSelectChain(result: unknown) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

function createWriteChain(result?: unknown) {
  const chain: Record<string, jest.Mock> = {};
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('DeliveryService.capturePOD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listAvailableActions as jest.Mock).mockResolvedValue({ stateVersion: 11 });
    (executeAction as jest.Mock).mockResolvedValue({
      ok: true,
      currentStatus: 'delivered',
      stateVersion: 12,
    });
  });

  it('always confirms delivery through the workflow engine with POD idempotency', async () => {
    let stopCalls = 0;
    let podCalls = 0;
    const stopSelect = createSelectChain({
      data: { id: 'stop-1', branch_id: 'branch-1', order: { id: 'order-1' } },
      error: null,
    });
    const stopUpdate = createWriteChain();
    const podLookup = createSelectChain({ data: null, error: null });
    const podInsert = createWriteChain({ data: { id: 'pod-1' }, error: null });

    mockCreateClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'org_dlv_stops_dtl') {
          stopCalls += 1;
          return stopCalls === 1 ? stopSelect : stopUpdate;
        }
        if (table === 'org_dlv_pod_tr') {
          podCalls += 1;
          return podCalls === 1 ? podLookup : podInsert;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const result = await DeliveryService.capturePOD({
      stopId: 'stop-1',
      tenantId: 'tenant-1',
      podMethodCode: 'signature',
      signatureUrl: 'private/pod/signature-1.png',
      userId: 'user-1',
    });

    expect(result).toEqual({ success: true, podId: 'pod-1' });
    expect(stopSelect.eq).toHaveBeenCalledWith('tenant_org_id', 'tenant-1');
    expect(stopUpdate.eq).toHaveBeenCalledWith('tenant_org_id', 'tenant-1');
    expect(podLookup.eq).toHaveBeenCalledWith('tenant_org_id', 'tenant-1');
    expect(listAvailableActions).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      screen: 'driver_delivery',
    });
    expect(executeAction).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      screen: 'driver_delivery',
      actionCode: 'CONFIRM_DELIVERY',
      expectedStateVersion: 11,
      actorUserId: 'user-1',
      actorName: 'Delivery Service',
      input: {
        podId: 'pod-1',
        podMethodCode: 'signature',
        otpVerified: false,
        signatureUrl: 'private/pod/signature-1.png',
        photoUrls: [],
      },
      idempotencyKey: 'confirm-delivery:pod:pod-1',
    });
  });
});
