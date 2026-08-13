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

jest.mock('@/lib/services/workflow/workflow-engine.service', () => ({
  executeAction: jest.fn().mockResolvedValue({
    ok: true,
    currentStatus: 'ready',
    stateVersion: 4,
  }),
  listAvailableActions: jest.fn().mockResolvedValue({
    stateVersion: 3,
    currentStatus: 'processing',
    actions: [],
  }),
}));

jest.mock('@/lib/constants/workflow-actions', () => ({
  WORKFLOW_ACTIONS: {
    COMPLETE_PROCESSING: 'COMPLETE_PROCESSING',
  },
}));

jest.mock('@/lib/services/order-service', () => ({
  OrderService: {
    getOrderById: jest.fn().mockResolvedValue(null),
  },
}));

import {
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';

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
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
              }),
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
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ error: null }),
                }),
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

    it('uses the engine to auto-ready a tenant order when all items and rack are ready', async () => {
      let orderQueryCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_order_items_dtl') {
          return makeChain({
            single: jest.fn(),
          });
        }
        if (table === 'org_orders_mst') {
          orderQueryCount += 1;
          return makeChain({
            single: jest.fn().mockResolvedValue(
              orderQueryCount === 1
                ? {
                    data: {
                      id: 'order-1',
                      current_status: 'processing',
                      items: [{ item_status: 'ready' }],
                    },
                    error: null,
                  }
                : { data: { rack_location: 'RACK-A1' }, error: null },
            ),
          });
        }
        return makeChain({ single: jest.fn() });
      });

      const result = await ItemProcessingService.markItemComplete({
        orderId: 'order-1',
        orderItemId: 'item-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result).toEqual({ success: true, allItemsReady: true });
      expect(listAvailableActions).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        screen: 'processing',
      });
      expect(executeAction).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        screen: 'processing',
        actionCode: 'COMPLETE_PROCESSING',
        expectedStateVersion: 3,
        actorUserId: 'user-1',
        actorName: 'Test User',
        input: {
          notes: 'All items processed',
          preferredToStatus: 'ready',
          rackLocation: 'RACK-A1',
        },
        idempotencyKey: 'item-auto-ready:tenant-1:order-1',
      });
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
