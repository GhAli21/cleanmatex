/**
 * Unit tests for the current static OrderService surface.
 * Focused on the lightweight Supabase-backed methods that remain active in this file.
 */

import { OrderService } from '@/lib/services/order-service';

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
    rpc: jest.fn(),
  })),
}));

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('estimateReadyBy', () => {
    test('returns a ready-by timestamp using service-category turnaround', async () => {
      const categorySingle = jest
        .fn()
        .mockResolvedValueOnce({
          data: { turnaround_hh: 24, turnaround_hh_express: 12 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { turnaround_hh: 48, turnaround_hh_express: 24 },
          error: null,
        });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sys_service_category_cd') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: categorySingle,
              })),
            })),
          };
        }

        if (table === 'sys_service_preference_cd') {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({
                data: [{ code: 'PERFUME', extra_turnaround_minutes: 30 }],
                error: null,
              }),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      const result = await OrderService.estimateReadyBy({
        items: [
          { serviceCategoryCode: 'WASH', quantity: 2, servicePrefs: [{ preference_code: 'PERFUME' }] },
          { serviceCategoryCode: 'DRY', quantity: 1 },
        ],
        express: false,
      });

      expect(result.success).toBe(true);
      expect(result.readyByAt).toBeDefined();
      expect(Number.isNaN(Date.parse(result.readyByAt!))).toBe(false);
    });

    test('uses faster express turnaround when express is enabled', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sys_service_category_cd') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { turnaround_hh: 24, turnaround_hh_express: 12 },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === 'sys_service_preference_cd') {
          return {
            select: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({ data: [], error: null }),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      const normal = await OrderService.estimateReadyBy({
        items: [{ serviceCategoryCode: 'WASH', quantity: 1 }],
        express: false,
      });
      const express = await OrderService.estimateReadyBy({
        items: [{ serviceCategoryCode: 'WASH', quantity: 1 }],
        express: true,
      });

      expect(normal.success).toBe(true);
      expect(express.success).toBe(true);
      expect(Date.parse(express.readyByAt!)).toBeLessThan(Date.parse(normal.readyByAt!));
    });
  });

  describe('splitOrder', () => {
    test('creates a split suborder and logs the action', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'org_orders_mst') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'parent-order-id',
                      branch_id: 'branch-1',
                      customer_id: 'customer-1',
                      order_type_id: 'STANDARD',
                      order_no: 'ORD-1001',
                      current_status: 'processing',
                      current_stage: 'intake',
                      priority: 'normal',
                      priority_multiplier: 1,
                      workflow_template_id: 'wf-1',
                      total_items: 5,
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'child-1', order_no: 'ORD-2001' },
                  error: null,
                }),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }

        if (table === 'org_order_items_dtl') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn().mockResolvedValue({
                    data: [
                      { id: 'item-1', total_price: 20 },
                      { id: 'item-2', total_price: 30 },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
            update: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'ORD-2001',
        error: null,
      });

      const result = await OrderService.splitOrder(
        'parent-order-id',
        'tenant-1',
        ['item-1', 'item-2'],
        'Separate delicate items',
        'user-1',
        'Tester'
      );

      expect(result.success).toBe(true);
      expect(result.suborder).toEqual({ id: 'child-1', orderNo: 'ORD-2001' });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('generate_order_number', {
        p_tenant_org_id: 'tenant-1',
      });
    });
  });

  describe('createIssue', () => {
    test('creates an issue and marks the order as having an issue', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'org_order_item_issues') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'issue-1', issue_code: 'stain' },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === 'org_order_items_dtl' || table === 'org_orders_mst') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await OrderService.createIssue(
        'order-1',
        'item-1',
        'tenant-1',
        'stain',
        'Large stain on collar',
        'user-1',
        undefined,
        'high'
      );

      expect(result.success).toBe(true);
      expect(result.issue).toEqual({ id: 'issue-1', issue_code: 'stain' });
    });

    test('creates an order-level issue when orderItemId is null', async () => {
      const insertMock = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 'issue-2', issue_code: 'other', order_item_id: null },
            error: null,
          }),
        })),
      }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'org_order_item_issues') {
          return { insert: insertMock };
        }

        if (table === 'org_orders_mst') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await OrderService.createIssue(
        'order-1',
        null,
        'tenant-1',
        'other',
        'Order-level issue text',
        'user-1',
        undefined,
        'normal'
      );

      expect(result.success).toBe(true);
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-1',
          order_item_id: null,
          issue_code: 'other',
        })
      );
    });
  });

  describe('resolveIssue', () => {
    test('resolves an issue and clears the order issue flag when all are solved', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'org_order_item_issues') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  select: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({
                      data: {
                        id: 'issue-1',
                        issue_code: 'stain',
                        order_id: 'order-1',
                        solved_at: new Date().toISOString(),
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({
                  data: [{ solved_at: new Date().toISOString() }],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === 'org_orders_mst') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await OrderService.resolveIssue(
        'issue-1',
        'tenant-1',
        'Stain removed successfully',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.issue.id).toBe('issue-1');
      expect(result.issue.solved_at).toBeDefined();
    });
  });

  describe('getOrderHistory', () => {
    test('returns the order history rows in response order', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'org_order_history') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  order: jest.fn().mockResolvedValue({
                    data: [
                      { action_type: 'STATUS_CHANGE', done_at: new Date().toISOString() },
                      { action_type: 'ORDER_CREATED', done_at: new Date().toISOString() },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      const history = await OrderService.getOrderHistory('order-1', 'tenant-1');

      expect(history).toHaveLength(2);
      expect(history[0].action_type).toBe('STATUS_CHANGE');
      expect(history[1].action_type).toBe('ORDER_CREATED');
    });
  });
});
