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
  let workflowService: WorkflowService;

  beforeEach(() => {
    workflowService = new WorkflowService();
    jest.clearAllMocks();
  });

  describe('changeStatus', () => {
    test('should call PostgreSQL function for transition', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await workflowService.changeStatus(
        'test-tenant-id',
        'test-order-id',
        'intake',
        'processing',
        'test-user-id',
        { notes: 'Starting processing' }
      );

      expect(mockRpc).toHaveBeenCalledWith('cmx_order_transition', expect.any(Object));
    });

    test('should handle transition failure', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'Invalid transition' },
        error: null,
      });

      const result = await workflowService.changeStatus(
        'test-tenant-id',
        'test-order-id',
        'intake',
        'delivered',
        'test-user-id'
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    test('should fetch allowed transitions from RPC', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: [
          { to_status: 'processing', requires_notes: false },
          { to_status: 'cancelled', requires_notes: true },
        ],
        error: null,
      });

      const result = await workflowService.getAllowedTransitions('test-order-id');

      expect(mockRpc).toHaveBeenCalledWith('cmx_get_allowed_transitions', { p_order_id: 'test-order-id' });
      expect(result).toHaveLength(2);
    });

    test('should return empty array on error', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await workflowService.getAllowedTransitions('test-order-id');

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

      const result = await workflowService.getWorkflowTemplate('template-1');

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

      const result = await workflowService.getWorkflowTemplate('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOrderState', () => {
    test('should return order state with flags and transitions', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValueOnce({
        data: {
          has_split: false,
          has_issue: false,
          is_rejected: false,
          can_split: true,
          can_create_issue: true,
        },
        error: null,
      });
      mockRpc.mockResolvedValueOnce({
        data: [{ to_status: 'processing' }, { to_status: 'cancelled' }],
        error: null,
      });

      const state = await workflowService.getOrderState(
        'test-tenant-id',
        'test-order-id'
      );

      expect(state.hasSplit).toBe(false);
      expect(state.allowedTransitions).toHaveLength(2);
    });
  });

  describe('isTransitionAllowed', () => {
    test('should validate transition when orderId provided', async () => {
      const mockRpc = mockSupabaseClient.rpc as jest.Mock;
      mockRpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await workflowService.isTransitionAllowed(
        'test-tenant-id',
        'intake',
        'processing',
        'test-order-id'
      );

      expect(mockRpc).toHaveBeenCalledWith(
        'cmx_validate_transition',
        expect.objectContaining({
          p_from_status: 'intake',
          p_to_status: 'processing',
        })
      );
      expect(result).toBe(true);
    });

    test('should use legacy logic when no orderId', async () => {
      const result = await workflowService.isTransitionAllowed(
        'test-tenant-id',
        'intake',
        'processing'
      );

      // Should fall back to legacy validation
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
      expect(typeof result).toBe('boolean');
    });
  });
});

