/**
 * T03 (Production Readiness Checklist): retail-only orders must never be
 * created with PAY_ON_COLLECTION. The client blocks this in the New Order
 * modal, but retail resolves straight to a terminal status with no
 * downstream collection gate (unlike laundry orders, which are still gated
 * by PICKUP_COLLECTION_REQUIRED / DELIVERY_COLLECTION_REQUIRED before
 * pickup/delivery). A direct or forged API call must be rejected server-side
 * too, before any write.
 */
import { OrderService } from '@/lib/services/order-service';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { generateOrderNumberWithTx } from '@/lib/utils/order-number-generator';

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

jest.mock('@/lib/services/order-source-policy', () => ({
  validateOrderSourceForCreation: jest.fn().mockResolvedValue({
    ok: true,
    row: { order_source_code: 'pos', requires_remote_intake_confirm: false },
  }),
}));

jest.mock('@/lib/services/workflow/workflow-profile-resolution.service', () => ({
  resolveWorkflowProfileBindingForOrderWithSupabase: jest.fn().mockResolvedValue({ initialRules: [] }),
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
  const mockSupabase = { rpc: jest.fn(), from: jest.fn() } as any;

  const retailItems = [
    { productId: 'p1', quantity: 1, pricePerUnit: 10, totalPrice: 10, serviceCategoryCode: 'RETAIL_ITEMS' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createOrder rejects a retail-only order paid PAY_ON_COLLECTION before any write', async () => {
    const result = await OrderService.createOrder({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      orderTypeId: 'POS',
      items: retailItems,
      userId: 'user-1',
      userName: 'Staff',
      paymentMethod: PAYMENT_METHODS.PAY_ON_COLLECTION,
      supabaseClient: mockSupabase,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
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
});
