/**
 * P6-01a: Edit re-prices through the same calculator as Create.
 * An order written by the real Create path is read back as an Edit record;
 * re-pricing it with no change gives exactly the stored figures, and each
 * kind of change follows L24 (stored list price kept; speed rule and ready-by
 * read again only when the speed changes; a new line priced from the catalog).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })) }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }),
}));
jest.mock('@/lib/money/currency-rounding', () => ({ resolveCurrencyRoundingRule: async () => null, roundToIncrement: (v: number) => v }));
const mockBestDiscount = jest.fn(async (): Promise<unknown> => null);
jest.mock('@/lib/services/discount-service', () => ({
  getBestDiscount: () => mockBestDiscount(), validatePromoCode: async () => ({ isValid: false }), evaluateBestAutoApplyPromo: async () => null,
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
      rounding_level: 'DOCUMENT', rounding_mode: 'HALF_UP', output_decimal_places: null, rounding_increment_minor: null,
    }],
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
    findFirst: async () => null,
    findMany: async () => { throw new Error(`unexpected read of ${name}`); },
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
  const checkout = await quoteCheckout({ db: catalogDb(), ...request });
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

import {
  CommercialEditError,
  quoteOrderEdit,
  readEditOrderRecord,
  type EditOrderRecord,
  type EditProjection,
  type EditRecordDb,
} from '@/lib/services/commercial/commercial-edit.loader';
import { lineMoneyColumns } from '@/lib/services/commercial/commercial-line.writer';
import { editMoneyColumns, replaceEditChildRows, type EditChildRowsTx } from '@/lib/services/commercial/commercial-edit.writer';

const DEPS = { currency: { code: 'OMR', decimalPlaces: 3 } };
const MONEY_COLUMNS = [
  'list_unit_price', 'price_per_unit', 'total_price', 'service_pref_charge', 'speed_premium_amount', 'line_disc_amount',
  'order_disc_alloc_amount', 'net_amount', 'taxable_amount', 'tax_amount', 'line_total_amount', 'price_source', 'service_speed',
] as const;

/** Serves the rows Create wrote (and the catalog product and profile) as the stored order. */
function storedDb(rows: Record<string, Rec[]>): EditRecordDb {
  const catalog = catalogDb() as unknown as Record<string, { findMany: () => Promise<unknown[]> }>;
  const served = (name: string) => async () => {
    if (name === 'org_product_data_mst' || name === 'org_tax_profiles_cf') return catalog[name].findMany();
    return (rows[name] ?? []).map((r) => ({ rec_status: 1, is_voided: false, ...r }));
  };
  return new Proxy({}, {
    get: (_t, name: string) => ({
      findMany: served(name),
      findFirst: async () => (await served(name)())[0] ?? null,
    }),
  }) as unknown as EditRecordDb;
}

async function storedOrder(request: CheckoutQuoteParams = cart) {
  const { rows, checkout } = await createFromQuote(request);
  const order = rows.org_orders_mst[0];
  const record = await readEditOrderRecord(storedDb(rows), TENANT, order.id as string);
  return { rows, checkout, record };
}

/** The order as it is: every stored line, piece and preference, no change. */
function unchanged(record: EditOrderRecord, editedAt = new Date()): EditProjection {
  return {
    serviceSpeed: record.serviceSpeed,
    editedAt,
    lines: record.items.map((i) => ({
      id: i.id, quantity: i.quantity, serviceSpeed: i.serviceSpeed as string,
      pieceIds: record.pieces.filter((p) => p.itemId === i.id).map((p) => p.id),
    })),
    preferences: record.preferences,
  };
}

/** The order moved to EXPRESS, which this catalog does not offer: the rule is read again, so the speed is checked. */
function toExpress(projection: EditProjection): EditProjection {
  return {
    ...projection,
    serviceSpeed: 'EXPRESS',
    lines: projection.lines.map((l) => ({ ...l, serviceSpeed: 'EXPRESS' })),
  };
}

