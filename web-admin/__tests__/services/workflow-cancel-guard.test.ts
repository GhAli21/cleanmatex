/**
 * FN-02 disposition gate (Order-Fin remediation Phase 4) — cancelling an order
 * that holds collected money requires an explicit disposition (REFUND /
 * STORE_CREDIT / KEEP_ON_ACCOUNT); KEEP_ON_ACCOUNT additionally requires
 * `orders:approve_refund`. Credit-only and unpaid orders cancel without a
 * disposition (the unwind reverses applied credit unconditionally).
 *
 * Source: docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md §Phase 4.
 */

import { WorkflowServiceEnhanced } from '@/lib/services/workflow-service-enhanced';
import { WorkflowService } from '@/lib/services/workflow-service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
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

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/services/order-cancel-financials.service', () => ({
  // Values must mirror the real CANCEL_DISPOSITIONS (requireActual would drag
  // the whole service import chain — supabase client — into the test env).
  CANCEL_DISPOSITIONS: {
    REFUND: 'REFUND',
    STORE_CREDIT: 'STORE_CREDIT',
    KEEP_ON_ACCOUNT: 'KEEP_ON_ACCOUNT',
  },
  unwindOrderFinancialsOnCancel: jest.fn().mockResolvedValue({
    reversedCreditApplications: 0,
    restoredStoredValueAmount: 0,
    paidAmountDisposed: 0,
    disposition: null,
    refundIds: [],
    creditNoteId: null,
    warnings: [],
  }),
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
  // Old workflow path has no resolver entry for 'canceling'; the real UI
  // supplies the target status the same way.
  to_status: 'cancelled',
};

describe('WorkflowServiceEnhanced — FN-02 cancel disposition gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
  });

  it('rejects cancelling a paid order without a disposition', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 25.5, total_credit_applied_amount: 0 });

    await expect(
      WorkflowServiceEnhanced.executeScreenTransition('canceling', 'order-1', cancelInput)
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'CANCEL_DISPOSITION_REQUIRED',
    });

    expect(WorkflowService.changeStatus).not.toHaveBeenCalled();
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });

  it('rejects an unknown disposition value', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 25.5 });

    await expect(
      WorkflowServiceEnhanced.executeScreenTransition('canceling', 'order-1', {
        ...cancelInput,
        cancellation_disposition: 'BURN_IT',
      })
    ).rejects.toMatchObject({ code: 'CANCEL_DISPOSITION_REQUIRED' });
  });

  it('cancels a paid order with REFUND and runs the financial unwind', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 25.5 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition('canceling', 'order-1', {
      ...cancelInput,
      cancellation_disposition: 'REFUND',
    });

    expect(result.ok).toBe(true);
    expect(unwindOrderFinancialsOnCancel).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        tenantId: 'tenant-1',
        disposition: 'REFUND',
        reason: 'Customer requested cancellation',
      })
    );
  });

  it('KEEP_ON_ACCOUNT requires orders:approve_refund', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 25.5 });
    (hasPermissionServer as jest.Mock).mockResolvedValue(false);

    await expect(
      WorkflowServiceEnhanced.executeScreenTransition('canceling', 'order-1', {
        ...cancelInput,
        cancellation_disposition: 'KEEP_ON_ACCOUNT',
      })
    ).rejects.toMatchObject({ name: 'PermissionError' });

    expect(hasPermissionServer).toHaveBeenCalledWith('orders:approve_refund');
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });

  it('credit-only orders cancel without a disposition; the unwind still runs', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 0, total_credit_applied_amount: 10 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      'canceling',
      'order-1',
      cancelInput
    );

    expect(result.ok).toBe(true);
    expect(unwindOrderFinancialsOnCancel).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: undefined })
    );
  });

  it('unpaid orders cancel exactly as before', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 0, total_credit_applied_amount: 0 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition(
      'canceling',
      'order-1',
      cancelInput
    );

    expect(result.ok).toBe(true);
    expect(WorkflowService.changeStatus).toHaveBeenCalledTimes(1);
  });

  it('does not gate non-cancel transitions on paid orders', async () => {
    mockOrderFetch({ ...baseOrder, total_paid_amount: 99 });

    const result = await WorkflowServiceEnhanced.executeScreenTransition('processing', 'order-1', {});

    expect(result.ok).toBe(true);
    expect(unwindOrderFinancialsOnCancel).not.toHaveBeenCalled();
  });
});
