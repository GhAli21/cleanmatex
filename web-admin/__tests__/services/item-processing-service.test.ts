/**
 * Unit Tests for ItemProcessingService (PRD-010)
 * Tests for 5-step processing tracking and item completion
 */

import { ItemProcessingService } from '@/lib/services/item-processing-service';

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
    })),
  })),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('ItemProcessingService', () => {
  let itemProcessingService: ItemProcessingService;

  beforeEach(() => {
    itemProcessingService = new ItemProcessingService();
    jest.clearAllMocks();
  });

  describe('recordItemProcessingStep', () => {
    test('should record processing step and update item', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      let stepInserted = false;
      let itemUpdated = false;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_order_item_processing_steps') {
          stepInserted = true;
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: {
                      id: 'step-1',
                      step_code: 'sorting',
                      step_seq: 1,
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        if (table === 'org_order_items_dtl') {
          itemUpdated = true;
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() =>
                    Promise.resolve({
                      data: { id: 'item-1', item_last_step: 'sorting' },
                      error: null,
                    })
                  ),
                })),
              })),
            })),
          };
        }
        return { select: jest.fn() };
      });

      await itemProcessingService.recordItemProcessingStep(
        'test-tenant-id',
        'test-order-id',
        'item-1',
        'sorting',
        1,
        'test-user-id'
      );

      expect(stepInserted).toBe(true);
      expect(itemUpdated).toBe(true);
    });

    test('should handle all 5 processing steps', async () => {
      const steps = [
        { code: 'sorting', seq: 1 },
        { code: 'pretreatment', seq: 2 },
        { code: 'washing', seq: 3 },
        { code: 'drying', seq: 4 },
        { code: 'finishing', seq: 5 },
      ];

      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_order_item_processing_steps') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
              })),
            })),
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
              })),
            })),
          })),
        };
      });

      for (const step of steps) {
        await itemProcessingService.recordItemProcessingStep(
          'test-tenant-id',
          'test-order-id',
          'item-1',
          step.code,
          step.seq,
          'test-user-id'
        );
      }

      expect(mockFrom).toHaveBeenCalledTimes(10); // 5 inserts + 5 updates
    });
  });

  describe('markItemComplete', () => {
    test('should mark item as completed and update status', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'item-1',
                    item_status: 'ready',
                    item_last_step: 'finishing',
                  },
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      const item = await itemProcessingService.markItemComplete(
        'test-tenant-id',
        'test-order-id',
        'item-1',
        'test-user-id'
      );

      expect(item?.item_status).toBe('ready');
      expect(item?.item_last_step).toBe('finishing');
    });

    test('should handle missing item', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({ data: null, error: { code: 'PGRST116' } })
              ),
            })),
          })),
        })),
      });

      const item = await itemProcessingService.markItemComplete(
        'test-tenant-id',
        'test-order-id',
        'nonexistent-item',
        'test-user-id'
      );

      expect(item).toBeNull();
    });
  });

  describe('getItemProcessingHistory', () => {
    test('should fetch all processing steps for item', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'step-1',
                    step_code: 'sorting',
                    step_seq: 1,
                    completed_at: new Date().toISOString(),
                  },
                  {
                    id: 'step-2',
                    step_code: 'pretreatment',
                    step_seq: 2,
                    completed_at: new Date().toISOString(),
                  },
                ],
                error: null,
              })
            ),
          })),
        })),
      });

      const history = await itemProcessingService.getItemProcessingHistory(
        'test-tenant-id',
        'test-order-id',
        'item-1'
      );

      expect(history).toHaveLength(2);
      expect(history[0].step_code).toBe('sorting');
      expect(history[1].step_code).toBe('pretreatment');
    });

    test('should return empty array for no history', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({ data: [], error: null })
            ),
          })),
        })),
      });

      const history = await itemProcessingService.getItemProcessingHistory(
        'test-tenant-id',
        'test-order-id',
        'item-1'
      );

      expect(history).toEqual([]);
    });
  });
});

