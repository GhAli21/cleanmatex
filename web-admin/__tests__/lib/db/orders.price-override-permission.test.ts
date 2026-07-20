/**
 * Tests: lib/db/orders.ts — addOrderItems price-override permission gate (B27)
 *
 * Covers the fail-open bug fix only (not the full pricing/item-creation path,
 * which is exercised elsewhere) — a price override must now fail CLOSED:
 * - when the current user can't be resolved (was silently skipped before)
 * - when hasPermissionServer() throws for a non-"Permission denied" reason
 *   (was swallowed and execution continued before)
 * - when hasPermissionServer() returns false (already worked, regression lock)
 * - proceeds when the actor is resolved and holds pricing:override
 */

const mockProductFindMany = jest.fn();
const mockOrderFindUnique = jest.fn();
const mockGetUser = jest.fn();
const mockGetCurrencyConfig = jest.fn();
const mockHasPermissionServer = jest.fn();
const mockGetPriceForOrderItem = jest.fn();
const mockPrismaTransaction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_product_data_mst: { findMany: (...a: unknown[]) => mockProductFindMany(...a) },
    org_orders_mst: { findUnique: (...a: unknown[]) => mockOrderFindUnique(...a) },
    $transaction: (...a: unknown[]) => mockPrismaTransaction(...a),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
  }),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: (...a: unknown[]) => mockGetCurrencyConfig(...a),
  })),
}));

jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));

jest.mock('@/lib/services/pricing.service', () => ({
  pricingService: { getPriceForOrderItem: (...a: unknown[]) => mockGetPriceForOrderItem(...a) },
}));

import { addOrderItems } from '@/lib/db/orders';

const TENANT = 'tenant-price-override-001';
const ORDER = 'order-price-override-001';

function baseInput() {
  return {
    items: [
      {
        productId: 'prod-1',
        quantity: 1,
        priceOverride: 5,
        serviceCategoryCode: 'WASH',
      },
    ],
  } as unknown as Parameters<typeof addOrderItems>[2];
}

describe('addOrderItems — pricing:override fail-closed fix (B27)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProductFindMany.mockResolvedValue([{ id: 'prod-1', product_name: 'Wash', multiplier_express: 1.5 }]);
    mockOrderFindUnique.mockResolvedValue({ order_no: 'ORD-1', customer_id: 'cust-1' });
    mockGetCurrencyConfig.mockResolvedValue({ decimalPlaces: 3 });
  });

  it('throws when the current user cannot be resolved (was silently skipped before the fix)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } }); // no session user

    await expect(addOrderItems(TENANT, ORDER, baseInput())).rejects.toThrow(
      /pricing:override requires an authenticated user/
    );
    expect(mockHasPermissionServer).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('throws when hasPermissionServer returns false (regression lock — already worked pre-fix)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockHasPermissionServer.mockResolvedValue(false);

    await expect(addOrderItems(TENANT, ORDER, baseInput())).rejects.toThrow(
      /pricing:override required for price overrides/
    );
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('throws when hasPermissionServer itself throws (previously swallowed and allowed the override through)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockHasPermissionServer.mockRejectedValue(new Error('RPC connection reset'));

    await expect(addOrderItems(TENANT, ORDER, baseInput())).rejects.toThrow('RPC connection reset');
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('proceeds past the permission gate when the actor is resolved and authorized', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockHasPermissionServer.mockResolvedValue(true);
    mockGetPriceForOrderItem.mockResolvedValue({
      finalPrice: 10,
      total: 10,
      isTaxExempt: true,
      taxRate: 0,
    });

    // The rest of addOrderItems (item creation, piece generation, snapshot
    // recalc) is exercised by its other, non-permission-focused call sites —
    // here the assertion is specifically that the gate let it through:
    // hasPermissionServer was reached and the pricing lookup ran, i.e. the
    // function did NOT stop at "Permission denied". Later stages may still
    // reject in this narrowly-mocked test; that's not what this test verifies.
    await addOrderItems(TENANT, ORDER, baseInput()).catch(() => {});

    expect(mockHasPermissionServer).toHaveBeenCalledWith(
      'pricing:override',
      expect.objectContaining({ userId: 'user-1', tenantId: TENANT })
    );
    expect(mockGetPriceForOrderItem).toHaveBeenCalled();
  });
});
