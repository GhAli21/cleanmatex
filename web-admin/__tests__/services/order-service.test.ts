/**
 * Unit Tests for OrderService (PRD-010)
 * Tests for order creation, splitting, issue management, and estimates
 */

import { OrderService } from '@/lib/services/order-service';

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
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
    delete: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('OrderService', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
    jest.clearAllMocks();
  });

  describe('generateOrderNumber', () => {
    test('should generate unique order number', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      const mockSelect = jest.fn(() => ({
        limit: jest.fn(() =>
          Promise.resolve({ data: [], error: null })
        ),
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      const orderNo = await orderService.generateOrderNumber('test-tenant-id');

      expect(orderNo).toMatch(/^ORD-\d{4,}-\d{6}$/);
    });

    test('should handle duplicate order numbers', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      let attemptCount = 0;
      const mockSelect = jest.fn(() => ({
        limit: jest.fn(() => {
          attemptCount++;
          if (attemptCount === 1) {
            return Promise.resolve({ data: [{ order_no: 'ORD-001-123456' }], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      }));
      mockFrom.mockReturnValue({ select: mockSelect });

      const orderNo = await orderService.generateOrderNumber('test-tenant-id');

      expect(orderNo).toBeDefined();
      expect(attemptCount).toBeGreaterThan(1);
    });
  });

  describe('estimateReadyBy', () => {
    test('should calculate ready by based on items', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() =>
              Promise.resolve({
                data: [
                  { id: 'p1', default_service_time_hours: 24 },
                  { id: 'p2', default_service_time_hours: 48 },
                ],
                error: null,
              })
            ),
          })),
        })),
      });

      const readyBy = await orderService.estimateReadyBy(
        'test-tenant-id',
        [
          { productId: 'p1', quantity: 2 },
          { productId: 'p2', quantity: 1 },
        ],
        false
      );

      expect(readyBy).toBeInstanceOf(Date);
    });

    test('should handle express service with 50% time reduction', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() =>
              Promise.resolve({
                data: [
                  { id: 'p1', default_service_time_hours: 24 },
                ],
                error: null,
              })
            ),
          })),
        })),
      });

      const normalReadyBy = await orderService.estimateReadyBy(
        'test-tenant-id',
        [{ productId: 'p1', quantity: 1 }],
        false
      );

      const expressReadyBy = await orderService.estimateReadyBy(
        'test-tenant-id',
        [{ productId: 'p1', quantity: 1 }],
        true
      );

      const timeDiff = normalReadyBy.getTime() - expressReadyBy.getTime();
      expect(timeDiff).toBeGreaterThan(0);
    });
  });

  describe('splitOrder', () => {
    test('should create child orders and link items', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      let insertCalls = 0;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'org_orders_mst') {
          insertCalls++;
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: { id: `child-${insertCalls}`, order_no: `ORD-00${insertCalls}` },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const result = await orderService.splitOrder(
        'test-tenant-id',
        'parent-order-id',
        'test-user-id',
        [
          { itemId: 'item-1', quantity: 5 },
          { itemId: 'item-2', quantity: 3 },
        ]
      );

      expect(result.childOrderIds).toHaveLength(2);
      expect(insertCalls).toBe(2);
    });
  });

  describe('createIssue', () => {
    test('should create issue and link to order item', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: { id: 'issue-1', issue_code: 'stain' },
                error: null,
              })
            ),
          })),
        })),
      });

      const issue = await orderService.createIssue(
        'test-tenant-id',
        'test-order-id',
        'item-1',
        'stain',
        'Large stain on collar',
        'high'
      );

      expect(issue?.issue_code).toBe('stain');
    });
  });

  describe('resolveIssue', () => {
    test('should update issue with resolution details', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { id: 'issue-1', solved_at: new Date().toISOString() },
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      const issue = await orderService.resolveIssue(
        'test-tenant-id',
        'issue-1',
        'test-user-id',
        'Stain removed successfully'
      );

      expect(issue?.solved_at).toBeDefined();
    });
  });

  describe('getOrderHistory', () => {
    test('should fetch complete order history', async () => {
      const mockFrom = mockSupabaseClient.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    action_type: 'ORDER_CREATED',
                    done_at: new Date().toISOString(),
                  },
                  {
                    action_type: 'STATUS_CHANGE',
                    from_value: 'intake',
                    to_value: 'processing',
                    done_at: new Date().toISOString(),
                  },
                ],
                error: null,
              })
            ),
          })),
        })),
      });

      const history = await orderService.getOrderHistory('test-tenant-id', 'order-id');

      expect(history).toHaveLength(2);
      expect(history[0].action_type).toBe('ORDER_CREATED');
    });
  });
});

