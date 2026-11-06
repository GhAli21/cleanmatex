/**
 * T03 (Production Readiness Checklist): a retail-only order sold by staff must be
 * paid at the counter. Counter retail starts handed over (delivered), so no
 * collection gate would ever ask for the money. A direct or forged API call
 * must be rejected server-side too, before any write.
 *
 * Owner rule (2026-10-30): a customer-app retail order may be paid later, as
 * PAY_ON_COLLECTION, when its profile starts it before handover; the pickup and
 * delivery collection gates then hold it until the balance is collected.
 */
import { OrderService } from '@/lib/services/order-service';
import { PAYMENT_METHODS, PAYMENT_TYPE_IDS } from '@/lib/constants/payment';
import { generateOrderNumberWithTx } from '@/lib/utils/order-number-generator';
import { resolveOrderCreateWorkflowState } from '@/lib/services/workflow/order-create-workflow.service';

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

// These cases stop at the guard, before any quote figure is read.
jest.mock('@/lib/services/commercial/commercial-create.session', () => ({
  openCommercialCreateSession: () => ({}),
}));

jest.mock('@/lib/services/order-source-policy', () => ({
  validateOrderSourceForCreation: jest.fn().mockResolvedValue({
    ok: true,
    row: { order_source_code: 'pos', requires_remote_intake_confirm: false },
  }),
}));

jest.mock('@/lib/services/workflow/workflow-profile-resolution.service', () => ({
  resolveWorkflowProfileBindingForOrderWithPrisma: jest.fn().mockResolvedValue({ initialRules: [] }),
  WorkflowProfileResolutionError: class WorkflowProfileResolutionError extends Error {},
}));

jest.mock('@/lib/services/workflow/order-create-workflow.service', () => ({
  resolveOrderCreateWorkflowState: jest.fn().mockResolvedValue({
    v_initialStatus: 'delivered',
    v_transitionFrom: 'delivered',
    v_orderStatus: 'delivered',
    v_current_status: 'delivered',
    v_current_stage: 'delivered',
    physicalIntakeStatus: 'received',
    receivedAt: null,
    contractScreen: 'new_order',
    isRetailOnlyOrder: true,
    hydrated: {},
  }),
}));

jest.mock('@/lib/utils/order-number-generator', () => ({
  generateOrderNumberWithTx: jest.fn(),
}));

describe('OrderService retail PAY_ON_COLLECTION guard (T03)', () => {
  const retailItems = [
    { productId: 'p1', quantity: 1, pricePerUnit: 10, totalPrice: 10, serviceCategoryCode: 'RETAIL_ITEMS' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createOrderInTransaction rejects a retail-only order paid PAY_ON_COLLECTION before any write', async () => {
    const result = await OrderService.createOrderInTransaction({} as any, {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      orderTypeId: 'POS',
      items: retailItems,
      userId: 'user-1',
      userName: 'Staff',
      paymentMethod: PAYMENT_METHODS.PAY_ON_COLLECTION,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED');
    expect(generateOrderNumberWithTx).not.toHaveBeenCalled();
  });

  // A channel with no payment step (the customer booking) says when it is paid by the payment type.
  it.each([PAYMENT_TYPE_IDS.PAY_ON_COLLECTION, PAYMENT_TYPE_IDS.PAY_ON_DELIVERY])(
    'createOrderInTransaction rejects a retail-only order with payment type %s and no payment method',
    async (paymentTypeCode) => {
      const result = await OrderService.createOrderInTransaction({} as any, {
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        orderTypeId: 'PICKUP',
        items: retailItems,
        userId: 'cust-1',
        userName: 'Customer Mobile App',
        paymentTypeCode,
      });

      expect(result).toMatchObject({ success: false, errorCode: 'RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED' });
      expect(generateOrderNumberWithTx).not.toHaveBeenCalled();
    },
  );

  describe('customer app (online) retail', () => {
    const online = {
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      orderTypeId: 'PICKUP',
      items: retailItems,
      userId: 'cust-1',
      userName: 'Customer Mobile App',
      orderSourceCode: 'customer_mobile_app',
    };
    const startsAt = (status: string) => {
      (resolveOrderCreateWorkflowState as jest.Mock).mockResolvedValueOnce({
        v_initialStatus: status, v_transitionFrom: status, v_orderStatus: status,
        v_current_status: status, v_current_stage: status,
        physicalIntakeStatus: 'received', receivedAt: null, contractScreen: 'retail',
        isRetailOnlyOrder: true, hydrated: {},
      });
    };

    it('passes the guard when paid on collection and the profile starts it before handover', async () => {
      startsAt('ready');
      // The guard is the only check before the order number; stop the create there.
      (generateOrderNumberWithTx as jest.Mock).mockRejectedValueOnce(new Error('past the guard'));

      await expect(OrderService.createOrderInTransaction({} as any, {
        ...online, paymentTypeCode: PAYMENT_TYPE_IDS.PAY_ON_COLLECTION,
      })).rejects.toThrow('past the guard');
    });

    it('refuses when the profile would start the unpaid order handed over', async () => {
      startsAt('delivered');

      const result = await OrderService.createOrderInTransaction({} as any, {
        ...online, paymentTypeCode: PAYMENT_TYPE_IDS.PAY_ON_COLLECTION,
      });

      expect(result).toMatchObject({ success: false, errorCode: 'RETAIL_PAY_LATER_STARTS_HANDED_OVER' });
      expect(generateOrderNumberWithTx).not.toHaveBeenCalled();
    });

    // PAY_ON_DELIVERY has no collection gate holding the release, so it stays refused.
    it('refuses pay on delivery', async () => {
      startsAt('ready');

      const result = await OrderService.createOrderInTransaction({} as any, {
        ...online, paymentTypeCode: PAYMENT_TYPE_IDS.PAY_ON_DELIVERY,
      });

      expect(result).toMatchObject({ success: false, errorCode: 'RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED' });
    });
  });
});
