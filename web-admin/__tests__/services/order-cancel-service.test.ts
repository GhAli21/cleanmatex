/**
 * Unit tests for Order Cancel Service
 * Plan: cancel_and_return_order_ddb29821.plan.md
 * Plan: promotions_and_gifts_30156abf.plan.md (refund + promo reversal)
 */

import { cancelOrder } from '@/lib/services/order-cancel-service';

const mockRpc = jest.fn();
const mockCreateClient = jest.fn();
const mockPaymentsFindMany = jest.fn();
const mockPrismaTransaction = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_payments_dtl_tr: {
      findMany: (...args: unknown[]) => mockPaymentsFindMany(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/services/payment-service', () => ({
  getPaymentsForOrder: jest.fn(),
  cancelPayment: jest.fn(),
}));

jest.mock('@/lib/services/discount-service', () => ({
  reversePromoUsageTx: jest.fn(),
}));

jest.mock('@/lib/services/gift-card-service', () => ({
  refundToGiftCardTx: jest.fn(),
}));

const { getPaymentsForOrder, cancelPayment } = jest.requireMock(
  '@/lib/services/payment-service'
);
const { reversePromoUsageTx } = jest.requireMock('@/lib/services/discount-service');
const { refundToGiftCardTx } = jest.requireMock('@/lib/services/gift-card-service');

