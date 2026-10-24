/**
 * P1-01 characterization: today's line price lookup used by Create
 * (`PricingService.getPriceForOrderItem`). Create charges `basePrice`
 * (see create-totals.golden G05); Edit uses `finalPrice`.
 *
 * Synthetic fixtures; a fake Supabase client answers the SQL function
 * `get_product_price` and the table reads. Exact values only.
 */

const mockGetCurrencyConfig = jest.fn();
const mockGetTaxRate = jest.fn();
const mockIsTaxExempt = jest.fn();

type Row = Record<string, unknown> | null;
interface FakeDb {
  rpcPrice: number | null;
  rpcError: { message: string } | null;
  customer: Row;
  product: Row;
  priceListItem: Row;
  rpcCalls: Record<string, unknown>[];
  eqCalls: Array<{ table: string; column: string; value: unknown }>;
}
const db: FakeDb = { rpcPrice: null, rpcError: null, customer: null, product: null, priceListItem: null, rpcCalls: [], eqCalls: [] };

function query(table: string, data: () => Row) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const m of ['select', 'lte', 'or', 'order', 'limit']) builder[m] = chain;
  builder.eq = (column: string, value: unknown) => {
    db.eqCalls.push({ table, column, value });
    return builder;
  };
  builder.single = async () => {
    const row = data();
    return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
  };
  return builder;
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ fn, ...args });
      return { data: db.rpcPrice, error: db.rpcError };
    },
    from: (table: string) => {
      if (table === 'org_customers_mst') return query(table, () => db.customer);
      if (table === 'org_product_data_mst') return query(table, () => db.product);
      if (table === 'org_price_list_items_dtl') return query(table, () => db.priceListItem);
      throw new Error(`unexpected table ${table}`);
    },
  })),
}));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({ getCurrencyConfig: (...a: unknown[]) => mockGetCurrencyConfig(...a) })),
}));
jest.mock('@/lib/services/tax.service', () => ({
  TaxService: jest.fn().mockImplementation(() => ({
    getTaxRate: (...a: unknown[]) => mockGetTaxRate(...a),
    isTaxExempt: (...a: unknown[]) => mockIsTaxExempt(...a),
    calculateTax: (amount: number, rate: number, dp: number) => Number((amount * rate).toFixed(dp)),
  })),
}));

import { PricingService } from '@/lib/services/pricing.service';
import { createClient } from '@/lib/supabase/server';

const TENANT = 'tenant-golden-001';
const service = new PricingService();
const lookup = (over: Partial<Parameters<PricingService['getPriceForOrderItem']>[0]> = {}) =>
  service.getPriceForOrderItem({
    tenantId: TENANT,
    productId: 'shirt',
    quantity: 1,
    isExpress: false,
    effectiveDate: new Date('2026-10-23T10:00:00Z'),
    ...over,
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.assign(db, { rpcPrice: null, rpcError: null, customer: null, product: null, priceListItem: null, rpcCalls: [], eqCalls: [] });
  mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 });
  mockGetTaxRate.mockResolvedValue(0);
  mockIsTaxExempt.mockResolvedValue(false);
});

