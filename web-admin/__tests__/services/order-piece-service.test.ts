/**
 * Unit Tests for OrderPieceService
 * Tests for piece CRUD operations, batch updates, and sync
 */

import { OrderPieceService } from '@/lib/services/order-piece-service';

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      count: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ count: 0, error: null })),
            })),
          })),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  })),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('OrderPieceService', () => {
  const tenantId = 'tenant-123';
  const orderId = 'order-456';
  const itemId = 'item-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPiecesForItem', () => {
    it('should create pieces successfully', async () => {
      const quantity = 3;
      const baseData = {
        pricePerUnit: 10,
        totalPrice: 30,
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: {
                      id: itemId,
                      order_id: orderId,
                      tenant_org_id: tenantId,
                      quantity: 3,
                      price_per_unit: 10,
                      total_price: 30,
                    },
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'piece-1',
                  piece_seq: 1,
                  price_per_unit: 10,
                  total_price: 10,
                },
                {
                  id: 'piece-2',
                  piece_seq: 2,
                  price_per_unit: 10,
                  total_price: 10,
                },
                {
                  id: 'piece-3',
                  piece_seq: 3,
                  price_per_unit: 10,
                  total_price: 10,
                },
              ],
              error: null,
            })
          ),
        })),
      });

      const result = await OrderPieceService.createPiecesForItem(
        tenantId,
        orderId,
        itemId,
        quantity,
        baseData
      );

      expect(result.success).toBe(true);
      expect(result.pieces).toHaveLength(3);
    });

    it('should return error if item not found', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'Item not found' },
                  })
                ),
              })),
            })),
          })),
        })),
      });

      const result = await OrderPieceService.createPiecesForItem(
        tenantId,
        orderId,
        itemId,
        3,
        { pricePerUnit: 10, totalPrice: 30 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order item not found');
    });
  });

  describe('getPiecesByItem', () => {
    it('should fetch pieces successfully', async () => {
      const mockPieces = [
        { id: 'piece-1', piece_seq: 1 },
        { id: 'piece-2', piece_seq: 2 },
      ];

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: mockPieces,
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      const result = await OrderPieceService.getPiecesByItem(tenantId, itemId);

      expect(result.success).toBe(true);
      expect(result.pieces).toEqual(mockPieces);
    });

    it('should return error on fetch failure', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { message: 'Database error' },
                })
              ),
            })),
          })),
        })),
      });

      const result = await OrderPieceService.getPiecesByItem(tenantId, itemId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('updatePiece', () => {
    it('should update piece successfully', async () => {
      const pieceId = 'piece-123';
      const updates = {
        piece_status: 'ready' as const,
        rack_location: 'A-12',
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: {
                      id: pieceId,
                      ...updates,
                    },
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      });

      const result = await OrderPieceService.updatePiece({
        pieceId,
        tenantId,
        updates,
      });

      expect(result.success).toBe(true);
      expect(result.piece).toBeDefined();
    });

    it('should return error on update failure', async () => {
      const pieceId = 'piece-123';
      const updates = { piece_status: 'ready' as const };

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'Update failed' },
                  })
                ),
              })),
            })),
          })),
        })),
      });

      const result = await OrderPieceService.updatePiece({
        pieceId,
        tenantId,
        updates,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('batchUpdatePieces', () => {
    it('should batch update pieces successfully', async () => {
      const updates = [
        {
          pieceId: 'piece-1',
          updates: { piece_status: 'ready' as const },
        },
        {
          pieceId: 'piece-2',
          updates: { rack_location: 'A-12' },
        },
      ];

      // Mock updatePiece to succeed
      jest.spyOn(OrderPieceService, 'updatePiece').mockResolvedValue({
        success: true,
        piece: {} as any,
      });

      const result = await OrderPieceService.batchUpdatePieces({
        tenantId,
        updates,
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
    });

    it('should handle partial failures in batch update', async () => {
      const updates = [
        {
          pieceId: 'piece-1',
          updates: { piece_status: 'ready' as const },
        },
        {
          pieceId: 'piece-2',
          updates: { rack_location: 'A-12' },
        },
      ];

      // Mock first update to succeed, second to fail
      jest
        .spyOn(OrderPieceService, 'updatePiece')
        .mockResolvedValueOnce({
          success: true,
          piece: {} as any,
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Update failed',
        });

      const result = await OrderPieceService.batchUpdatePieces({
        tenantId,
        updates,
      });

      expect(result.success).toBe(false);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('syncItemQuantityReady', () => {
    it('should sync quantity_ready successfully', async () => {
      const readyCount = 5;

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  count: jest.fn(() =>
                    Promise.resolve({
                      count: readyCount,
                      error: null,
                    })
                  ),
                })),
              })),
            })),
          })),
        })),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({
                error: null,
              })
            ),
          })),
        })),
      });

      const result = await OrderPieceService.syncItemQuantityReady(
        tenantId,
        itemId
      );

      expect(result.success).toBe(true);
      expect(result.quantityReady).toBe(readyCount);
    });

    it('should return error if count fails', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  count: jest.fn(() =>
                    Promise.resolve({
                      count: null,
                      error: { message: 'Count failed' },
                    })
                  ),
                })),
              })),
            })),
          })),
        })),
      });

      const result = await OrderPieceService.syncItemQuantityReady(
        tenantId,
        itemId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Count failed');
    });
  });

  describe('deletePiece', () => {
    it('should delete piece successfully', async () => {
      const pieceId = 'piece-123';

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { order_item_id: itemId },
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({
                error: null,
              })
            ),
          })),
        })),
      });

      // Mock syncItemQuantityReady
      jest
        .spyOn(OrderPieceService, 'syncItemQuantityReady')
        .mockResolvedValue({ success: true, quantityReady: 0 });

      const result = await OrderPieceService.deletePiece(tenantId, pieceId);

      expect(result.success).toBe(true);
    });

    it('should return error on delete failure', async () => {
      const pieceId = 'piece-123';

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { order_item_id: itemId },
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({
                error: { message: 'Delete failed' },
              })
            ),
          })),
        })),
      });

      const result = await OrderPieceService.deletePiece(tenantId, pieceId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });
});

