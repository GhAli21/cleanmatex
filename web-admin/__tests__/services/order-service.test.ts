/**
 * Unit tests for the current static OrderService surface.
 * Focused on the lightweight Supabase-backed methods that remain active in this file.
 */

import { OrderService } from '@/lib/services/order-service';

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@/lib/services/order-created-pos-session', () => ({
  findOpenPosSessionIdForOrder: jest.fn().mockResolvedValue(null),
  stampCreatedPosSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/order-split.service', () => ({
  ORDER_SPLIT_ERRORS: { NOTHING_SELECTED: 'ORD_SPLIT_NOTHING_SELECTED' },
  splitOrderUnits: jest.fn(),
  buildSplitLines: jest.fn((input: { pieceIds?: string[] }) => {
    const bad = (input.pieceIds ?? []).find((id) => !/^.+-piece-\d+$/.test(id));
    return bad
      ? { ok: false, errorCode: 'ORD_SPLIT_BAD_PIECE_ID', error: `Invalid piece id: ${bad}` }
      : { ok: true, lines: [] };
  }),
}));

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


  describe('splitOrder', () => {
    test('delegates whole-line splits to the transactional split service', async () => {
      const { splitOrderUnits } = jest.requireMock('@/lib/services/order-split.service');
      splitOrderUnits.mockResolvedValueOnce({
        success: true,
        suborder: { id: 'child-1', order_no: 'ORD-20261030-0001-S1' },
        movedUnits: 3,
      });

      const result = await OrderService.splitOrder(
        'parent-order-id',
        'tenant-1',
        ['item-1', 'item-2'],
        'Separate delicate items',
        'user-1',
        'Tester'
      );

      expect(result).toEqual({
        success: true,
        suborder: { id: 'child-1', order_no: 'ORD-20261030-0001-S1' },
        movedUnits: 3,
      });
      expect(splitOrderUnits).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        orderId: 'parent-order-id',
        userId: 'user-1',
        userName: 'Tester',
        reason: 'Separate delicate items',
        lines: [{ itemId: 'item-1' }, { itemId: 'item-2' }],
      });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test('splitOrderByPieces rejects malformed piece ids without touching the DB', async () => {
      const { splitOrderUnits } = jest.requireMock('@/lib/services/order-split.service');
      const result = await OrderService.splitOrderByPieces(
        'parent-order-id',
        'tenant-1',
        ['not-a-piece'],
        'Reason',
        'user-1',
        'Tester'
      );
      expect(result).toEqual({ success: false, errorCode: 'ORD_SPLIT_BAD_PIECE_ID', error: 'Invalid piece id: not-a-piece' });
      expect(splitOrderUnits).not.toHaveBeenCalled();
    });
  });

  describe('createIssue', () => {
    const catalogMaybe = (code: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { code },
              error: null,
            }),
          })),
        })),
      })),
    });

    test('creates an item issue without rejecting', async () => {
      const insertMock = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'issue-1',
              issue_code: 'STAIN',
              scope_level: 'ITEM',
              order_id: 'order-1',
              status: 'OPEN',
            },
            error: null,
          }),
        })),
      }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sys_issue_type_cd') return catalogMaybe('STAIN');
        if (table === 'sys_lkp_priority_cd') return catalogMaybe('high');

        if (table === 'org_order_issues') {
          return {
            insert: insertMock,
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                      data: [{ id: 'issue-1' }],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === 'org_order_items_dtl') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: { id: 'item-1' },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }

        if (table === 'org_orders_mst') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await OrderService.createIssue({
        orderId: 'order-1',
        orderItemId: 'item-1',
        tenantId: 'tenant-1',
        issueCode: 'STAIN',
        issueText: 'Large stain on collar',
        userId: 'user-1',
        priority: 'high',
        scopeLevel: 'ITEM',
      });

      expect(result.success).toBe(true);
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: 'ITEM',
          order_item_id: 'item-1',
          order_item_piece_id: null,
          issue_code: 'STAIN',
          status: 'OPEN',
        })
      );
      expect(insertMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ is_rejected: true })
      );
    });

    test('creates an order-level issue when orderItemId is null', async () => {
      const insertMock = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'issue-2',
              issue_code: 'OTHER',
              order_item_id: null,
              scope_level: 'ORDER',
              order_id: 'order-1',
              status: 'OPEN',
            },
            error: null,
          }),
        })),
      }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sys_issue_type_cd') return catalogMaybe('OTHER');
        if (table === 'sys_lkp_priority_cd') return catalogMaybe('normal');

        if (table === 'org_order_issues') {
          return {
            insert: insertMock,
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                      data: [{ id: 'issue-2' }],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === 'org_orders_mst') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await OrderService.createIssue({
        orderId: 'order-1',
        orderItemId: null,
        tenantId: 'tenant-1',
        issueCode: 'OTHER',
        issueText: 'Order-level issue text',
        userId: 'user-1',
        priority: 'normal',
      });

      expect(result.success).toBe(true);
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-1',
          order_item_id: null,
          scope_level: 'ORDER',
          issue_code: 'OTHER',
          status: 'OPEN',
        })
      );
    });
  });

  describe('resolveIssue', () => {
    test('resolves an issue and clears the order issue flag when all are solved', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'org_order_issues') {
          const openLimit = {
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
          const openIs = { is: jest.fn(() => openLimit) };
          const chainEq = (): Record<string, unknown> => ({
            eq: jest.fn(() => chainEq()),
            is: openIs.is,
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: 'issue-1',
                issue_code: 'STAIN',
                order_id: 'order-1',
                scope_level: 'ITEM',
                order_item_id: 'item-1',
                order_item_piece_id: null,
                status: 'OPEN',
                solved_at: null,
              },
              error: null,
            }),
            limit: openLimit.limit,
          });
          return {
            select: jest.fn(() => chainEq()),
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  select: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({
                      data: {
                        id: 'issue-1',
                        issue_code: 'STAIN',
                        order_id: 'order-1',
                        scope_level: 'ITEM',
                        order_item_id: 'item-1',
                        order_item_piece_id: null,
                        status: 'SOLVED',
                        solved_at: new Date().toISOString(),
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === 'org_orders_mst' || table === 'org_order_items_dtl') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              })),
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
      expect(result.issue?.id).toBe('issue-1');
      expect(result.issue?.solved_at).toBeDefined();
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