/** The catalog plus EXPRESS at +50% of the list price (a MULTIPLIER rule on the category). */
function expressDb(): CommercialDb {
  const base = catalogDb() as unknown as Record<string, unknown>;
  const rule = {
    id: 'rule-x', service_speed: 'EXPRESS', branch_id: null, service_category_code: 'LAUNDRY', product_id: null,
    speed_price_type: 'MULTIPLIER', default_speed_sell_price: null, multiplier_speed: '0.5', speed_extra_amount: null,
    price_basis: null, turnaround_hh_speed: '6', effective_from: new Date('2020-01-01'), effective_to: null,
    is_active: true, rec_status: 1,
  };
  const overrides: Record<string, unknown[]> = {
    sys_service_speed_cd: [{ code: 'STANDARD' }, { code: 'EXPRESS' }],
    org_speed_price_rules_cf: [rule],
  };
  return new Proxy({}, {
    get: (_t, name: string) => (overrides[name]
      ? { findMany: async () => overrides[name], findFirst: async () => overrides[name][0] }
      : base[name]),
  }) as CommercialDb;
}

describe('P6-01a Edit re-prices on the calculator', () => {
  beforeEach(() => mockExtraMode.mockResolvedValue('INCLUDED_IN_ITEM_PRICE'));

  it('no change: every stored item and piece figure, the tax lines and the total come back identical', async () => {
    const { rows, checkout, record } = await storedOrder();
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, unchanged(record), DEPS);
    const { result, prices, facts } = edit.quote;
    expect(result.totals.totalAmount.toFixed(4)).toBe(checkout.quote.result.totals.totalAmount.toFixed(4));
    const line = result.lines[0];
    const columns = lineMoneyColumns(line.item, line, prices[0], false, facts.pricingMode);
    const storedItem = rows.org_order_items_dtl[0];
    for (const column of MONEY_COLUMNS) expect([column, columns[column]]).toEqual([column, storedItem[column]]);
    expect(columns.ready_by_at).toEqual(storedItem.ready_by_at);
    line.pieces.forEach((piece, k) => {
      const pieceColumns = lineMoneyColumns(piece, line, prices[0], false, facts.pricingMode);
      expect(pieceColumns.total_price).toBe(rows.org_order_item_pieces_dtl[k].total_price);
      expect(pieceColumns.tax_amount).toBe(rows.org_order_item_pieces_dtl[k].tax_amount);
    });
    expect(result.taxLines.map((t) => t.taxAmount.toFixed(4))).toEqual(rows.org_order_taxes_dtl.map((t) => t.tax_amount));
    expect(result.document.adjustments.map((a) => a.amount.toFixed(4))).toEqual(['0.4300']);
    expect(result.charges.map((c) => c.netAmount.toFixed(4))).toEqual(['0.2000']);
  });

  it('a later catalog price change never re-prices a stored line (L24)', async () => {
    const { record } = await storedOrder();
    const raised = new Map([...record.products].map(([id, p]) => [id, { ...p, defaultSellPrice: '9.000' }]));
    const edit = await quoteOrderEdit(catalogDb(), TENANT, { ...record, products: raised }, unchanged(record), DEPS);
    expect(edit.quote.result.lines[0].item.money.listUnitPrice.toFixed(4)).toBe('2.0000');
  });

  it('a quantity change keeps the unit list price, the stored preferences and the recorded discount rate', async () => {
    const { record } = await storedOrder();
    const projection = unchanged(record);
    const pieceIds = [...projection.lines[0].pieceIds, 'new-piece'];
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, {
      ...projection, lines: [{ ...projection.lines[0], quantity: 3, pieceIds }],
    }, DEPS);
    const item = edit.quote.result.lines[0].item.money;
    // 3 × 2.000 + STARCH 0.200 + HANG 0.100.
    expect([item.unitPrice.toFixed(4), item.grossAmount.toFixed(4)]).toEqual(['2.0000', '6.3000']);
    // The manual 10% is applied again on the new base: 6.300 × 10% = 0.630.
    expect(edit.quote.result.document.adjustments.map((a) => a.amount.toFixed(4))).toEqual(['0.6300']);
    expect(edit.quote.result.lines[0].pieces).toHaveLength(3);
  });

  it('a new line is priced from the catalog on the edit date and follows the stored lines', async () => {
    const { record } = await storedOrder();
    const projection = unchanged(record);
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, {
      ...projection,
      lines: [{ id: 'new-line', productId: SHIRT, quantity: 1, serviceSpeed: 'STANDARD', pieceIds: [] }, ...projection.lines],
    }, DEPS);
    const added = edit.quote.result.lines.find((l) => l.lineId === 'new-line')!;
    expect(added.item.money.grossAmount.toFixed(4)).toBe('2.0000');
    expect(edit.quote.result.lines.map((l) => l.lineId)).toEqual([record.items[0].id, 'new-line']);
  });

  it('an unchanged speed keeps the stored premium and ready-by; a changed speed reads the rule again', async () => {
    const { record } = await storedOrder();
    const projection = unchanged(record);
    const kept = await quoteOrderEdit(catalogDb(), TENANT, record, projection, DEPS);
    expect(kept.quote.result.lines[0].readyBy.source).toBe('RECORDED');
    expect(kept.quote.prices[0].speed.outcome).toBe('RECORDED');
    await expect(quoteOrderEdit(catalogDb(), TENANT, record, toExpress(projection), DEPS))
      .rejects.toMatchObject({ code: 'SERVICE_SPEED_INVALID' });
  });

  it('an express line keeps its stored premium and ready-by on a quantity change, even after the rule changed', async () => {
    const { rows, record } = await storedOrder({ ...cart, serviceSpeed: 'EXPRESS', db: expressDb() } as CheckoutQuoteParams);
    expect([rows.org_order_items_dtl[0].price_per_unit, rows.org_order_items_dtl[0].speed_premium_amount]).toEqual(['3.0000', '2.0000']);
    const projection = unchanged(record);
    const pieceIds = [...projection.lines[0].pieceIds, 'new-piece'];
    // The rule is gone from today's catalog: the stored +1.000 a unit still stands.
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, {
      ...projection, lines: [{ ...projection.lines[0], quantity: 3, pieceIds }],
    }, DEPS);
    const item = edit.quote.result.lines[0];
    expect([item.item.money.unitPrice.toFixed(4), item.item.money.speedPremiumAmount.toFixed(4)]).toEqual(['3.0000', '3.0000']);
    expect(item.readyBy.readyByAt).toEqual(rows.org_order_items_dtl[0].ready_by_at);
    expect(edit.quote.prices[0].speed.ruleId).toBe('rule-x');
  });

  it('moving an express line back to standard drops the premium and counts the ready-by again', async () => {
    const { rows, record } = await storedOrder({ ...cart, serviceSpeed: 'EXPRESS', db: expressDb() } as CheckoutQuoteParams);
    const projection = unchanged(record);
    const edit = await quoteOrderEdit(expressDb(), TENANT, record, {
      ...projection, serviceSpeed: 'STANDARD', lines: [{ ...projection.lines[0], serviceSpeed: 'STANDARD' }],
    }, DEPS);
    const line = edit.quote.result.lines[0];
    expect([line.item.money.unitPrice.toFixed(4), line.item.money.speedPremiumAmount.toFixed(4)]).toEqual(['2.0000', '0.0000']);
    expect(line.readyBy.source).toBe('PRODUCT');
    expect(line.readyBy.readyByAt).not.toEqual(rows.org_order_items_dtl[0].ready_by_at);
  });

  it('an order written before the calculator is refused (ORDER_NEEDS_RECOMPUTE)', async () => {
    const { record } = await storedOrder();
    await expect(quoteOrderEdit(catalogDb(), TENANT, { ...record, calcVersion: null }, unchanged(record), DEPS))
      .rejects.toBeInstanceOf(CommercialEditError);
    const noLinePrice = { ...record, items: record.items.map((i) => ({ ...i, listUnitPrice: null })) };
    await expect(quoteOrderEdit(catalogDb(), TENANT, noLinePrice, unchanged(record), DEPS))
      .rejects.toMatchObject({ code: 'ORDER_NEEDS_RECOMPUTE' });
  });

  it('the recorded tax rate is used, not the profile row read today (D22)', async () => {
    const { record } = await storedOrder();
    const recordedAt7 = { ...record, taxLines: record.taxLines.map((t) => ({ ...t, ratePercent: '7' })) };
    const edit = await quoteOrderEdit(catalogDb(), TENANT, recordedAt7, unchanged(record), DEPS);
    expect(edit.quote.facts.taxProfiles.map((p) => String(p.ratePercent))).toEqual(['7']);
  });
});

