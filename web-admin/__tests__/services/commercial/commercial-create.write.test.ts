/**
 * P5-02 — Create writes the calculated order: a real checkout quote (mocked
 * reads) goes into `createOrderInTransaction` on a recording transaction.
 * Every §6 column, the server preference prices, the discount / charge / tax
 * rows and the header snapshots come from the quote, and the rows add up to
 * the quoted sale total (I3), which is what the rollup rebuilds the header from.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })) }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }),
}));
jest.mock('@/lib/money/currency-rounding', () => ({ resolveCurrencyRoundingRule: async () => null, roundToIncrement: (v: number) => v }));
jest.mock('@/lib/services/discount-service', () => ({
  getBestDiscount: async () => null, validatePromoCode: async () => ({ isValid: false }), evaluateBestAutoApplyPromo: async () => null,
}));
jest.mock('@/lib/services/gift-card-service', () => ({ validateGiftCardByIdForCalculation: jest.fn(), validateGiftCard: jest.fn() }));
const mockExtraMode = jest.fn();
jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: jest.fn().mockResolvedValue('TAX_EXCLUSIVE'),
  resolveExtraPricePricingMode: (...args: unknown[]) => mockExtraMode(...args),
}));
jest.mock('@/lib/services/order-source-policy', () => ({
  validateOrderSourceForCreation: jest.fn().mockResolvedValue({
    ok: true, row: { order_source_code: 'pos', requires_remote_intake_confirm: false },
  }),
}));
jest.mock('@/lib/services/workflow/workflow-profile-resolution.service', () => ({
  resolveWorkflowProfileBindingForOrderWithSupabase: jest.fn().mockResolvedValue({ initialRules: [] }),
  resolveWorkflowProfileBindingForOrderWithPrisma: jest.fn().mockResolvedValue({ initialRules: [] }),
  WorkflowProfileResolutionError: class WorkflowProfileResolutionError extends Error {},
}));
jest.mock('@/lib/services/workflow/order-create-workflow.service', () => ({
  resolveOrderCreateWorkflowState: jest.fn().mockResolvedValue({
    v_initialStatus: 'intake', v_transitionFrom: 'intake', v_orderStatus: 'intake', v_current_status: 'intake',
    v_current_stage: 'intake', physicalIntakeStatus: 'received', receivedAt: null, contractScreen: 'new_order',
    isRetailOnlyOrder: false, hydrated: {},
  }),
}));
jest.mock('@/lib/utils/order-number-generator', () => ({ generateOrderNumberWithTx: jest.fn().mockResolvedValue('ORD-0001') }));
jest.mock('@/lib/utils/org-packing-extra-price', () => ({
  fetchOrgPackingExtraPriceByCodesSupabase: jest.fn(),
  // The legacy packing map; the quote-driven path must not use it.
  fetchOrgPackingExtraPriceByCodesPrismaTx: jest.fn(async () => new Map([['HANG', 9]])),
}));
jest.mock('@/lib/utils/org-service-preference-cf-lookup', () => ({ fetchOrgServicePreferenceCfIdsByCodesPrismaTx: jest.fn(async () => new Map()) }));

import { sumMoney } from '@/lib/commercial';
import { OrderService, type CreateOrderParams } from '@/lib/services/order-service';
import { quoteCheckout, type CheckoutQuoteParams } from '@/lib/services/commercial/commercial-checkout.service';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';

import { activeTaxSetup, taxCodeColumns } from '../../helpers/tax-engine-fixtures';
const TENANT = '11111111-1111-1111-1111-111111111111';
const SHIRT = 'aaaaaaaa-0000-0000-0000-000000000001';
type Rec = Record<string, unknown>;

/** Catalog reads behind the quote. */
function catalogDb(): CommercialDb {
  const fixtures: Record<string, unknown[]> = {
    org_tenants_mst: [{ commercial_level: 'ITEM', disc_alloc_mode: 'DOCUMENT_LEVEL', disc_alloc_basis: 'PROPORTIONAL_NET', timezone: 'Asia/Muscat' }],
    org_product_data_mst: [{
      id: SHIRT, service_category_code: 'LAUNDRY', price_type: 'PER_PC', default_sell_price: '2.000', min_sell_price: null,
      turnaround_hh: '24', tax_category_code: 'STANDARD', tax_supply_code: null, tax_exempt_reason: null,
    }],
    sys_service_speed_cd: [{ code: 'STANDARD' }],
    org_tax_profiles_cf: [{
      id: 'vat', name: 'VAT', name2: null, tax_type: 'VAT', rate: '5', is_compound: false, is_default: true, applies_to: [],
      rounding_level: 'DOCUMENT', rounding_mode: 'HALF_UP', output_decimal_places: null, rounding_increment_minor: null, ...taxCodeColumns('VAT_STD'),
    }],
    ...activeTaxSetup('VAT_STD'),
    sys_currency_rounding_rules_cf: [{ rounding_mode: 'HALF_UP' }],
    org_service_preference_cf: [{ preference_code: 'STARCH', extra_price: '0.200', extra_turnaround_minutes: 0, branch_id: null }],
    sys_service_preference_cd: [{ code: 'STARCH', default_extra_price: '0.500', extra_turnaround_minutes: 0 }],
    org_packing_preference_cf: [{ packing_pref_code: 'HANG', extra_price: '0.100' }],
  };
  const model = (name: string) => ({
    findMany: async () => fixtures[name] ?? [],
    findFirst: async () => (fixtures[name] ?? [])[0] ?? null,
  });
  return new Proxy({}, { get: (_t, prop: string) => model(prop) }) as CommercialDb;
}

