/**
 * Unit tests for Order Cancel Service
 * Plan: cancel_and_return_order_ddb29821.plan.md
 */

import { cancelOrder } from '@/lib/services/order-cancel-service';

const mockRpc = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/lib/services/payment-service', () => ({
  getPaymentsForOrder: jest.fn(),
  cancelPayment: jest.fn(),
}));

const { getPaymentsForOrder, cancelPayment } = jest.requireMock(
  '@/lib/services/payment-service'
);

describe('Order Cancel Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      rpc: mockRpc,
    });
  });

  describe('cancelOrder', () => {
    const validInput = {
      orderId: 'order-123',
      tenantId: 'tenant-456',
      userId: 'user-789',
      cancelled_note: 'Customer requested cancellation',
    };

    it('should succeed when RPC returns ok and no payments', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true, from_status: 'intake', to_status: 'cancelled' },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([]);

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockRpc).toHaveBeenCalledWith('cmx_ord_canceling_transition', {
        p_tenant_org_id: validInput.tenantId,
        p_order_id: validInput.orderId,
        p_user_id: validInput.userId,
        p_input: {
          cancelled_note: validInput.cancelled_note,
          cancellation_reason_code: undefined,
        },
      });
      expect(getPaymentsForOrder).toHaveBeenCalledWith(validInput.orderId);
      expect(cancelPayment).not.toHaveBeenCalled();
    });

    it('should succeed and cancel completed payments when order has payments', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        {
          id: 'pay-1',
          status: 'completed',
          paid_amount: 10,
        } as never,
      ]);
      cancelPayment.mockResolvedValue({ success: true });

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(true);
      expect(cancelPayment).toHaveBeenCalledWith(
        'pay-1',
        validInput.cancelled_note,
        validInput.userId
      );
    });

    it('should succeed when payment cancel fails (best-effort)', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        {
          id: 'pay-1',
          status: 'completed',
          paid_amount: 10,
        } as never,
      ]);
      cancelPayment.mockResolvedValue({ success: false, error: 'Payment already cancelled' });

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(true);
      expect(cancelPayment).toHaveBeenCalled();
    });

    it('should not cancel payments with status other than completed', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        { id: 'pay-1', status: 'pending', paid_amount: 10 } as never,
        { id: 'pay-2', status: 'completed', paid_amount: 5 } as never,
      ]);
      cancelPayment.mockResolvedValue({ success: true });

      await cancelOrder(validInput);

      expect(cancelPayment).toHaveBeenCalledTimes(1);
      expect(cancelPayment).toHaveBeenCalledWith('pay-2', expect.any(String), expect.any(String));
    });

    it('should not cancel payments with zero or negative amount', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        { id: 'pay-1', status: 'completed', paid_amount: 0 } as never,
      ]);
      cancelPayment.mockResolvedValue({ success: true });

      await cancelOrder(validInput);

      expect(cancelPayment).not.toHaveBeenCalled();
    });

    it('should fail when RPC returns error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Order not found' },
      });

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
      expect(getPaymentsForOrder).not.toHaveBeenCalled();
    });

    it('should fail when RPC returns ok: false', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: false, code: 'STATUS_NOT_ALLOWED', message: 'Cannot cancel delivered order' },
        error: null,
      });

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot cancel delivered order');
    });

    it('should fail when reason is required (RPC validation)', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: false, code: 'REASON_REQUIRED', message: 'Cancellation reason is required' },
        error: null,
      });

      const result = await cancelOrder({
        ...validInput,
        cancelled_note: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason');
    });

    it('should pass cancellation_reason_code when provided', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([]);

      await cancelOrder({
        ...validInput,
        cancellation_reason_code: 'CUSTOMER_REQUEST',
      });

      expect(mockRpc).toHaveBeenCalledWith('cmx_ord_canceling_transition', {
        p_tenant_org_id: validInput.tenantId,
        p_order_id: validInput.orderId,
        p_user_id: validInput.userId,
        p_input: {
          cancelled_note: validInput.cancelled_note,
          cancellation_reason_code: 'CUSTOMER_REQUEST',
        },
      });
    });

    it('should succeed when getPaymentsForOrder throws (best-effort)', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockRejectedValue(new Error('DB connection failed'));

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(true);
    });
  });
});