describe('P6-02c a stored line\'s cashier price and discount', () => {
  beforeEach(() => mockExtraMode.mockResolvedValue('INCLUDED_IN_ITEM_PRICE'));

  it('sets a cashier price and a line discount on a stored line, labelled as on Create', async () => {
    const { record } = await storedOrder();
    const projection = unchanged(record);
    const lineId = record.items[0].id;
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, {
      ...projection,
      lines: [{ ...projection.lines[0], overrideUnitPrice: '1.500', lineDiscount: { type: 'FIXED_AMOUNT', value: '0.5', reason: 'Stain' } }],
    }, DEPS);
    const money = edit.quote.result.lines[0].item.money;
    expect([money.unitPrice.toFixed(4), money.lineDiscountAmount.toFixed(4)]).toEqual(['1.5000', '0.5000']);
    expect(edit.intent.lines[0].overrideUnitPrice).toBe('1.500');
    expect(edit.adjustmentMeta.get(`${lineId}:manual`)).toEqual({ sourceName: 'Line Discount', sourceName2: 'خصم سطر', notes: 'Stain' });
  });

  it('keeps a stored cashier price unless the edit clears it, and a cleared one returns to the list price', async () => {
    const { record } = await storedOrder();
    const overridden = { ...record, items: record.items.map((i) => ({ ...i, priceOverride: '1.5000' })) };
    const projection = unchanged(record);
    const kept = await quoteOrderEdit(catalogDb(), TENANT, overridden, projection, DEPS);
    expect(kept.quote.result.lines[0].item.money.unitPrice.toFixed(4)).toBe('1.5000');
    const cleared = await quoteOrderEdit(catalogDb(), TENANT, overridden, {
      ...projection, lines: [{ ...projection.lines[0], overrideUnitPrice: null }],
    }, DEPS);
    expect(cleared.quote.result.lines[0].item.money.unitPrice.toFixed(4)).toBe('2.0000');
    expect(cleared.intent.lines[0].overrideUnitPrice).toBeNull();
  });

  it('P6-02d: a new custom line is priced at its entered price, with no product', async () => {
    const { record } = await storedOrder();
    const projection = unchanged(record);
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, {
      ...projection,
      lines: [...projection.lines, { id: 'custom-line', quantity: 2, serviceSpeed: 'STANDARD', pieceIds: [], productId: null, customItem: { unitPrice: '3.500', serviceCategoryCode: 'LAUNDRY' } }],
    }, DEPS);
    const added = edit.quote.result.lines.find((l) => l.lineId === 'custom-line')!;
    expect(added.item.money.grossAmount.toFixed(4)).toBe('7.0000');
    expect(edit.quote.prices.find((p) => p.lineId === 'custom-line')?.productId).toBeNull();
  });

  it('replaces only the line\'s own cashier discount and keeps it when the edit does not touch it', async () => {
    const { record } = await storedOrder();
    const lineId = record.items[0].id;
    const manual = {
      id: 'disc-manual', level: 'ITEM', itemId: lineId, pieceId: null, sourceType: 'MANUAL', sourceId: null,
      sourceName: 'Line Discount', sourceName2: null, promotionId: null, discountType: 'FIXED_AMOUNT',
      discountRate: null, discountAmount: '0.3000', notes: 'Old reason', appliedSeq: 9,
    };
    const withManual = { ...record, discounts: [...record.discounts, manual] };
    const projection = unchanged(record);
    const lineDiscountOf = (edit: Awaited<ReturnType<typeof quoteOrderEdit>>) => edit.quote.result.lines[0].item.money.lineDiscountAmount.toFixed(4);
    expect(lineDiscountOf(await quoteOrderEdit(catalogDb(), TENANT, withManual, projection, DEPS))).toBe('0.3000');
    const removed = await quoteOrderEdit(catalogDb(), TENANT, withManual, {
      ...projection, lines: [{ ...projection.lines[0], lineDiscount: null }],
    }, DEPS);
    expect(lineDiscountOf(removed)).toBe('0.0000');
    const replaced = await quoteOrderEdit(catalogDb(), TENANT, withManual, {
      ...projection, lines: [{ ...projection.lines[0], lineDiscount: { type: 'FIXED_AMOUNT', value: '0.2', reason: 'New reason' } }],
    }, DEPS);
    expect(lineDiscountOf(replaced)).toBe('0.2000');
    expect(replaced.adjustmentMeta.get(`${lineId}:manual`)?.notes).toBe('New reason');
  });
});