/** Recording Prisma transaction: every write is kept per model, ids are minted. */
function recordingTx() {
  const rows: Record<string, Rec[]> = {};
  let seq = 0;
  const store = (model: string, data: Rec) => {
    const row = { id: `${model}-${++seq}`, ...data };
    (rows[model] ??= []).push(row);
    return row;
  };
  const model = (name: string) => ({
    create: async ({ data }: { data: Rec }) => store(name, data),
    createMany: async ({ data }: { data: Rec[] }) => { data.forEach((d) => store(name, d)); return { count: data.length }; },
    createManyAndReturn: async ({ data }: { data: Rec[] }) => data.map((d) => store(name, d)),
    findFirst: async () => (name === 'org_orders_mst' ? rows[name]?.[0] ?? null : null),
    deleteMany: async () => ({ count: 0 }),
    findMany: async () => { if (name === 'org_tax_lines_tr') return []; throw new Error(`unexpected read of ${name}`); },
  });
  const tx = new Proxy({}, { get: (_t, prop: string) => (prop === '$executeRaw' ? jest.fn() : model(prop)) });
  return { tx, rows };
}

// Client prices and preference amounts are deliberately wrong: Create must not store them.
const CLIENT_PRICE = 99;
const cart: CheckoutQuoteParams = {
  tenantId: TENANT,
  percentDiscount: 10,
  items: [{
    productId: SHIRT, quantity: 2, servicePrefs: [{ preference_code: 'STARCH' }],
    pieces: [{ packingPrefCode: 'HANG' }],
  }],
  orderServicePrefs: [{ preference_code: 'STARCH' }],
};

async function createFromQuote(request: CheckoutQuoteParams = cart) {
  const checkout = await quoteCheckout({ ...request, db: catalogDb() });
  const { tx, rows } = recordingTx();
  const params = {
    tenantId: TENANT, customerId: 'cust-1', branchId: 'branch-1', orderTypeId: 'POS', userId: 'user-1', userName: 'Cashier',
    currencyCode: 'OMR',
    items: [{
      productId: SHIRT, quantity: 2, pricePerUnit: CLIENT_PRICE, totalPrice: CLIENT_PRICE, servicePrefCharge: CLIENT_PRICE,
      servicePrefs: [{ preference_code: 'STARCH', source: 'ITEM', extra_price: CLIENT_PRICE }],
      pieces: [{ pieceSeq: 1, packingPrefCode: 'HANG' }],
    }],
    orderServicePrefs: [{ preference_code: 'STARCH', source: 'ORDER', extra_price: CLIENT_PRICE }],
    totals: { subtotal: checkout.totals.subtotal, total: checkout.totals.saleTotal },
    commercial: checkout,
  } as CreateOrderParams;
  const result = await OrderService.createOrderInTransaction(tx as never, params);
  expect(result.success).toBe(true);
  return { rows, checkout };
}

