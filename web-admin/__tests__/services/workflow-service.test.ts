/**
 * Unit Tests for WorkflowService (PRD-010)
 * Tests for workflow transitions, template resolution, and validation
 */

import { WorkflowService } from '@/lib/services/workflow-service';

// Mock Supabase
const mockSupabaseClient = {
  rpc: jest.fn(),
  from: jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('WorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('changeStatus', () => {
    test('should call PostgreSQL function for transition', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await WorkflowService.changeStatus({
        tenantId: 'test-tenant-id',
        orderId: 'test-order-id',
        fromStatus: 'intake' as any,
        toStatus: 'processing' as any,
        userId: 'test-user-id',
        userName: 'Test User',
        notes: 'Starting processing',
      });

      expect(mockRpc).toHaveBeenCalledWith('cmx_order_transition', expect.any(Object));
    });

    test('should handle transition failure', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'Invalid transition' },
        error: null,
      });

      const result = await WorkflowService.changeStatus({
        tenantId: 'test-tenant-id',
        orderId: 'test-order-id',
        fromStatus: 'intake' as any,
        toStatus: 'delivered' as any,
        userId: 'test-user-id',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    test('should fetch allowed transitions from RPC', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: {
          transitions: [
            { to_status: 'processing', requires_notes: false },
            { to_status: 'cancelled', requires_notes: true },
          ],
        },
        error: null,
      });

      const result = await WorkflowService.getAllowedTransitions('test-order-id', 'test-tenant-id');

      expect(mockRpc).toHaveBeenCalledWith('cmx_get_allowed_transitions', expect.objectContaining({
        p_order: 'test-order-id',
      }));
      expect(result).toHaveLength(2);
    });

    test('should return empty array on error', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await WorkflowService.getAllowedTransitions('test-order-id', 'test-tenant-id');

      expect(result).toEqual([]);
    });
  });

  describe('getWorkflowTemplate', () => {
    test('should fetch workflow template', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: {
                template_id: 'template-1',
                template_code: 'WF_STANDARD',
                template_name: 'Standard Workflow',
              },
              error: null,
            })
          ),
        })),
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await WorkflowService.getWorkflowTemplate('template-1');

      expect(mockFrom).toHaveBeenCalledWith('sys_workflow_template_cd');
      expect(result?.template_code).toBe('WF_STANDARD');
    });

    test('should return null if template not found', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: null,
              error: { code: 'PGRST116' },
            })
          ),
        })),
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await WorkflowService.getWorkflowTemplate('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOrderState', () => {
    test('should return null when order not found', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      });

      const state = await WorkflowService.getOrderState('test-order-id', 'test-tenant-id');

      expect(state).toBeNull();
    });
  });

  describe('isTransitionAllowed', () => {
    test('should validate transition when orderId provided', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: { allowed: true },
        error: null,
      });

      const result = await WorkflowService.isTransitionAllowed({
        tenantId: 'test-tenant-id',
        fromStatus: 'intake' as any,
        toStatus: 'processing' as any,
        orderId: 'test-order-id',
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'cmx_validate_transition',
        expect.objectContaining({
          p_from: 'intake',
          p_to: 'processing',
        })
      );
      expect(result.isAllowed).toBe(true);
    });

    test('should use legacy logic when no orderId', async () => {
      const result = await WorkflowService.isTransitionAllowed({
        tenantId: 'test-tenant-id',
        fromStatus: 'intake' as any,
        toStatus: 'processing' as any,
      });

      // Should fall back to legacy validation
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
      expect(typeof result.isAllowed).toBe('boolean');
    });
  });
});