describe('P1B-05 recorded order discounts are re-evaluated (D21)', () => {
  afterEach(() => mockBestDiscount.mockResolvedValue(null));

  it('re-applies the recorded rule on the new base, and removes it when its minimum is no longer met', async () => {
    // Create granted "Weekday 10%" on 2 × 2.000 + STARCH 0.200 + HANG 0.100 = 4.300 → 0.430.
    mockBestDiscount.mockResolvedValue({
      rule: { id: 'rule-w', rule_name: 'Weekday 10%', rule_name2: null, can_stack_with_promo: true }, discount_amount: 0.43,
    });
    const { rows } = await createFromQuote({ ...cart, percentDiscount: 0 });
    rows.org_discount_rules_cf = [{ id: 'rule-w', discount_type: 'percentage', discount_value: '10', conditions: { min_order_amount: 4 } }];
    const record = await readEditOrderRecord(storedDb(rows), TENANT, rows.org_orders_mst[0].id as string);
    expect(record.discountRules.get('rule-w')).toMatchObject({ discountValue: '10' });
    const line = unchanged(record).lines[0];

    const same = await quoteOrderEdit(catalogDb(), TENANT, record, unchanged(record), DEPS);
    expect(same.discountChanges).toEqual([expect.objectContaining({ key: 'DISCOUNT_RULE:rule-w', outcome: 'KEPT', amount: '0.4300' })]);

    const up = await quoteOrderEdit(catalogDb(), TENANT, record, { ...unchanged(record), lines: [{ ...line, quantity: 3 }] }, DEPS);
    // 3 × 2.000 + 0.300 = 6.300 → 10% = 0.630.
    expect(up.discountChanges[0]).toMatchObject({ outcome: 'CHANGED', previousAmount: '0.4300', amount: '0.6300' });

    const down = await quoteOrderEdit(catalogDb(), TENANT, record, { ...unchanged(record), lines: [{ ...line, quantity: 1 }] }, DEPS);
    expect(down.discountChanges[0]).toMatchObject({ outcome: 'REMOVED', reason: 'MIN_ORDER_NOT_MET', amount: '0.0000' });
    expect(down.quote.result.document.adjustments).toEqual([]);
  });
});

