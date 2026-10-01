/**
 * Tests: org-currency.service (org_currency_cf portfolio CRUD, plan 01 §4).
 * Covers: C2 (platform-enabled gate), C4 (usage guard on context-off/deactivate),
 * C6 (base-currency lock pre-check + transactional base swap), C10 (not directly —
 * the service only accepts the 4 ready-context fields, by type), C11 (pricing mode).
 */

const mockCurrencyFindMany = jest.fn();
const mockCurrencyFindFirst = jest.fn();
const mockCurrencyCreate = jest.fn();
const mockCurrencyUpdate = jest.fn();
const mockCurrencyUpdateMany = jest.fn();
const mockSysCurrencyFindUnique = jest.fn();
const mockOrdersCount = jest.fn();
const mockCheckCurrencyInUse = jest.fn();

const mockTxClient = {
  org_currency_cf: {
    update: (...a: unknown[]) => mockCurrencyUpdate(...a),
    create: (...a: unknown[]) => mockCurrencyCreate(...a),
    updateMany: (...a: unknown[]) => mockCurrencyUpdateMany(...a),
    findFirst: (...a: unknown[]) => mockCurrencyFindFirst(...a),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_currency_cf: {
      findMany: (...a: unknown[]) => mockCurrencyFindMany(...a),
      findFirst: (...a: unknown[]) => mockCurrencyFindFirst(...a),
      create: (...a: unknown[]) => mockCurrencyCreate(...a),
      update: (...a: unknown[]) => mockCurrencyUpdate(...a),
      updateMany: (...a: unknown[]) => mockCurrencyUpdateMany(...a),
    },
    sys_currency_cd: {
      findUnique: (...a: unknown[]) => mockSysCurrencyFindUnique(...a),
    },
    org_orders_mst: {
      count: (...a: unknown[]) => mockOrdersCount(...a),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(mockTxClient),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

jest.mock('@/lib/services/fx/currency-usage.service', () => ({
  checkCurrencyInUse: (...a: unknown[]) => mockCheckCurrencyInUse(...a),
}));

import {
  addCurrency,
  deactivateCurrency,
  reactivateCurrency,
  setBaseCurrency,
  setReportingCurrency,
  updateCurrency,
} from '@/lib/services/fx/org-currency.service';
import { FX_ERROR, FxError } from '@/lib/services/fx/fx-errors';
import { SALES_PRICING_MODE } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const ACTOR = { userId: USER_ID };

function platformEnabledRow(overrides: Record<string, unknown> = {}) {
  return { is_active: true, is_platform_enabled: true, ...overrides };
}

function currencyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-id',
    tenant_org_id: TENANT_ID,
    currency_code: 'USD',
    is_base_currency: false,
    is_reporting_currency: false,
    allow_sales: false,
    allow_payments: false,
    allow_cash: false,
    allow_ar: false,
    allow_wallet: false,
    allow_gift_card: false,
    allow_customer_advance: false,
    allow_purchasing: false,
    sales_pricing_mode: 'CONVERT_FROM_BASE',
    default_rate_type_code: null,
    default_rate_source_code: null,
    rate_max_age_days: null,
    allow_manual_fx_rate: false,
    manual_fx_requires_approval: true,
    manual_rate_tolerance_pct: null,
    tax_rate_source_code: null,
    is_active: true,
    rec_status: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckCurrencyInUse.mockResolvedValue({ inUse: false, reasons: [] });
});

describe('org-currency.service — addCurrency (C2, C11)', () => {
  it('rejects a currency that is not active + platform-enabled (C2)', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow({ is_platform_enabled: false }));

    await expect(addCurrency(TENANT_ID, 'XYZ', {}, ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_NOT_PLATFORM_ENABLED,
    });
    expect(mockCurrencyCreate).not.toHaveBeenCalled();
  });

  it('rejects PRICE_LIST pricing mode — reserved until price lists support currencies (C11)', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());

    await expect(
      addCurrency(TENANT_ID, 'USD', { salesPricingMode: SALES_PRICING_MODE.PRICE_LIST }, ACTOR)
    ).rejects.toMatchObject({ code: FX_ERROR.INVALID_PRICING_MODE });
  });

  it('rejects adding a currency that already has an active row', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ rec_status: 1 }));

    await expect(addCurrency(TENANT_ID, 'USD', {}, ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_ALREADY_EXISTS,
    });
  });

  it('creates a new row with contexts defaulting off', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());
    mockCurrencyFindFirst.mockResolvedValue(null);
    mockCurrencyCreate.mockResolvedValue(currencyRow({ currency_code: 'USD' }));

    const result = await addCurrency(TENANT_ID, 'USD', { allowSales: true }, ACTOR);

    expect(result.currencyCode).toBe('USD');
    const data = mockCurrencyCreate.mock.calls[0][0].data;
    expect(data.tenant_org_id).toBe(TENANT_ID);
    expect(data.allow_sales).toBe(true);
    expect(data.created_by).toBe(USER_ID);
  });

  it('revives a soft-deleted row instead of inserting a duplicate', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ id: 'old-row', rec_status: 0, is_active: false }));
    mockCurrencyUpdate.mockResolvedValue(currencyRow({ id: 'old-row' }));

    await addCurrency(TENANT_ID, 'USD', {}, ACTOR);

    expect(mockCurrencyUpdate).toHaveBeenCalledTimes(1);
    expect(mockCurrencyCreate).not.toHaveBeenCalled();
    const data = mockCurrencyUpdate.mock.calls[0][0].data;
    expect(data.is_active).toBe(true);
    expect(data.rec_status).toBe(1);
  });
});