describe('P5-02 Create writes the calculated order', () => {
  beforeEach(() => mockExtraMode.mockResolvedValue('INCLUDED_IN_ITEM_PRICE'));

  it('items and pieces carry every §6.1 column from the calculator; client prices are ignored', async () => {
    const { rows, checkout } = await createFromQuote();
    const [item] = rows.org_order_items_dtl;
    // 2 × 2.000 + STARCH 0.200 + the piece's HANG 0.100.
    expect(item).toMatchObject({
      money_basis: 'PRICED', price_source: 'PRODUCT_DEFAULT', list_unit_price: '2.0000', price_per_unit: '2.0000',
      total_price: '4.3000', service_pref_charge: '0.3000', tax_rate: '5.00', tax_category_code: 'STANDARD',
      tax_pricing_mode: 'TAX_EXCLUSIVE', order_disc_alloc_amount: '0.0000',
    });
    const pieces = rows.org_order_item_pieces_dtl;
    expect(pieces.map((p) => p.money_basis)).toEqual(['ALLOCATED', 'ALLOCATED']);
    expect(sumMoney(pieces.map((p) => p.total_price as string)).toFixed(4)).toBe(item.total_price);
    // The piece with HANG weighs more than the plain one.
    expect(Number(pieces[0].total_price)).toBeGreaterThan(Number(pieces[1].total_price));
    expect(checkout.quote.result.lines[0].item.money.grossAmount.toFixed(4)).toBe(item.total_price);
  });

  it('preference rows store the server price, not the client amount', async () => {
    const { rows } = await createFromQuote();
    expect(rows.org_order_preferences_dtl.map((p) => [p.prefs_level, p.preference_code, String(p.extra_price)])).toEqual([
      ['ITEM', 'STARCH', '0.200'], ['PIECE', 'HANG', '0.100'], ['ORDER', 'STARCH', '0.200'],
    ]);
  });

  it('discount, charge and tax rows; the order charge is taxed (L25) and points at its preference row', async () => {
    const { rows, checkout } = await createFromQuote();
    const orderPref = rows.org_order_preferences_dtl.find((p) => p.prefs_level === 'ORDER')!;
    expect(rows.org_order_charges_dtl).toEqual([expect.objectContaining({
      charge_type: 'PREFERENCE', charge_source_id: orderPref.id, amount: '0.2000',
      tax_category_code: 'STANDARD', tax_amount: '0.0100', currency_code: 'OMR',
    })]);
    // Manual 10% of 4.300 = 0.430, stored per tax category (DOCUMENT_LEVEL).
    expect(rows.org_order_discounts_dtl).toEqual([expect.objectContaining({
      discount_level: 'ORDER', source_type: 'MANUAL', discount_type: 'PERCENTAGE', discount_rate: '10',
      discount_amount: '0.4300', disc_alloc_mode: 'DOCUMENT_LEVEL', tax_category_code: 'STANDARD',
    })]);
    expect(rows.org_order_taxes_dtl).toEqual([expect.objectContaining({
      tax_profile_id: 'vat', label: 'VAT', rate: '5', tax_amount: checkout.quote.result.taxLines[0].taxAmount.toFixed(4),
    })]);
  });

  it('the header carries the snapshots, and the rows add up to the quoted total (I3)', async () => {
    const { rows, checkout } = await createFromQuote();
    expect(rows.org_orders_mst[0]).toMatchObject({
      commercial_level: 'ITEM', tax_pricing_mode: 'TAX_EXCLUSIVE', extra_price_pricing_mode: 'INCLUDED_IN_ITEM_PRICE',
      disc_alloc_mode: 'DOCUMENT_LEVEL', commercial_calc_version: 1, service_speed: 'STANDARD',
    });
    const sum = (model: string, col: string) => sumMoney((rows[model] ?? []).map((r) => r[col] as string));
    const total = sum('org_order_items_dtl', 'total_price')
      .plus(sum('org_order_charges_dtl', 'amount'))
      .minus(sum('org_order_discounts_dtl', 'discount_amount'))
      .plus(sum('org_order_taxes_dtl', 'tax_amount'));
    expect(total.toNumber()).toBe(checkout.totals.saleTotal);
    for (const [model, list] of Object.entries(rows)) {
      for (const row of list) expect([model, row.tenant_org_id]).toEqual([model, TENANT]);
    }
  });

  it('P5-03c: a cashier line discount is an ITEM row on its line, with its reason; the rows still add up (I3)', async () => {
    const { rows, checkout } = await createFromQuote({
      ...cart, percentDiscount: 0,
      items: [{ ...cart.items[0], lineDiscount: { type: 'FIXED_AMOUNT', value: 0.3, reason: 'Stain not removed last time' } }],
    });
    const [item] = rows.org_order_items_dtl;
    expect(item).toMatchObject({ total_price: '4.3000', line_disc_amount: '0.3000' });
    expect(rows.org_order_discounts_dtl).toEqual([expect.objectContaining({
      discount_level: 'ITEM', order_item_id: item.id, source_type: 'MANUAL', discount_type: 'FIXED_AMOUNT',
      discount_amount: '0.3000', source_name: 'Line Discount', rec_notes: 'Stain not removed last time',
    })]);
    const sum = (model: string, col: string) => sumMoney((rows[model] ?? []).map((r) => r[col] as string));
    const total = sum('org_order_items_dtl', 'total_price')
      .plus(sum('org_order_charges_dtl', 'amount'))
      .minus(sum('org_order_discounts_dtl', 'discount_amount'))
      .plus(sum('org_order_taxes_dtl', 'tax_amount'));
    expect(total.toNumber()).toBe(checkout.totals.saleTotal);
  });

  it('P5-03e: a custom item is written with no product, its entered price as MANUAL and its name', async () => {
    const checkout = await quoteCheckout({
      tenantId: TENANT, items: [{ customItem: { name: 'Wedding dress', unitPrice: 5, serviceCategoryCode: 'LAUNDRY' }, quantity: 1 }],
      db: catalogDb(),
    });
    const { tx, rows } = recordingTx();
    const result = await OrderService.createOrderInTransaction(tx as never, {
      tenantId: TENANT, customerId: 'cust-1', branchId: 'branch-1', orderTypeId: 'POS', userId: 'user-1', userName: 'Cashier',
      currencyCode: 'OMR',
      items: [{ productId: null, productName: 'Wedding dress', quantity: 1, pricePerUnit: CLIENT_PRICE, totalPrice: CLIENT_PRICE }],
      totals: { subtotal: checkout.totals.subtotal, total: checkout.totals.saleTotal },
      commercial: checkout,
    } as CreateOrderParams);
    expect(result.success).toBe(true);
    expect(rows.org_order_items_dtl[0]).toMatchObject({
      product_id: null, product_name: 'Wedding dress', price_source: 'MANUAL', price_per_unit: '5.0000', total_price: '5.0000',
    });
    expect(rows.org_order_item_pieces_dtl.every((p) => p.product_id === null)).toBe(true);
  });

  it('SEPARATE_CHARGE: a line preference becomes its own charge, pointing at the item preference row', async () => {
    mockExtraMode.mockResolvedValue('SEPARATE_CHARGE');
    const { rows } = await createFromQuote();
    expect(rows.org_order_items_dtl[0]).toMatchObject({ total_price: '4.0000', service_pref_charge: '0.0000' });
    const itemStarch = rows.org_order_preferences_dtl.find((p) => p.prefs_level === 'ITEM')!;
    const pieceHang = rows.org_order_preferences_dtl.find((p) => p.prefs_level === 'PIECE')!;
    const sources = rows.org_order_charges_dtl.map((c) => c.charge_source_id);
    expect(sources).toEqual(expect.arrayContaining([itemStarch.id, pieceHang.id]));
    expect(rows.org_order_charges_dtl.every((c) => c.tax_category_code === 'STANDARD')).toBe(true);
  });
});
