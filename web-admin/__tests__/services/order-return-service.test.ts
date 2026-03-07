/**
 * Unit tests for Order Return Service (Customer Return)
 * Plan: cancel_and_return_order_ddb29821.plan.md
 */

import { processCustomerReturn } from '@/lib/services/order-return-service';

const mockRpc = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/lib/services/payment-service', () => ({
  getPaymentsForOrder: jest.fn(),
  refundPayment: jest.fn(),
}));

const { getPaymentsForOrder, refundPayment } = jest.requireMock(
  '@/lib/services/payment-service'
);

describe('Order Return Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      rpc: mockRpc,
    });
  });

  describe('processCustomerReturn', () => {
    const validInput = {
      orderId: 'order-123',
      tenantId: 'tenant-456',
      userId: 'user-789',
      return_reason: 'Customer changed mind - quality was fine',
    };

    it('should succeed when RPC returns ok and no payments', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true, from_status: 'delivered', to_status: 'cancelled' },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([]);

      const result = await processCustomerReturn(validInput);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockRpc).toHaveBeenCalledWith('cmx_ord_returning_transition', {
        p_tenant_org_id: validInput.tenantId,
        p_order_id: validInput.orderId,
        p_user_id: validInput.userId,
        p_input: {
          return_reason: validInput.return_reason,
          return_reason_code: undefined,
        },
      });
      expect(getPaymentsForOrder).toHaveBeenCalledWith(validInput.orderId);
      expect(refundPayment).not.toHaveBeenCalled();
    });

    it('should succeed and refund completed payments when order has payments', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        {
          id: 'pay-1',
          status: 'completed',
          paid_amount: 25.5,
        } as never,
      ]);
      refundPayment.mockResolvedValue({ success: true });

      const result = await processCustomerReturn(validInput);

      expect(result.success).toBe(true);
      expect(refundPayment).toHaveBeenCalledWith({
        transaction_id: 'pay-1',
        amount: 25.5,
        reason: validInput.return_reason,
        processed_by: validInput.userId,
        reason_code: 'CUSTOMER_RETURN',
      });
    });

    it('should succeed when refund fails (best-effort)', async () => {
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
      refundPayment.mockResolvedValue({ success: false, error: 'Refund gateway error' });

      const result = await processCustomerReturn(validInput);

      expect(result.success).toBe(true);
      expect(refundPayment).toHaveBeenCalled();
    });

    it('should not refund payments with status other than completed', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        { id: 'pay-1', status: 'pending', paid_amount: 10 } as never,
        { id: 'pay-2', status: 'completed', paid_amount: 5 } as never,
      ]);
      refundPayment.mockResolvedValue({ success: true });

      await processCustomerReturn(validInput);

      expect(refundPayment).toHaveBeenCalledTimes(1);
      expect(refundPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: 'pay-2',
          amount: 5,
        })
      );
    });

    it('should not refund payments with zero or negative amount', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([
        { id: 'pay-1', status: 'completed', paid_amount: 0 } as never,
      ]);
      refundPayment.mockResolvedValue({ success: true });

      await processCustomerReturn(validInput);

      expect(refundPayment).not.toHaveBeenCalled();
    });

    it('should fail when RPC returns error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Order not found' },
      });

      const result = await processCustomerReturn(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
      expect(getPaymentsForOrder).not.toHaveBeenCalled();
    });

    it('should fail when RPC returns ok: false', async () => {
      mockRpc.mockResolvedValue({
        data: {
          ok: false,
          code: 'STATUS_NOT_ALLOWED',
          message: 'Customer return only allowed for delivered/closed orders',
        },
        error: null,
      });

      const result = await processCustomerReturn(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('delivered/closed');
    });

    it('should fail when return reason is required (RPC validation)', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: false, code: 'REASON_REQUIRED', message: 'Return reason is required' },
        error: null,
      });

      const result = await processCustomerReturn({
        ...validInput,
        return_reason: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason');
    });

    it('should pass return_reason_code when provided', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockResolvedValue([]);

      await processCustomerReturn({
        ...validInput,
        return_reason_code: 'QUALITY_ISSUE',
      });

      expect(mockRpc).toHaveBeenCalledWith('cmx_ord_returning_transition', {
        p_tenant_org_id: validInput.tenantId,
        p_order_id: validInput.orderId,
        p_user_id: validInput.userId,
        p_input: {
          return_reason: validInput.return_reason,
          return_reason_code: 'QUALITY_ISSUE',
        },
      });
    });

    it('should succeed when getPaymentsForOrder throws (best-effort)', async () => {
      mockRpc.mockResolvedValue({
        data: { ok: true },
        error: null,
      });
      getPaymentsForOrder.mockRejectedValue(new Error('DB connection failed'));

      const result = await processCustomerReturn(validInput);

      expect(result.success).toBe(true);
    });
  });
});