describe('org-currency.service — updateCurrency (C4)', () => {
  it('runs the C4 usage guard when a context flag turns off, and blocks on in-use', async () => {
    mockCheckCurrencyInUse.mockResolvedValue({ inUse: true, reasons: ['OPEN_ORDERS'] });

    await expect(updateCurrency(TENANT_ID, 'USD', { allowSales: false }, ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_IN_USE,
    });
    expect(mockCurrencyFindFirst).not.toHaveBeenCalled();
  });

  it('does not call the usage guard when no context flag is turning off', async () => {
    mockCurrencyFindFirst.mockResolvedValue(currencyRow());
    mockCurrencyUpdate.mockResolvedValue(currencyRow({ allow_sales: true }));

    await updateCurrency(TENANT_ID, 'USD', { allowSales: true }, ACTOR);

    expect(mockCheckCurrencyInUse).not.toHaveBeenCalled();
  });

  it('throws CURRENCY_NOT_FOUND when the row does not exist', async () => {
    mockCurrencyFindFirst.mockResolvedValue(null);

    await expect(updateCurrency(TENANT_ID, 'USD', { allowAr: true }, ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_NOT_FOUND,
    });
  });

  it('rejects PRICE_LIST pricing mode on update too (C11)', async () => {
    await expect(
      updateCurrency(TENANT_ID, 'USD', { salesPricingMode: SALES_PRICING_MODE.PRICE_LIST }, ACTOR)
    ).rejects.toMatchObject({ code: FX_ERROR.INVALID_PRICING_MODE });
  });
});

