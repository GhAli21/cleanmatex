/**
 * Unit Tests for ItemProcessingService (PRD-010)
 * Tests for 5-step processing tracking and item completion
 */

import { ItemProcessingService } from '@/lib/services/item-processing-service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFrom = jest.fn();
const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock('@/lib/services/processing-steps-service', () => ({
  ProcessingStepsService: {
    isValidStepForCategory: jest.fn().mockResolvedValue(true),
    getValidStepCodes: jest.fn().mockResolvedValue(['sorting', 'washing', 'drying', 'finishing']),
  },
}));

jest.mock('@/lib/services/workflow-service', () => ({
  WorkflowService: {
    transitionOrder: jest.fn().mockResolvedValue({ success: true }),
    changeStatus: jest.fn().mockResolvedValue({ success: true }),
    getAllowedTransitions: jest.fn().mockResolvedValue([]),
    isTransitionAllowed: jest.fn().mockResolvedValue({ isAllowed: true }),
    getOrderState: jest.fn().mockResolvedValue(null),
    getWorkflowTemplate: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/services/order-service', () => ({
  OrderService: {
    getOrderById: jest.fn().mockResolvedValue(null),
  },
}));

// ---------------------------------------------------------------------------
// Helper: build a self-referencing chainable mock
// ---------------------------------------------------------------------------

function makeChain(terminalMethods: Record<string, jest.Mock>) {
  const chain: Record<string, jest.Mock> = {};
  const chainable = ['select', 'eq', 'in', 'order', 'insert', 'update', 'delete', 'upsert'];
  chainable.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  Object.assign(chain, terminalMethods);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ItemProcessingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  // --------------------------------------------------------------------------
  describe('recordProcessingStep', () => {
    it('should return failure when order item is not found', async () => {
      mockFrom.mockReturnValue(
        makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }) })
      );

      const result = await ItemProcessingService.recordProcessingStep({
        orderId: 'order-1',
        orderItemId: 'nonexistent',
        tenantId: 'tenant-1',
        stepCode: 'sorting',
        stepSeq: 1,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order item not found');
    });

    it('should return failure when item has no service category', async () => {
      mockFrom.mockReturnValue(
        makeChain({
          single: jest.fn().mockResolvedValue({
            data: { service_category_code: null, branch_id: 'branch-1' },
            error: null,
          }),
        })
      );

      const result = await ItemProcessingService.recordProcessingStep({
        orderId: 'order-1',
        orderItemId: 'item-1',
        tenantId: 'tenant-1',
        stepCode: 'sorting',
        stepSeq: 1,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service category not found');
    });

    it('should record step successfully (happy path)', async () => {
      let callCount = 0;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_order_items_dtl') {
          return makeChain({
            single: jest.fn().mockResolvedValue({
              data: { service_category_code: 'LAUNDRY', branch_id: 'branch-1' },
              error: null,
            }),
          });
        }
        if (table === 'org_order_item_processing_steps') {
          callCount++;
          if (callCount === 1) {
            // check for existing step
            return makeChain({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            });
          }
          // insert step
          return makeChain({
            single: jest.fn().mockResolvedValue({
              data: { id: 'step-1', done_at: new Date().toISOString() },
              error: null,
            }),
          });
        }
        return makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: null }) });
      });

      const result = await ItemProcessingService.recordProcessingStep({
        orderId: 'order-1',
        orderItemId: 'item-1',
        tenantId: 'tenant-1',
        stepCode: 'sorting',
        stepSeq: 1,
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  describe('markItemComplete', () => {
    it('should return failure when item update fails', async () => {
      mockFrom.mockReturnValue(
        makeChain({ mockResolvedValue: undefined } as any)
      );

      // org_order_items_dtl update → error
      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_order_items_dtl') {
          const chain: any = {};
          chain.update = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
            }),
          });
          return chain;
        }
        return makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: null }) });
      });

      const result = await ItemProcessingService.markItemComplete({
        orderId: 'order-1',
        orderItemId: 'item-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to mark item as complete');
    });

    it('should mark item complete and return allItemsReady', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_order_items_dtl') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        if (table === 'org_orders_mst') {
          const chain: Record<string, jest.Mock> = {};
          chain.select = jest.fn().mockReturnValue(chain);
          chain.eq = jest.fn().mockReturnValue(chain);
          chain.single = jest.fn().mockResolvedValue({
            data: {
              id: 'order-1',
              current_status: 'processing',
              items: [{ item_status: 'ready' }],
            },
            error: null,
          });
          return chain;
        }
        return makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: null }) });
      });

      const result = await ItemProcessingService.markItemComplete({
        orderId: 'order-1',
        orderItemId: 'item-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(typeof result.allItemsReady).toBe('boolean');
    });
  });

  // --------------------------------------------------------------------------
  describe('getItemSteps', () => {
    it('should return processing steps for item', async () => {
      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockResolvedValue({
        data: [
          { id: 'step-1', step_code: 'sorting', step_seq: 1 },
          { id: 'step-2', step_code: 'washing', step_seq: 2 },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await ItemProcessingService.getItemSteps('item-1', 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps![0].step_code).toBe('sorting');
    });

    it('should return empty steps when no history', async () => {
      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await ItemProcessingService.getItemSteps('item-1', 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.steps).toEqual([]);
    });
  });
});
