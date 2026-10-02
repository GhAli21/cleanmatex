/** @jest-environment node */
/**
 * WP01 characterizes legacy boundaries without making full replacement a V2 contract.
 * The deletion sentinel is temporary migration evidence to retire when the legacy path
 * closes; callback mocks cannot establish persisted deletion rollback.
 */
import { OrderService } from '@/lib/services/order-service';

const mockLoad = jest.fn();
const mockLock = jest.fn();
const mockTransaction = jest.fn();
const mockPrefs = jest.fn();
const mockPieces = jest.fn();
const mockDeletePieces = jest.fn();
const mockDeleteItems = jest.fn();
const mockAudit = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })) }));
jest.mock('@/lib/db/orders', () => ({ getOrderById: (...args: unknown[]) => mockLoad(...args) }));
jest.mock('@/lib/services/order-lock.service', () => ({
  checkOrderLock: (...args: unknown[]) => mockLock(...args), unlockOrder: jest.fn(), lockOrderForEdit: jest.fn(),
}));
jest.mock('@/lib/services/order-audit.service', () => ({ createEditAudit: (...args: unknown[]) => mockAudit(...args) }));
jest.mock('@/lib/services/feature-flags.service', () => ({ canAccess: jest.fn().mockResolvedValue(false) }));
jest.mock('@/lib/db/prisma', () => ({ prisma: {
  $transaction: (...args: unknown[]) => mockTransaction(...args),
  org_order_preferences_dtl: { findMany: (...args: unknown[]) => mockPrefs(...args) },
  org_order_item_pieces_dtl: { findMany: (...args: unknown[]) => mockPieces(...args) },
} }));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

const params = { tenantId: 'tenant-1', orderId: 'order-1', userId: 'staff-1', userName: 'Staff' };
const existing = { id: 'order-1', order_no: 'ORD-1', current_status: 'intake',
  updated_at: new Date('2026-10-02T00:00:00Z'), total_amount: 20, total_paid_amount: 0,
  outstanding_amount: 20, items: [] };

describe('WP01 actual OrderService legacy Edit boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockResolvedValue(existing);
    mockLock.mockResolvedValue({ isLocked: false });
    mockPrefs.mockResolvedValue([]);
    mockPieces.mockResolvedValue([]);
    mockDeletePieces.mockResolvedValue({ count: 0 });
    mockDeleteItems.mockRejectedValue(new Error('wp01-stop-before-replacement'));
    mockTransaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      org_order_item_pieces_dtl: { deleteMany: mockDeletePieces },
      org_order_items_dtl: { deleteMany: mockDeleteItems },
    }));
  });
  it('loads with tenant context and rejects a missing order before any transaction', async () => {
    mockLoad.mockResolvedValueOnce(null);
    expect(await OrderService.updateOrder(params)).toMatchObject({ success: false, error: 'Order not found' });
    expect(mockLoad).toHaveBeenCalledWith('tenant-1', 'order-1');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it('rejects a conflicting advisory lock before a transaction', async () => {
    mockLock.mockResolvedValueOnce({ isLocked: true, lock: { lockedBy: 'other', lockedByName: 'Other' } });
    expect(await OrderService.updateOrder(params)).toMatchObject({ success: false, error: 'Order is locked by Other' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it('rejects a stale expected timestamp before replacement', async () => {
    const result = await OrderService.updateOrder({ ...params, expectedUpdatedAt: new Date('2026-10-01T00:00:00Z') });
    expect(result.success).toBe(false);
    expect(result.error).toContain('modified by another user');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it('documents that legacy items input reaches whole-order deletion and propagates a writer failure', async () => {
    const result = await OrderService.updateOrder({ ...params,
      items: [{ productId: 'product-1', quantity: 1, pricePerUnit: 20, totalPrice: 20 }] });
    expect(mockDeletePieces).toHaveBeenCalledWith({ where: { order_id: 'order-1', tenant_org_id: 'tenant-1' } });
    expect(mockDeleteItems).toHaveBeenCalledWith({ where: { order_id: 'order-1', tenant_org_id: 'tenant-1' } });
    expect(result).toMatchObject({ success: false, error: 'wp01-stop-before-replacement' });
    expect(mockAudit).not.toHaveBeenCalled();
    // This sentinel is migration evidence; it must be retired when this legacy path closes.
  });
});