describe('org-currency.service — setBaseCurrency (C6)', () => {
  it('is a no-op when the target is already the base currency', async () => {
    mockOrdersCount.mockResolvedValue(0);
    const current = currencyRow({ currency_code: 'OMR', is_base_currency: true });
    mockCurrencyFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(where.is_base_currency ? current : current)
    );
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());

    const result = await setBaseCurrency(TENANT_ID, 'OMR', ACTOR);

    expect(result.currencyCode).toBe('OMR');
    expect(mockCurrencyUpdate).not.toHaveBeenCalled();
    expect(mockCurrencyCreate).not.toHaveBeenCalled();
  });

  it('rejects changing the base once orders exist (C6 pre-check)', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());
    mockOrdersCount.mockResolvedValue(5);
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ currency_code: 'OMR', is_base_currency: true }));

    await expect(setBaseCurrency(TENANT_ID, 'USD', ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.BASE_CURRENCY_LOCKED,
    });
  });

  it('swaps the base currency transactionally: unsets the old base, sets the new one with all ready contexts TRUE', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());
    mockOrdersCount.mockResolvedValue(0);

    const oldBase = currencyRow({ id: 'old-base-id', currency_code: 'OMR', is_base_currency: true });
    const target = currencyRow({ id: 'target-id', currency_code: 'USD', is_base_currency: false });

    mockCurrencyFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.is_base_currency) return Promise.resolve(oldBase);
      if (where.currency_code === 'USD') return Promise.resolve(target);
      return Promise.resolve(null);
    });
    mockCurrencyUpdate.mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
      Promise.resolve({ ...target, ...data, id: where.id })
    );

    const result = await setBaseCurrency(TENANT_ID, 'USD', ACTOR);

    expect(result.isBaseCurrency).toBe(true);
    expect(mockCurrencyUpdate).toHaveBeenCalledTimes(2);
    const [unsetCall, setCall] = mockCurrencyUpdate.mock.calls;
    expect(unsetCall[0].where.id).toBe('old-base-id');
    expect(unsetCall[0].data.is_base_currency).toBe(false);
    expect(setCall[0].where.id).toBe('target-id');
    expect(setCall[0].data).toMatchObject({
      is_base_currency: true,
      is_reporting_currency: false,
      allow_sales: true,
      allow_payments: true,
      allow_cash: true,
      allow_ar: true,
    });
  });

  it('rejects a base currency that is not platform-enabled (C2 applies to base too)', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow({ is_active: false }));

    await expect(setBaseCurrency(TENANT_ID, 'XYZ', ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_NOT_PLATFORM_ENABLED,
    });
  });
});

describe('org-currency.service — setReportingCurrency', () => {
  it('rejects setting the base currency as the reporting currency', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow());
    mockCurrencyUpdateMany.mockResolvedValue({ count: 0 });
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ currency_code: 'OMR', is_base_currency: true }));

    await expect(setReportingCurrency(TENANT_ID, 'OMR', ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.REPORTING_ALREADY_SET,
    });
  });

  it('clears the reporting currency when passed null, without a lookup', async () => {
    mockCurrencyUpdateMany.mockResolvedValue({ count: 1 });

    await setReportingCurrency(TENANT_ID, null, ACTOR);

    expect(mockCurrencyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_org_id: TENANT_ID, is_reporting_currency: true }) })
    );
    expect(mockCurrencyFindFirst).not.toHaveBeenCalled();
  });
});

describe('org-currency.service — deactivateCurrency / reactivateCurrency (C4)', () => {
  it('blocks deactivating the base currency', async () => {
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ currency_code: 'OMR', is_base_currency: true }));

    await expect(deactivateCurrency(TENANT_ID, 'OMR', ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CANNOT_DEACTIVATE_BASE,
    });
    expect(mockCheckCurrencyInUse).not.toHaveBeenCalled();
  });

  it('blocks deactivating a currency that is in use (C4)', async () => {
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ currency_code: 'USD' }));
    mockCheckCurrencyInUse.mockResolvedValue({ inUse: true, reasons: ['ACTIVE_DRAWERS'] });

    await expect(deactivateCurrency(TENANT_ID, 'USD', ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_IN_USE,
    });
    expect(mockCurrencyUpdateMany).not.toHaveBeenCalled();
  });

  it('deactivates a clean foreign currency', async () => {
    mockCurrencyFindFirst.mockResolvedValue(currencyRow({ currency_code: 'USD' }));
    mockCurrencyUpdateMany.mockResolvedValue({ count: 1 });

    await deactivateCurrency(TENANT_ID, 'USD', ACTOR);

    const data = mockCurrencyUpdateMany.mock.calls[0][0].data;
    expect(data.is_active).toBe(false);
  });

  it('reactivate re-validates C2 before flipping is_active back on', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue(platformEnabledRow({ is_platform_enabled: false }));

    await expect(reactivateCurrency(TENANT_ID, 'USD', ACTOR)).rejects.toMatchObject({
      code: FX_ERROR.CURRENCY_NOT_PLATFORM_ENABLED,
    });
  });
});
