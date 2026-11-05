/**
 * Integration Tests for Workflow Orders API (PRD-010)
 * Tests for order workflow API endpoints
 */

import {
  getOrders,
  getOrderState,
  transitionOrder,
  splitOrder,
  createIssue,
  resolveIssue,
  getOrderHistory,
} from '@/lib/api/orders';

// Mock fetch globally
global.fetch = jest.fn();

describe('Workflow Orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/orders - List Orders', () => {
    it('should fetch orders by status', async () => {
      const mockResponse = {
        success: true,
        data: {
          orders: [
            { id: 'order-1', current_status: 'processing' },
            { id: 'order-2', current_status: 'processing' },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getOrders({ status: 'processing' });

      expect(fetch).toHaveBeenCalledWith('/api/v1/orders?status=processing');
      expect(result.orders).toHaveLength(2);
    });
  });

  describe('GET /api/v1/orders/[id]/state - Get Order State', () => {
    it('should return order state with flags and transitions', async () => {
      const mockResponse = {
        success: true,
        data: {
          order: { id: 'order-1', current_status: 'processing' },
          hasSplit: false,
          hasIssue: false,
          allowedTransitions: [
            { to_status: 'assembly', requires_notes: false },
            { to_status: 'ready', requires_notes: true },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getOrderState('order-1');

      expect(fetch).toHaveBeenCalledWith('/api/v1/orders/order-1/state');
      expect(result.allowedTransitions).toHaveLength(2);
    });
  });

  describe('POST /api/v1/orders/[id]/transition - Transition Order', () => {
    it('should transition order status', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'order-1',
          from_status: 'processing',
          to_status: 'ready',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await transitionOrder('order-1', {
        toStatus: 'ready',
        notes: 'Processing complete',
      });

      expect(fetch).toHaveBeenCalledWith('/api/v1/orders/order-1/transition', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('ready'),
      }));
      expect(result.to_status).toBe('ready');
    });

    it('should validate RBAC permissions', async () => {
      const mockResponse = {
        success: false,
        error: 'Insufficient permissions for this transition',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => mockResponse,
      });

      await expect(transitionOrder('order-1', { toStatus: 'ready' }))
        .rejects.toThrow();
    });
  });

  describe('POST /api/v1/orders/[id]/split - Split Order', () => {
    it('should split order into child orders', async () => {
      const mockResponse = {
        success: true,
        data: {
          parentOrderId: 'order-1',
          childOrderIds: ['child-1', 'child-2'],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await splitOrder('order-1', {
        splits: [
          { itemId: 'item-1', quantity: 5 },
          { itemId: 'item-2', quantity: 3 },
        ],
      });

      expect(result.childOrderIds).toHaveLength(2);
    });
  });

  describe('POST /api/v1/orders/[id]/issue - Create Issue', () => {
    it('should create issue for order item', async () => {
      const mockResponse = {
        success: true,
        data: {
          issue: {
            id: 'issue-1',
            issue_code: 'STAIN',
            priority: 'high',
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createIssue('order-1', {
        orderItemId: 'item-1',
        issueCode: 'STAIN',
        issueText: 'Large stain on collar',
        priority: 'high',
      });

      expect(result.issue.issue_code).toBe('STAIN');
    });
  });

  describe('PATCH /api/v1/orders/[id]/issue - Resolve Issue', () => {
    it('should resolve issue', async () => {
      const mockResponse = {
        success: true,
        data: {
          issue: {
            id: 'issue-1',
            solved_at: new Date().toISOString(),
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await resolveIssue('order-1', 'issue-1', {
        notes: 'Stain removed successfully',
      });

      expect(result.issue.solved_at).toBeDefined();
    });
  });

  describe('GET /api/v1/orders/[id]/history - Get Order History', () => {
    it('should fetch comprehensive order history', async () => {
      const mockResponse = {
        success: true,
        data: {
          history: [
            { action_type: 'ORDER_CREATED', done_at: '2024-01-01T00:00:00Z' },
            { action_type: 'STATUS_CHANGE', from_value: 'intake', to_value: 'processing' },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getOrderHistory('order-1');

      expect(result.history).toHaveLength(2);
      expect(result.history[0].action_type).toBe('ORDER_CREATED');
    });
  });

});

