/**
 * Tenant Isolation Tests for WorkflowServiceEnhanced
 * Verifies that cross-tenant order access returns "Order not found"
 * Plan: cancel_and_return_order_ddb29821.plan.md
 */

import { WorkflowServiceEnhanced } from '@/lib/services/workflow-service-enhanced';

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

jest.mock('@/lib/services/payment-service', () => ({
  getPaymentsForOrder: jest.fn().mockResolvedValue([]),
  cancelPayment: jest.fn().mockResolvedValue({ success: true }),
  refundPayment: jest.fn().mockResolvedValue({ success: true }),
}));

describe('WorkflowServiceEnhanced — Tenant Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
  });

  describe('Order not found (RLS / cross-tenant)', () => {
    it('should throw ValidationError when order fetch returns null (RLS blocks)', async () => {
      // Simulate RLS blocking: order belongs to another tenant, so fetch returns no row
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Row not found', code: 'PGRST116' },
            }),
          }),
        }),
      });

      await expect(
        WorkflowServiceEnhanced.executeScreenTransition(
          'canceling',
          'order-from-other-tenant',
          { cancelled_note: 'Customer requested cancellation' }
        )
      ).rejects.toMatchObject({
        name: 'ValidationError',
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    });

    it('should throw ValidationError when order fetch returns error', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      await expect(
        WorkflowServiceEnhanced.executeScreenTransition(
          'returning',
          'invalid-order-id',
          { return_reason: 'Customer changed mind' }
        )
      ).rejects.toMatchObject({
        name: 'ValidationError',
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    });
  });

  describe('RPC uses tenant from order (not from input)', () => {
    it('should pass order.tenant_org_id to cancel RPC, not input.tenantId', async () => {
      const orderTenantId = 'tenant-from-order-123';
      const createChain = (singleRes: unknown, inRes: unknown) => {
        const chain: Record<string, jest.Mock> = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue(inRes),
          single: jest.fn().mockResolvedValue(singleRes),
        };
        return chain;
      };
      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_orders_mst') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'order-1',
                    tenant_org_id: orderTenantId,
                    current_status: 'intake',
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'org_users_mst') {
          return createChain(
            { data: { roles: ['operator'] }, error: null },
            null
          );
        }
        if (table === 'sys_rbac_permissions_cd') {
          return createChain(null, {
            data: [{ permission_key: 'orders:cancel' }],
            error: null,
          });
        }
        return createChain({ data: null, error: null }, { data: [], error: null });
      });

      mockRpc
        .mockResolvedValueOnce({
          data: {
            statuses: ['draft', 'intake', 'preparation', 'processing', 'assembly', 'qa', 'packing', 'ready', 'out_for_delivery'],
            required_permissions: ['orders:cancel'],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ok: true, from_status: 'intake', to_status: 'cancelled' },
          error: null,
        });

      await WorkflowServiceEnhanced.executeScreenTransition(
        'canceling',
        'order-1',
        {
          to_status: 'cancelled',
          cancelled_note: 'Customer requested cancellation',
          tenantId: 'evil-tenant-from-input', // Should be ignored
          tenant_org_id: 'another-evil-tenant',
        },
        { useOldWfCodeOrNew: true } // Force new workflow path (cmx_ord_canceling_transition)
      );

      expect(mockRpc).toHaveBeenCalledWith(
        'cmx_ord_canceling_transition',
        expect.objectContaining({
          p_tenant_org_id: orderTenantId,
          p_order_id: 'order-1',
        })
      );
      expect(mockRpc).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          p_tenant_org_id: 'evil-tenant-from-input',
        })
      );
      expect(mockRpc).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          p_tenant_org_id: 'another-evil-tenant',
        })
      );
    });
  });
});
