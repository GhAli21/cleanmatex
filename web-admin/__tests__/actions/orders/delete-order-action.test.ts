/** @jest-environment node */

const mockAuth = jest.fn();
const mockPermission = jest.fn();
const mockTransaction = jest.fn();
const mockTenantContext = jest.fn();
const mockRevalidatePath = jest.fn();
const mockFindOrder = jest.fn();
const mockDeleteMany = jest.fn();
const mockDeleteOrder = jest.fn();

jest.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }));
jest.mock('@/lib/auth/server-auth', () => ({ getAuthContext: () => mockAuth() }));
jest.mock('@/lib/services/permission-service-server', () => ({ hasPermissionServer: () => mockPermission() }));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (tenantId: string, callback: () => unknown) => mockTenantContext(tenantId, callback),
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (callback: (tx: unknown) => unknown) => mockTransaction(callback),
  },
}));

import { deleteOrderAction } from '@/app/actions/orders/delete-order';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';

const tx = {
  org_orders_mst: {
    findFirst: (...args: unknown[]) => mockFindOrder(...args),
    delete: (...args: unknown[]) => mockDeleteOrder(...args),
  },
  org_invoice_mst: { deleteMany: (...args: unknown[]) => mockDeleteMany(...args) },
  org_order_item_pieces_dtl: { deleteMany: (...args: unknown[]) => mockDeleteMany(...args) },
  org_order_items_dtl: { deleteMany: (...args: unknown[]) => mockDeleteMany(...args) },
  org_order_status_history: { deleteMany: (...args: unknown[]) => mockDeleteMany(...args) },
};

describe('deleteOrderAction compensation boundary', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAuth.mockResolvedValue({ tenantId, userId: 'staff-1' });
    mockPermission.mockResolvedValue(true);
    mockTenantContext.mockImplementation((_tenantId: string, callback: () => unknown) => callback());
    mockTransaction.mockImplementation((callback: (transaction: typeof tx) => unknown) => callback(tx));
    mockFindOrder.mockResolvedValue({ id: orderId, committed_at: null });
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockDeleteOrder.mockResolvedValue({ id: orderId });
  });

  it('rejects a caller-supplied tenant that does not match the authenticated membership context', async () => {
    await expect(deleteOrderAction(otherTenantId, orderId)).resolves.toEqual({
      success: false,
      error: 'Order not found or access denied',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('denies removal of a committed aggregate before dependent facts are touched', async () => {
    mockFindOrder.mockResolvedValueOnce({ id: orderId, committed_at: new Date() });
    await expect(deleteOrderAction(tenantId, orderId)).resolves.toEqual({
      success: false,
      error: 'Committed orders cannot be deleted as failed Create compensation',
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockDeleteOrder).not.toHaveBeenCalled();
  });

  it('retains compensation for an authenticated, authorized, uncommitted aggregate', async () => {
    await expect(deleteOrderAction(tenantId, orderId)).resolves.toEqual({ success: true });
    expect(mockFindOrder).toHaveBeenCalledWith({
      where: { id: orderId, tenant_org_id: tenantId },
      select: { id: true, committed_at: true },
    });
    expect(mockDeleteOrder).toHaveBeenCalledWith({
      where: { id: orderId, tenant_org_id: tenantId },
    });
  });
});
