/**
 * Tests: BF-20 — every guarded server action binds to the session tenant.
 *
 * For each action: a caller-supplied foreign tenant is rejected before any data
 * access, and an accepted call reaches its data layer with the session tenant
 * (never the caller's value). The guard runs for real; only auth, permission
 * and data modules are mocked.
 */

const SESSION_TENANT = 'tenant-session';
const FOREIGN_TENANT = 'tenant-foreign';
const USER = 'user-1';

const mockGetAuthContext = jest.fn();
const mockHasPermissionServer = jest.fn();
const db = {
  getOrderById: jest.fn(),
  getOrderByReference: jest.fn(),
  listOrders: jest.fn(),
  getOrderStats: jest.fn(),
  addOrderItems: jest.fn(),
};
const mockGetInvoicesForOrder = jest.fn();
const mockValidatePromoCode = jest.fn();
const mockGetCurrencyConfig = jest.fn();
const mockGetDefaultPhoneCountryCode = jest.fn();

jest.mock('@/lib/auth/server-auth', () => ({
  getAuthContext: (...a: unknown[]) => mockGetAuthContext(...a),
}));
jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...a: unknown[]) => mockHasPermissionServer(...a),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('@/lib/db/orders', () => ({
  getOrderById: (...a: unknown[]) => db.getOrderById(...a),
  getOrderByReference: (...a: unknown[]) => db.getOrderByReference(...a),
  listOrders: (...a: unknown[]) => db.listOrders(...a),
  getOrderStats: (...a: unknown[]) => db.getOrderStats(...a),
  addOrderItems: (...a: unknown[]) => db.addOrderItems(...a),
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenant: string, fn: () => Promise<unknown>) => fn()),
}));
jest.mock('@/lib/validations/order-schema', () => ({
  orderFiltersSchema: { safeParseAsync: jest.fn(async () => ({ success: true, data: {} })) },
  addOrderItemsSchema: { safeParse: jest.fn(() => ({ success: true, data: { items: [] } })) },
}));
jest.mock('@/lib/services/order-change/order-change-legacy-writer-guard', () => ({
  blockCommittedCommercialWrite: jest.fn(async () => null),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/services/invoice-service', () => ({
  getInvoicesForOrder: (...a: unknown[]) => mockGetInvoicesForOrder(...a),
}));
jest.mock('@/lib/services/discount-service', () => ({
  validatePromoCode: (...a: unknown[]) => mockValidatePromoCode(...a),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: (...a: unknown[]) => mockGetCurrencyConfig(...a),
    getDefaultPhoneCountryCode: (...a: unknown[]) => mockGetDefaultPhoneCountryCode(...a),
  })),
}));

import { getOrder, getOrderByRef } from '@/app/actions/orders/get-order';
import { listOrders, getStats } from '@/app/actions/orders/list-orders';
import { addOrderItems } from '@/app/actions/orders/add-order-items';
import { getOrderInvoices } from '@/app/actions/payments/invoice-actions';
import { validatePromoCodeAction } from '@/app/actions/payments/validate-promo';
import {
  getCurrencyConfigAction,
  getCurrencyConfigOutcomeAction,
} from '@/app/actions/tenant/get-currency-config';
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthContext.mockResolvedValue({ tenantId: SESSION_TENANT, userId: USER });
  mockHasPermissionServer.mockResolvedValue(true);
  db.getOrderById.mockResolvedValue({ id: 'o1' });
  db.getOrderByReference.mockResolvedValue({ id: 'o1' });
  db.listOrders.mockResolvedValue({ orders: [] });
  db.getOrderStats.mockResolvedValue({});
  db.addOrderItems.mockResolvedValue({ items: [], order: {} });
  mockGetInvoicesForOrder.mockResolvedValue([]);
  mockValidatePromoCode.mockResolvedValue({ isValid: true });
  mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 });
  mockGetDefaultPhoneCountryCode.mockResolvedValue('+968');
});

type Case = {
  name: string;
  call: (tenant: string) => Promise<unknown>;
  dataLayer: jest.Mock;
  /** Index of the tenant argument passed to the data layer; null when the layer reads the session itself. */
  tenantArg: number | null;
  permission?: string;
  /** How a rejected call surfaces. */
  rejects: 'result' | 'throws' | 'outcome';
};