describe('Order Cancel Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      rpc: mockRpc,
    });
    // Default: no linked promo/gift on payments → reversal short-circuits.
    mockPaymentsFindMany.mockResolvedValue([]);
    // Default: $transaction simply runs the callback with a fake tx.
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: object) => Promise<unknown>) => {
        const fakeTx = {
          org_gift_cards_mst: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return fn(fakeTx);
      }
    );
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
      mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
      getPaymentsForOrder.mockResolvedValue([
        { id: 'pay-1', status: 'completed', paid_amount: 10 } as never,
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
      mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
      getPaymentsForOrder.mockResolvedValue([
        { id: 'pay-1', status: 'completed', paid_amount: 10 } as never,
      ]);
      cancelPayment.mockResolvedValue({ success: false, error: 'Payment already cancelled' });

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(true);
      expect(cancelPayment).toHaveBeenCalled();
    });

    it('should not cancel payments with status other than completed', async () => {
      mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
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
      mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
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
      mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
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
      mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
      getPaymentsForOrder.mockRejectedValue(new Error('DB connection failed'));

      const result = await cancelOrder(validInput);

      expect(result.success).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Promo + gift card reversal (plan §5)
    // -----------------------------------------------------------------------

    describe('promo + gift card reversal', () => {
      it('should reverse promo usage when payment had a promo code', async () => {
        mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
        getPaymentsForOrder.mockResolvedValue([]);
        mockPaymentsFindMany.mockResolvedValue([
          {
            id: 'pay-1',
            status: 'cancelled',
            promo_code_id: 'promo-1',
            promo_discount_amount: 5,
            gift_card_id: null,
            gift_card_applied_amount: null,
            invoice_id: 'inv-1',
            metadata: null,
          },
        ]);
        reversePromoUsageTx.mockResolvedValue({ reversedCount: 1 });

        const result = await cancelOrder(validInput);

        expect(result.success).toBe(true);
        expect(reversePromoUsageTx).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            orderId: validInput.orderId,
            tenantOrgId: validInput.tenantId,
            voidedBy: validInput.userId,
          })
        );
      });

      it('should refund gift card when payment had a gift card debit', async () => {
        mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
        getPaymentsForOrder.mockResolvedValue([]);
        mockPaymentsFindMany.mockResolvedValue([
          {
            id: 'pay-1',
            status: 'cancelled',
            promo_code_id: null,
            promo_discount_amount: null,
            gift_card_id: 'gc-1',
            gift_card_applied_amount: 20,
            invoice_id: 'inv-1',
            metadata: null,
          },
        ]);
        const fakeTx = {
          org_gift_cards_mst: {
            findUnique: jest.fn().mockResolvedValue({ card_number: 'GC123' }),
          },
        };
        mockPrismaTransaction.mockImplementation(
          async (fn: (tx: object) => Promise<unknown>) => fn(fakeTx)
        );
        refundToGiftCardTx.mockResolvedValue({ newBalance: 50, actualRefundAmount: 20 });

        const result = await cancelOrder(validInput);

        expect(result.success).toBe(true);
        expect(refundToGiftCardTx).toHaveBeenCalledWith(
          fakeTx,
          expect.objectContaining({
            cardNumber: 'GC123',
            amount: 20,
            orderId: validInput.orderId,
            tenantOrgId: validInput.tenantId,
          })
        );
        expect(result.warnings).toBeUndefined();
      });

      it('should reverse both promo and gift card when both were applied', async () => {
        mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
        getPaymentsForOrder.mockResolvedValue([]);
        mockPaymentsFindMany.mockResolvedValue([
          {
            id: 'pay-1',
            status: 'cancelled',
            promo_code_id: 'promo-1',
            promo_discount_amount: 5,
            gift_card_id: 'gc-1',
            gift_card_applied_amount: 15,
            invoice_id: 'inv-1',
            metadata: null,
          },
        ]);
        const fakeTx = {
          org_gift_cards_mst: {
            findUnique: jest.fn().mockResolvedValue({ card_number: 'GC123' }),
          },
        };
        mockPrismaTransaction.mockImplementation(
          async (fn: (tx: object) => Promise<unknown>) => fn(fakeTx)
        );
        reversePromoUsageTx.mockResolvedValue({ reversedCount: 1 });
        refundToGiftCardTx.mockResolvedValue({ newBalance: 30, actualRefundAmount: 15 });

        const result = await cancelOrder(validInput);

        expect(result.success).toBe(true);
        expect(reversePromoUsageTx).toHaveBeenCalled();
        expect(refundToGiftCardTx).toHaveBeenCalled();
      });

      it('should surface a warning when gift card refund is partial', async () => {
        mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
        getPaymentsForOrder.mockResolvedValue([]);
        mockPaymentsFindMany.mockResolvedValue([
          {
            id: 'pay-1',
            status: 'cancelled',
            promo_code_id: null,
            promo_discount_amount: null,
            gift_card_id: 'gc-1',
            gift_card_applied_amount: 20,
            invoice_id: 'inv-1',
            metadata: null,
          },
        ]);
        const fakeTx = {
          org_gift_cards_mst: {
            findUnique: jest.fn().mockResolvedValue({ card_number: 'GC123' }),
          },
        };
        mockPrismaTransaction.mockImplementation(
          async (fn: (tx: object) => Promise<unknown>) => fn(fakeTx)
        );
        // Refund returned LESS than requested → partial refund warning expected
        refundToGiftCardTx.mockResolvedValue({ newBalance: 50, actualRefundAmount: 10 });

        const result = await cancelOrder(validInput);

        expect(result.success).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.[0]).toContain('Partial gift card refund');
      });

      it('should surface a warning when gift card lookup fails', async () => {
        mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
        getPaymentsForOrder.mockResolvedValue([]);
        mockPaymentsFindMany.mockResolvedValue([
          {
            id: 'pay-1',
            status: 'cancelled',
            promo_code_id: null,
            promo_discount_amount: null,
            gift_card_id: 'gc-missing',
            gift_card_applied_amount: 20,
            invoice_id: 'inv-1',
            metadata: null,
          },
        ]);
        const fakeTx = {
          org_gift_cards_mst: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        mockPrismaTransaction.mockImplementation(
          async (fn: (tx: object) => Promise<unknown>) => fn(fakeTx)
        );

        const result = await cancelOrder(validInput);

        expect(result.success).toBe(true);
        expect(result.warnings?.[0]).toContain('not found for refund');
        expect(refundToGiftCardTx).not.toHaveBeenCalled();
      });

      it('should not reverse anything when no promo or gift card was used', async () => {
        mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
        getPaymentsForOrder.mockResolvedValue([]);
        mockPaymentsFindMany.mockResolvedValue([
          {
            id: 'pay-1',
            status: 'cancelled',
            promo_code_id: null,
            promo_discount_amount: null,
            gift_card_id: null,
            gift_card_applied_amount: null,
            invoice_id: 'inv-1',
            metadata: null,
          },
        ]);

        const result = await cancelOrder(validInput);

        expect(result.success).toBe(true);
        expect(reversePromoUsageTx).not.toHaveBeenCalled();
        expect(refundToGiftCardTx).not.toHaveBeenCalled();
        expect(mockPrismaTransaction).not.toHaveBeenCalled();
      });
    });
  });
});