describe('request-scoped base-price quotes', () => {
  const quote = (items = [{ productId: 'shirt', quantity: 1 }], tenantId = TENANT) =>
    service.getBasePricesForOrder({
      tenantId, items, decimalPlaces: 3, isExpress: false,
      effectiveDate: new Date('2026-10-23T10:00:00Z'),
    });

  it.each([0, 9, 3.3335])('matches the full lookup basePrice for RPC price %s without metadata or item tax reads', async (price) => {
    db.rpcPrice = price;
    const expected = (await lookup()).basePrice;
    jest.clearAllMocks();
    db.eqCalls = [];
    db.rpcCalls = [];
    expect(await quote()).toEqual([expected]);
    expect(db.rpcCalls).toHaveLength(1);
    expect(db.eqCalls).toEqual([]);
    expect(mockGetCurrencyConfig).not.toHaveBeenCalled();
    expect(mockGetTaxRate).not.toHaveBeenCalled();
    expect(mockIsTaxExempt).not.toHaveBeenCalled();
  });

  it('keeps express fallback behavior, including a zero express price falling back to normal', async () => {
    db.product = { default_sell_price: 1.5, default_express_sell_price: 0 };
    expect(await service.getBasePricesForOrder({
      tenantId: TENANT, items: [{ productId: 'shirt', quantity: 2 }], decimalPlaces: 3, isExpress: true,
    })).toEqual([1.5]);
    expect(db.eqCalls).toContainEqual({ table: 'org_product_data_mst', column: 'tenant_org_id', value: TENANT });
  });

  it('deduplicates identical lines, preserves quantity tiers and loads customer tier once', async () => {
    db.rpcPrice = 9;
    db.customer = { type: 'B2B', preferences: { pricing_tier: 'VIP' } };
    expect(await service.getBasePricesForOrder({
      tenantId: TENANT, decimalPlaces: 3, isExpress: true, customerId: 'cust-1',
      items: [{ productId: 'shirt', quantity: 1 }, { productId: 'shirt', quantity: 1 }, { productId: 'shirt', quantity: 2 }],
    })).toEqual([9, 9, 9]);
    expect(db.rpcCalls.map((call) => [call.p_quantity, call.p_price_list_type])).toEqual([[1, 'vip'], [2, 'vip']]);
    expect(db.eqCalls.filter((call) => call.table === 'org_customers_mst' && call.column === 'id')).toHaveLength(1);
  });

  it('bounds concurrent scalar RPCs and preserves line order', async () => {
    const client = await createClient();
    let active = 0;
    let maximum = 0;
    const rpc = jest.fn(async (_fn: string, args: { p_quantity: number }) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      active--;
      return { data: args.p_quantity, error: null };
    });
    jest.mocked(createClient).mockResolvedValueOnce({ ...client, rpc } as unknown as typeof client);
    const items = Array.from({ length: 13 }, (_, index) => ({ productId: 'shirt', quantity: index + 1 }));
    expect(await quote(items)).toEqual(items.map((item) => item.quantity));
    expect(rpc).toHaveBeenCalledTimes(13);
    expect(maximum).toBe(6);
  });

  it('does not share request-local quotes across submissions or tenants', async () => {
    db.rpcPrice = 1;
    expect(await quote()).toEqual([1]);
    db.rpcPrice = 2;
    expect(await quote(undefined, 'another-tenant')).toEqual([2]);
    db.rpcPrice = 3;
    expect(await quote()).toEqual([3]);
    expect(db.rpcCalls.map((call) => call.p_tenant_org_id)).toEqual([TENANT, 'another-tenant', TENANT]);
  });

  it('fails for an unresolved product instead of emitting a zero quote', async () => {
    await expect(quote()).rejects.toThrow('Product not found: shirt');
  });

  it('strict quotes reject RPC errors while legacy quotes retain product fallback', async () => {
    db.rpcError = { message: 'database unavailable' };
    db.product = { default_sell_price: 1.5, default_express_sell_price: null };
    await expect(service.getBasePricesForOrder({
      tenantId: TENANT, items: [{ productId: 'shirt', quantity: 1 }], decimalPlaces: 3,
      isExpress: false, strictResolution: true,
    })).rejects.toThrow('PRICING_UNAVAILABLE');
    expect(db.eqCalls).toEqual([]);
    expect(await quote()).toEqual([1.5]);
  });

  it('strict quotes allow a successful empty list lookup to use the product default', async () => {
    db.product = { default_sell_price: 1.5, default_express_sell_price: null };
    expect(await service.getBasePricesForOrder({
      tenantId: TENANT, items: [{ productId: 'shirt', quantity: 1 }], decimalPlaces: 3,
      isExpress: false, strictResolution: true,
    })).toEqual([1.5]);
  });

  it('strict quotes reject unavailable customer tier before looking up any product', async () => {
    db.rpcPrice = 9;
    await expect(service.getBasePricesForOrder({
      tenantId: TENANT, customerId: 'unavailable-customer', items: [{ productId: 'shirt', quantity: 1 }],
      decimalPlaces: 3, isExpress: false, strictResolution: true,
    })).rejects.toThrow('CUSTOMER_PRICING_UNAVAILABLE');
    expect(db.rpcCalls).toEqual([]);
  });
});