const cases: Case[] = [
  { name: 'getOrder', call: (t) => getOrder(t, 'o1'), dataLayer: db.getOrderById, tenantArg: 0, permission: 'orders:read', rejects: 'result' },
  { name: 'getOrderByRef', call: (t) => getOrderByRef(t, 'ORD-1'), dataLayer: db.getOrderByReference, tenantArg: 0, permission: 'orders:read', rejects: 'result' },
  { name: 'listOrders', call: (t) => listOrders(t, {}), dataLayer: db.listOrders, tenantArg: 0, permission: 'orders:read', rejects: 'result' },
  { name: 'getStats', call: (t) => getStats(t), dataLayer: db.getOrderStats, tenantArg: 0, permission: 'orders:read', rejects: 'result' },
  { name: 'addOrderItems', call: (t) => addOrderItems(t, 'o1', { items: [] }), dataLayer: db.addOrderItems, tenantArg: 0, permission: 'orders:update', rejects: 'result' },
  { name: 'validatePromoCodeAction', call: (t) => validatePromoCodeAction(t, { promo_code: 'X', order_total: 1 }), dataLayer: mockValidatePromoCode, tenantArg: null, rejects: 'result' },
  { name: 'getCurrencyConfigAction', call: (t) => getCurrencyConfigAction(t, undefined, 'spoofed-user'), dataLayer: mockGetCurrencyConfig, tenantArg: 0, rejects: 'throws' },
  { name: 'getCurrencyConfigOutcomeAction', call: (t) => getCurrencyConfigOutcomeAction(t), dataLayer: mockGetCurrencyConfig, tenantArg: 0, rejects: 'outcome' },
  { name: 'getPhoneCountryCodeAction', call: (t) => getPhoneCountryCodeAction(t, undefined, 'spoofed-user'), dataLayer: mockGetDefaultPhoneCountryCode, tenantArg: 0, rejects: 'throws' },
];

describe.each(cases)('$name (BF-20)', ({ call, dataLayer, tenantArg, permission, rejects }) => {
  it('rejects a foreign tenant before any data access', async () => {
    if (rejects === 'throws') {
      await expect(call(FOREIGN_TENANT)).rejects.toThrow('TENANT_MISMATCH');
    } else if (rejects === 'outcome') {
      await expect(call(FOREIGN_TENANT)).resolves.toEqual(expect.objectContaining({ ok: false }));
    } else {
      const result = (await call(FOREIGN_TENANT)) as Record<string, unknown>;
      expect(result.success === false || result.isValid === false).toBe(true);
      expect(JSON.stringify(result)).toContain('TENANT_MISMATCH');
    }
    expect(dataLayer).not.toHaveBeenCalled();
  });

  it('uses the session tenant for the data layer', async () => {
    await call(SESSION_TENANT);
    expect(dataLayer).toHaveBeenCalledTimes(1);
    if (tenantArg !== null) {
      expect(dataLayer.mock.calls[0][tenantArg]).toBe(SESSION_TENANT);
    }
  });

  if (permission) {
    it(`requires ${permission}`, async () => {
      mockHasPermissionServer.mockResolvedValue(false);
      await call(SESSION_TENANT);
      expect(mockHasPermissionServer).toHaveBeenCalledWith(permission);
      expect(dataLayer).not.toHaveBeenCalled();
    });
  }
});

describe('user-level settings use the session user, never a caller-supplied id', () => {
  it('getCurrencyConfigAction', async () => {
    await getCurrencyConfigAction(SESSION_TENANT, 'branch-1', 'spoofed-user');
    expect(mockGetCurrencyConfig).toHaveBeenCalledWith(SESSION_TENANT, 'branch-1', USER);
  });

  it('getPhoneCountryCodeAction', async () => {
    await getPhoneCountryCodeAction(SESSION_TENANT, 'branch-1', 'spoofed-user');
    expect(mockGetDefaultPhoneCountryCode).toHaveBeenCalledWith(SESSION_TENANT, 'branch-1', USER);
  });
});

describe('getOrderInvoices (no tenant argument)', () => {
  it('requires a session and orders:read', async () => {
    mockHasPermissionServer.mockResolvedValue(false);
    const result = await getOrderInvoices('o1');
    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(mockGetInvoicesForOrder).not.toHaveBeenCalled();
  });
});