describe('P6-01c Edit writes the calculated order', () => {
  beforeEach(() => mockExtraMode.mockResolvedValue('INCLUDED_IN_ITEM_PRICE'));

  /** Applies the writer's output to the stored rows, as Apply's transaction would. */
  async function applyEdit(quantity: number) {
    const { rows, record } = await storedOrder();
    const projection = unchanged(record);
    const extra = Array.from({ length: Math.max(0, quantity - projection.lines[0].pieceIds.length) }, (_, k) => `new-piece-${k + 1}`);
    const edit = await quoteOrderEdit(catalogDb(), TENANT, record, {
      ...projection, lines: [{ ...projection.lines[0], quantity, pieceIds: [...projection.lines[0].pieceIds, ...extra] }],
    }, DEPS);
    const money = editMoneyColumns(edit);
    const written: Record<string, Rec[]> = {};
    const retired: Record<string, Rec> = {};
    const model = (name: string) => ({
      updateMany: jest.fn(async ({ where, data }: { where: Rec; data: Rec }) => { retired[name] = { where, data }; return { count: 1 }; }),
      createMany: jest.fn(async ({ data }: { data: Rec[] }) => { written[name] = data; return { count: data.length }; }),
    });
    const tx = { org_order_discounts_dtl: model('discounts'), org_order_charges_dtl: model('charges'), org_order_taxes_dtl: model('taxes') };
    await replaceEditChildRows(tx as unknown as EditChildRowsTx, {
      tenantOrgId: TENANT, orderId: record.orderId, currencyCode: 'OMR', userId: 'user-1', at: new Date(), edit,
    });
    return { rows, record, edit, money, written, retired };
  }

  it('the written rows add up to the reviewed total (I3), and the pieces add up to their item (I1)', async () => {
    const { record, edit, money, written } = await applyEdit(3);
    const item = money.items.get(record.items[0].id)!;
    const sum = (list: Rec[] | undefined, col: string) => sumMoney((list ?? []).map((r) => r[col] as string));
    const total = toMoneyText(item.total_price)
      .plus(sum(written.charges, 'amount'))
      .minus(sum(written.discounts, 'discount_amount'))
      .plus(sum(written.taxes, 'tax_amount'));
    expect(total.toFixed(4)).toBe(edit.quote.result.totals.totalAmount.toFixed(4));
    const pieces = [...money.pieces.values()];
    expect(pieces).toHaveLength(3);
    expect(sumMoney(pieces.map((p) => p.total_price)).toFixed(4)).toBe(item.total_price);
    expect(sumMoney(pieces.map((p) => p.tax_amount)).toFixed(4)).toBe(item.tax_amount);
  });

  it('the old rows are retired for this order only; the order charge points at its preference row', async () => {
    const { rows, record, written, retired } = await applyEdit(3);
    for (const name of ['discounts', 'charges', 'taxes']) {
      expect(retired[name].where).toMatchObject({ tenant_org_id: TENANT, order_id: record.orderId });
    }
    expect(retired.discounts.data).toMatchObject({ is_voided: true, voided_by: 'user-1' });
    expect(retired.taxes.data).toMatchObject({ rec_status: 0 });
    const orderPref = rows.org_order_preferences_dtl.find((p) => p.prefs_level === 'ORDER')!;
    expect(written.charges).toEqual([expect.objectContaining({
      tenant_org_id: TENANT, charge_type: 'PREFERENCE', charge_source_id: orderPref.id, label: 'STARCH', amount: '0.2000',
    })]);
    // The recorded manual 10% is stored again on the new base, with its label.
    expect(written.discounts).toEqual([expect.objectContaining({
      source_type: 'MANUAL', discount_type: 'PERCENTAGE', discount_amount: '0.6300', source_name: 'Manual Discount',
    })]);
  });

  it('an unchanged order writes back exactly what Create stored', async () => {
    const { rows, money, written } = await applyEdit(2);
    const item = [...money.items.values()][0];
    for (const column of MONEY_COLUMNS) expect([column, item[column]]).toEqual([column, rows.org_order_items_dtl[0][column]]);
    expect(written.taxes.map((t) => t.tax_amount)).toEqual(rows.org_order_taxes_dtl.map((t) => t.tax_amount));
    expect(money.readyBy).toBeNull();
  });
});

const toMoneyText = (value: string) => sumMoney([value]);