describe('P1-01 golden — price lookup', () => {
  it('P01 standard: the price list price from get_product_price', async () => {
    db.rpcPrice = 1.5;
    const r = await lookup({ quantity: 2 });
    expect(db.rpcCalls).toEqual([
      {
        fn: 'get_product_price',
        p_tenant_org_id: TENANT,
        p_product_id: 'shirt',
        p_price_list_type: 'standard',
        p_quantity: 2,
        p_effective_date: '2026-10-23',
      },
    ]);
    expect([r.basePrice, r.finalPrice, r.source, r.priceListType]).toEqual([1.5, 1.5, 'price_list', 'standard']);
  });

  it('P02 express with an express price list: that list price', async () => {
    db.rpcPrice = 2.25;
    const r = await lookup({ isExpress: true });
    expect(db.rpcCalls[0].p_price_list_type).toBe('express');
    expect([r.basePrice, r.priceListType]).toEqual([2.25, 'express']);
  });

  it('P03 express without any list: the product express price', async () => {
    db.product = { default_sell_price: 1.5, default_express_sell_price: 2.5 };
    const r = await lookup({ isExpress: true });
    expect([r.basePrice, r.source]).toEqual([2.5, 'product_default']);
    expect(db.eqCalls).toEqual(expect.arrayContaining([
      { table: 'org_product_data_mst', column: 'tenant_org_id', value: TENANT },
    ]));
  });

  it('P04 express without an express price: the normal price, with no multiplier (multiplier_express is not read)', async () => {
    db.product = { default_sell_price: 1.5, default_express_sell_price: null, multiplier_express: 1.3 };
    const r = await lookup({ isExpress: true });
    expect(r.basePrice).toBe(1.5);
  });

  it('P05 express only asks for the "express" list: a standard list (and its discount) is never consulted', async () => {
    db.product = { default_sell_price: 1.5, default_express_sell_price: 2.5 };
    await lookup({ isExpress: true });
    expect(db.rpcCalls.map((c) => c.p_price_list_type)).toEqual(['express']);
  });

  it('P06 KNOWN DEFECT (PF-08): a B2B customer on express gets the b2b list, not express', async () => {
    db.customer = { type: 'B2B', preferences: null };
    db.rpcPrice = 1.2;
    const r = await lookup({ isExpress: true, customerId: 'cust-b2b' });
    expect(db.rpcCalls[0].p_price_list_type).toBe('b2b');
    expect([r.basePrice, r.priceListType]).toEqual([1.2, 'b2b']);
    expect(db.eqCalls).toEqual(expect.arrayContaining([
      { table: 'org_customers_mst', column: 'tenant_org_id', value: TENANT },
    ]));
  });

  it('P07 the customer pricing_tier preference overrides the customer type', async () => {
    db.customer = { type: 'B2B', preferences: { pricing_tier: 'vip' } };
    db.rpcPrice = 1;
    await lookup({ customerId: 'cust-1' });
    expect(db.rpcCalls[0].p_price_list_type).toBe('vip');
  });

  it('P08 KNOWN DEFECT (PF-03): finalPrice applies the list discount a second time; basePrice is discounted once', async () => {
    // get_product_price already returns price × (1 − 10%) = 9.000 for a 10.000 list price.
    db.rpcPrice = 9;
    db.priceListItem = {
      id: 'pli-1',
      price: 10,
      discount_percent: 10,
      min_quantity: 1,
      max_quantity: null,
      org_price_lists_mst: { id: 'pl-1', name: 'Standard', name2: null },
    };
    const r = await lookup();
    expect([r.basePrice, r.discountPercent, r.finalPrice]).toEqual([9, 10, 8.1]);
    expect([r.priceListId, r.priceListItemId, r.priceListName]).toEqual(['pl-1', 'pli-1', 'Standard']);
  });

  it('P09 FLOAT DIFF FD-01: the price is rounded with float toFixed (3.3335 -> 3.333 OMR, decimal HALF_UP gives 3.334)', async () => {
    // The SQL NUMERIC arrives as a JS number, so roundMoneyAmount takes the
    // float path; the double nearest 3.3335 lies below the tie.
    db.rpcPrice = 3.3335;
    expect((await lookup()).basePrice).toBe(3.333);

    mockGetCurrencyConfig.mockResolvedValue({ currencyCode: 'SAR', decimalPlaces: 2 });
    db.rpcPrice = 2.345;
    expect((await lookup()).basePrice).toBe(2.35);
  });

  it('P10 an unknown or inactive product with no list price throws', async () => {
    await expect(lookup()).rejects.toThrow('Product not found: shirt');
  });
});
