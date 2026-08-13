/**
 * Unit Tests for WorkflowService (PRD-010)
 * Tests for workflow transitions, template resolution, and validation
 */

import { WorkflowService } from '@/lib/services/workflow-service';
import { listWorkflowScreenKeysForStatus } from '@/lib/services/workflow-profile.service';
import { listAvailableActions } from '@/lib/services/workflow/workflow-engine.service';

jest.mock('@/lib/services/workflow-profile.service', () => ({
  listWorkflowScreenKeysForStatus: jest.fn(),
}));

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  listAvailableActions: jest.fn(),
}));

const mockListWorkflowScreenKeysForStatus =
  listWorkflowScreenKeysForStatus as jest.Mock;
const mockListAvailableActions = listAvailableActions as jest.Mock;

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
    test('should reject the retired raw-status mutation contract', async () => {
      const result = await WorkflowService.changeStatus({
        tenantId: 'test-tenant-id',
        orderId: 'test-order-id',
        fromStatus: 'intake' as any,
        toStatus: 'processing' as any,
        userId: 'test-user-id',
        userName: 'Test User',
        notes: 'Starting processing',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('configured workflow action');
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('getAllowedTransitions', () => {
    test('should map and deduplicate configured application-engine actions', async () => {
      mockListWorkflowScreenKeysForStatus.mockResolvedValue([
        'processing',
        'canceling',
      ]);
      mockListAvailableActions
        .mockResolvedValueOnce({
          stateVersion: 2,
          currentStatus: 'processing',
          actions: [
            {
              actionCode: 'COMPLETE_PROCESSING',
              toStatus: 'assembly',
              label: 'Complete processing',
              label2: null,
              enabled: true,
              blockedReasons: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          stateVersion: 2,
          currentStatus: 'processing',
          actions: [
            {
              actionCode: 'COMPLETE_PROCESSING',
              toStatus: 'assembly',
              label: 'Complete processing',
              label2: null,
              enabled: true,
              blockedReasons: [],
            },
            {
              actionCode: 'CANCEL_ORDER',
              toStatus: 'cancelled',
              label: 'Cancel order',
              label2: null,
              enabled: false,
              blockedReasons: [{ code: 'GATE', message: 'Blocked' }],
            },
          ],
        });

      const result = await WorkflowService.getAllowedTransitions(
        'test-order-id',
        'test-tenant-id',
        'processing' as any,
      );

      expect(mockListWorkflowScreenKeysForStatus).toHaveBeenCalledWith(
        'test-tenant-id',
        'processing',
      );
      expect(mockListAvailableActions).toHaveBeenCalledWith({
        tenantId: 'test-tenant-id',
        orderId: 'test-order-id',
        screen: 'processing',
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          to: 'assembly',
          to_status: 'assembly',
          action_code: 'COMPLETE_PROCESSING',
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          to: 'cancelled',
          enabled: false,
          blocked_reasons: [{ code: 'GATE', message: 'Blocked' }],
        }),
      );
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    test('should return empty array on error', async () => {
      mockListWorkflowScreenKeysForStatus.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await WorkflowService.getAllowedTransitions(
        'test-order-id',
        'test-tenant-id',
        'processing' as any,
      );

      expect(result).toEqual([]);
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('getWorkflowTemplate', () => {
    test('should fetch workflow template', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      // Service: .from('org_tenant_workflow_templates_cf').select('*,...').eq(...).eq(...).eq(...).single()
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
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
          })),
        })),
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await WorkflowService.getWorkflowTemplate('tenant-1');

      expect(mockFrom).toHaveBeenCalledWith('org_tenant_workflow_templates_cf');
      expect(result?.template_code).toBe('WF_STANDARD');
    });

    test('should return null if template not found', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116' },
                })
              ),
            })),
          })),
        })),
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await WorkflowService.getWorkflowTemplate('nonexistent-tenant');

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
    test('should validate an order transition using configured engine actions', async () => {
      mockListWorkflowScreenKeysForStatus.mockResolvedValue(['processing']);
      mockListAvailableActions.mockResolvedValue({
        stateVersion: 3,
        currentStatus: 'intake',
        actions: [{
          actionCode: 'START_PROCESSING',
          toStatus: 'processing',
          label: 'Start processing',
          label2: null,
          enabled: true,
          blockedReasons: [],
        }],
      });

      const result = await WorkflowService.isTransitionAllowed({
        tenantId: 'test-tenant-id',
        fromStatus: 'intake' as any,
        toStatus: 'processing' as any,
        orderId: 'test-order-id',
      });

      expect(mockListAvailableActions).toHaveBeenCalledWith({
        tenantId: 'test-tenant-id',
        orderId: 'test-order-id',
        screen: 'processing',
      });
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
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
