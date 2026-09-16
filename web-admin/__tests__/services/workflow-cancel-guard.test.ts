/**
 * Cancel is operational only (ADR_CANCEL_RETURN_RULES): no disposition gate
 * and no automatic financial unwind. Money stays until an explicit Fin action.
 */

import { WorkflowServiceEnhanced } from '@/lib/services/workflow-service-enhanced';
import { WorkflowService } from '@/lib/services/workflow-service';
import { unwindOrderFinancialsOnCancel } from '@/lib/services/order-cancel-financials.service';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/lib/services/feature-flags.service', () => ({
  getFeatureFlags: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/usage-tracking.service', () => ({
  canCreateOrder: jest.fn().mockResolvedValue({ canProceed: true }),
}));

jest.mock('@/lib/api/hq-api-client', () => ({
  hqApiClient: {
    getEffectiveSettings: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/lib/services/workflow-service', () => ({
  WorkflowService: {
    changeStatus: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('@/lib/services/order-cancel-financials.service', () => ({
  unwindOrderFinancialsOnCancel: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

function mockOrderFetch(order: Record<string, unknown>) {
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: order, error: null }),
      }),
    }),
  });
}

const baseOrder = {
  id: 'order-1',
  tenant_org_id: 'tenant-1',
  current_status: 'intake',
  updated_at: '2026-07-01T00:00:00Z',
};

const cancelInput = {
  cancelled_note: 'Customer requested cancellation',
  to_status: 'cancelled',
};

describe('WorkflowServiceEnhanced — cancel has no automatic financial effect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
  });

  it('cancels a paid order without a disposition and without unwind', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 25.5, total_credit_applied_amount: 0 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      'canceling',
      'order-1',
      cancelInput,
    );

    expect(result.ok).toBe(true);
    expect(WorkflowService.changeStatus).toHaveBeenCalledTimes(1);
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });

  it('ignores a disposition payload if the client still sends one', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 25.5 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition('canceling', 'order-1', {
      ...cancelInput,
      cancellation_disposition: 'REFUND',
    });

    expect(result.ok).toBe(true);
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });

  it('cancels credit-only orders without unwind', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 0, total_credit_applied_amount: 10 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      'canceling',
      'order-1',
      cancelInput,
    );

    expect(result.ok).toBe(true);
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });

  it('cancels unpaid orders without unwind', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 0, total_credit_applied_amount: 0 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      'canceling',
      'order-1',
      cancelInput,
    );

    expect(result.ok).toBe(true);
    expect(WorkflowService.changeStatus).toHaveBeenCalledTimes(1);
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });

  it('does not touch financials on non-cancel transitions', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 99 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition('processing', 'order-1', {});

    expect(result.ok).toBe(true);
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });
});
