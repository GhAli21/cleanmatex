/** @jest-environment node */

/**
 * Line-Level P7-04: the catalog CSV's express columns write a product speed rule.
 * Refusals are row errors before anything is written; the advanced template's
 * price_regular column is read; the export takes its express columns from the rules.
 */
jest.mock('server-only', () => ({}));

const createSpeedRule = jest.fn();
const listProductExpressRules = jest.fn();
const inserted: Record<string, unknown>[] = [];

jest.mock('@/lib/services/catalog/speed-rules.service', () => ({
  createSpeedRule: (...a: unknown[]) => createSpeedRule(...a),
  listProductExpressRules: (...a: unknown[]) => listProductExpressRules(...a),
}));
jest.mock('@/lib/db/tenant-context', () => ({ getTenantIdFromSession: async () => 'tenant-1' }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order']) chain[m] = () => chain;
      chain.maybeSingle = async () => ({ data: { service_category_code: 'DRY' } });
      chain.insert = (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: `p${inserted.length}` }, error: null }) }) };
      };
      chain.then = (resolve: (v: unknown) => void) =>
        resolve(table === 'org_product_data_mst'
          ? { data: [{ id: 'p1', product_code: 'A', product_name: 'Shirt', service_category_code: 'DRY', default_sell_price: 2, product_unit: 'piece', tax_category_code: 'EXEMPT', is_active: true }], error: null }
          : { data: [], error: null });
      return chain;
    },
  }),
}));

import { bulkImportProducts, exportProducts } from '@/lib/services/catalog.service';

const HEAD = 'product_code,product_name,product_name_ar,category_code,price_regular,price_express,express_multiplier,unit,min_qty,turnaround_hh,turnaround_hh_express,tax_category_code,is_active';
const line = (over: { express?: string; multiplier?: string; turnaround?: string; tax?: string } = {}) =>
  `A,Shirt,قميص,DRY,2.500,${over.express ?? ''},${over.multiplier ?? ''},piece,1,24,${over.turnaround ?? ''},${over.tax ?? 'STANDARD'},true`;
const ctx = { userId: 'u1', canCreateSpeedRules: true };
const run = (row: string, c = ctx) => bulkImportProducts(`${HEAD}\n${row}`, 'advanced', c);

beforeEach(() => {
  createSpeedRule.mockReset();
  listProductExpressRules.mockReset();
  inserted.length = 0;
});

describe('catalog import: express columns', () => {
  it('reads price_regular and creates the SELL_PRICE rule on the new product', async () => {
    const result = await run(line({ express: '3.000', turnaround: '12' }));
    expect(result.imported).toBe(1);
    expect(inserted[0]).toMatchObject({ default_sell_price: 2.5, tax_category_code: 'STANDARD', min_quantity: 1, turnaround_hh: 24, is_active: true });
    expect(inserted[0]).not.toHaveProperty('default_express_sell_price');
    expect(createSpeedRule).toHaveBeenCalledWith('tenant-1', 'u1', expect.objectContaining({
      productId: 'p1', serviceSpeed: 'EXPRESS', speedPriceType: 'SELL_PRICE', defaultSpeedSellPrice: '3.000', turnaroundHhSpeed: '12', branchId: null, serviceCategoryCode: null,
    }));
  });

  it('creates a MULTIPLIER rule from express_multiplier', async () => {
    await run(line({ multiplier: '0.30' }));
    expect(createSpeedRule.mock.calls[0][2]).toMatchObject({ speedPriceType: 'MULTIPLIER', multiplierSpeed: '0.30' });
  });

  it('writes no rule when the express columns are empty', async () => {
    const result = await run(line());
    expect(result.imported).toBe(1);
    expect(createSpeedRule).not.toHaveBeenCalled();
  });

  it.each([
    ['price and multiplier together', { express: '3', multiplier: '0.3' }, 'EXPRESS_PRICE_AND_MULTIPLIER'],
    ['a turnaround alone', { turnaround: '12' }, 'EXPRESS_TURNAROUND_NEEDS_PRICE'],
    ['a value that is not a number', { express: 'abc' }, 'EXPRESS_VALUE_INVALID'],
    ['an unknown tax category', { tax: 'NOPE' }, 'INVALID_TAX_CATEGORY'],
  ])('refuses %s before writing anything', async (_name, over, code) => {
    const result = await run(line(over));
    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe(code);
    expect(inserted).toHaveLength(0);
    expect(createSpeedRule).not.toHaveBeenCalled();
  });

  it('needs pricing:create for an express column, not for a row without one', async () => {
    const denied = await run(line({ express: '3' }), { ...ctx, canCreateSpeedRules: false });
    expect(denied.errors[0].code).toBe('EXPRESS_NEEDS_PERMISSION');
    expect(inserted).toHaveLength(0);

    const plain = await run(line(), { ...ctx, canCreateSpeedRules: false });
    expect(plain.imported).toBe(1);
  });

  it('says so when the product was created but its rule failed', async () => {
    createSpeedRule.mockRejectedValueOnce(new Error('db'));
    const result = await run(line({ express: '3' }));
    expect(result.imported).toBe(1);
    expect(result.errors[0].code).toBe('EXPRESS_RULE_NOT_SAVED');
  });
});

describe('catalog export', () => {
  it('fills the express columns from the product rule', async () => {
    listProductExpressRules.mockResolvedValue(new Map([['p1', { sellPrice: '3.5000', multiplier: null, turnaroundHours: '12.00' }]]));
    const csv = await exportProducts('advanced');
    const [head, row] = csv.split('\n');
    const cell = (name: string) => row.split(',')[head.split(',').indexOf(name)];
    expect(listProductExpressRules).toHaveBeenCalledWith('tenant-1');
    expect(cell('price_express')).toBe('3.5000');
    expect(cell('express_multiplier')).toBe('');
    expect(cell('turnaround_hh_express')).toBe('12.00');
    expect(cell('tax_category_code')).toBe('EXEMPT');
  });
});
