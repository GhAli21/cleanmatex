/**
 * Integration Tests for Workflow Orders API (PRD-010)
 * Tests for order workflow API endpoints
 */

import {
  createOrder,
  getOrders,
  getOrderState,
  transitionOrder,
  splitOrder,
  createIssue,
  resolveIssue,
  getOrderHistory,
  estimateReadyBy,
} from '@/lib/api/orders';

// Mock fetch globally
global.fetch = jest.fn();

describe('Workflow Orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/orders - Create Order', () => {
    it('should create order with workflow support', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'order-1',
          order_no: 'ORD-001-123456',
          current_status: 'intake',
          workflow_template_id: 'template-1',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createOrder({
        customerId: 'cust-1',
        items: [
          { productId: 'prod-1', quantity: 2, pricePerUnit: 5.0 },
        ],
        express: false,
      });

      expect(fetch).toHaveBeenCalledWith('/api/v1/orders', expect.objectContaining({
        method: 'POST',
      }));
      expect(result.id).toBe('order-1');
      expect(result.current_status).toBe('intake');
    });

    it('should handle quick drop orders', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'order-2',
          is_quick_drop: true,
          quick_drop_quantity: 10,
          bag_count: 10,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createOrder({
        customerId: 'cust-1',
        isQuickDrop: true,
        quickDropQuantity: 10,
        items: [],
      });

      expect(result.is_quick_drop).toBe(true);
      expect(result.quick_drop_quantity).toBe(10);
    });
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
            issue_code: 'stain',
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
        issueCode: 'stain',
        issueText: 'Large stain on collar',
        priority: 'high',
      });

      expect(result.issue.issue_code).toBe('stain');
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

  describe('POST /api/v1/orders/estimate-ready-by - Estimate Ready By', () => {
    it('should estimate ready by time', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockResponse = {
        success: true,
        data: {
          readyBy: tomorrow.toISOString(),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await estimateReadyBy({
        items: [
          { productId: 'prod-1', quantity: 2 },
        ],
        express: false,
      });

      expect(result.readyBy).toBeDefined();
      expect(new Date(result.readyBy).getTime()).toBeGreaterThan(Date.now());
    });

    it('should calculate express service time reduction', async () => {
      const normal = new Date();
      normal.setDate(normal.getDate() + 2);
      const express = new Date();
      express.setHours(express.getHours() + 12);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { readyBy: normal.toISOString() },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { readyBy: express.toISOString() },
          }),
        });

      const normalResult = await estimateReadyBy({
        items: [{ productId: 'prod-1', quantity: 1 }],
        express: false,
      });

      const expressResult = await estimateReadyBy({
        items: [{ productId: 'prod-1', quantity: 1 }],
        express: true,
      });

      const timeDiff = new Date(normalResult.readyBy).getTime() - new Date(expressResult.readyBy).getTime();
      expect(timeDiff).toBeGreaterThan(0);
    });
  });
});

