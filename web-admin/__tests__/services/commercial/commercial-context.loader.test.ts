/**
 * P5-01 — commercial context loader: every org_* read is tenant-filtered,
 * intents become calculator input from server facts only, and the result
 * runs through the calculator end to end.
 */
import {
  buildCommercialOrderInput,
  customerPriceListType,
  loadCommercialFacts,
  CommercialContextError,
  type CommercialDb,
  type CommercialOrderIntent,
} from '@/lib/services/commercial/commercial-context.loader';
import { calculateCommercialOrder } from '@/lib/commercial';
import { quoteCommercialOrder, type OrderAdjustmentContext } from '@/lib/services/commercial/commercial-quote.service';

jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({
  resolveTaxPricingMode: jest.fn().mockResolvedValue('TAX_EXCLUSIVE'),
  resolveExtraPricePricingMode: jest.fn().mockResolvedValue('INCLUDED_IN_ITEM_PRICE'),
}));

import { TAX_ENGINE_MODELS, activeTaxSetup, taxCodeColumns } from '../../helpers/tax-engine-fixtures';
const TENANT = '11111111-1111-1111-1111-111111111111';
const BRANCH = '22222222-2222-2222-2222-222222222222';
const CUSTOMER = '33333333-3333-3333-3333-333333333333';
const SHIRT = 'aaaaaaaa-0000-0000-0000-000000000001';
const SUIT = 'aaaaaaaa-0000-0000-0000-000000000002';
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Fixtures = Record<string, unknown[]>;

/** A mock Prisma client; each model's findMany/findFirst returns its fixture rows and records the call. */
function mockDb(fixtures: Fixtures) {
  const calls: { model: string; args: { where?: Record<string, unknown> } }[] = [];
  const model = (name: string) => ({
    findMany: jest.fn(async (args) => { calls.push({ model: name, args }); return fixtures[name] ?? []; }),
    findFirst: jest.fn(async (args) => { calls.push({ model: name, args }); return (fixtures[name] ?? [])[0] ?? null; }),
  });
  const names = ['org_tenants_mst', 'org_branches_mst', 'org_customers_mst', 'org_product_data_mst', 'org_price_lists_mst',
    'org_price_list_items_dtl', 'org_speed_price_rules_cf', 'org_tax_profiles_cf', 'org_tax_exemptions_cf',
    'org_service_preference_cf', 'org_packing_preference_cf', 'sys_service_preference_cd', 'sys_service_category_cd',
    'sys_service_speed_cd', 'sys_currency_rounding_rules_cf', 'org_holidays_cf', 'sys_public_holidays_cf', ...TAX_ENGINE_MODELS];
  return { db: Object.fromEntries(names.map((n) => [n, model(n)])) as unknown as CommercialDb, calls };
}

const product = (id: string, over: Record<string, unknown> = {}) => ({
  id, service_category_code: 'DRY_CLEAN', price_type: 'PER_PC', default_sell_price: '1.000', min_sell_price: null,
  turnaround_hh: '24', tax_category_code: 'STANDARD', tax_exempt_reason: null, ...over,
});

const baseFixtures = (): Fixtures => ({
  org_tenants_mst: [{ commercial_level: 'ITEM', disc_alloc_mode: 'ALLOCATE_TO_LINES', disc_alloc_basis: 'PROPORTIONAL_NET', timezone: 'Asia/Muscat' }],
  org_branches_mst: [{ timezone_code: null }],
  org_customers_mst: [{ type: 'walk_in', preferences: { pricing_tier: 'VIP' } }],
  org_product_data_mst: [product(SHIRT), product(SUIT, { default_sell_price: '4.000' })],
  org_price_list_items_dtl: [
    { id: 'pli-std', price_list_id: 'pl-std', product_id: SHIRT, price: '2.000', discount_percent: '10', min_quantity: 1, max_quantity: null, is_active: true, rec_status: 1 },
    { id: 'pli-vip', price_list_id: 'pl-vip', product_id: SUIT, price: '3.500', discount_percent: null, min_quantity: 1, max_quantity: null, is_active: true, rec_status: 1 },
  ],
  org_price_lists_mst: [
    { id: 'pl-std', price_list_type: 'standard', priority: 0, effective_from: null, effective_to: null, is_active: true, rec_status: 1 },
    { id: 'pl-vip', price_list_type: 'vip', priority: 0, effective_from: d('2026-01-01'), effective_to: null, is_active: true, rec_status: 1 },
  ],
  org_speed_price_rules_cf: [{
    id: 'rule-1', service_speed: 'EXPRESS', branch_id: null, service_category_code: null, product_id: null,
    speed_price_type: 'MULTIPLIER', default_speed_sell_price: null, multiplier_speed: '0.5', speed_extra_amount: null,
    price_basis: null, turnaround_hh_speed: '6', effective_from: d('2026-01-01'), effective_to: null, is_active: true, rec_status: 1,
  }],
  sys_service_speed_cd: [{ code: 'STANDARD', display_order: 2 }, { code: 'EXPRESS', display_order: 4 }],
  org_tax_profiles_cf: [{
    id: 'vat', name: 'VAT', name2: 'ضريبة', tax_type: 'VAT', rate: '5', is_compound: false,
    rounding_level: 'DOCUMENT', rounding_mode: 'HALF_UP', output_decimal_places: null, rounding_increment_minor: null, ...taxCodeColumns('VAT_STD'),
  }],
  ...activeTaxSetup('VAT_STD'),
  sys_currency_rounding_rules_cf: [{ rounding_mode: 'HALF_UP' }],
  org_service_preference_cf: [{ preference_code: 'STARCH', extra_price: '0.200', extra_turnaround_minutes: 30, branch_id: null }],
  sys_service_preference_cd: [{ code: 'STARCH', default_extra_price: '0.500', extra_turnaround_minutes: 60 }],
  org_packing_preference_cf: [{ packing_pref_code: 'HANGER', extra_price: '0.100' }],
  sys_service_category_cd: [{ service_category_code: 'DRY_CLEAN', turnaround_hh: '48' }],
  org_tax_exemptions_cf: [],
});

const intent = (over: Partial<CommercialOrderIntent> = {}): CommercialOrderIntent => ({
  branchId: BRANCH,
  customerId: CUSTOMER,
  serviceSpeed: 'STANDARD',
  receivedAt: new Date('2026-10-24T06:00:00Z'),
  readyByOverride: null,
  lines: [
    { lineId: 'L1', productId: SHIRT, quantity: 2, serviceSpeed: null, overrideUnitPrice: null, lineDiscounts: [],
      preferences: [{ code: 'STARCH', kind: 'SERVICE' }],
      pieces: [{ pieceId: 'L1-p1', preferences: [{ code: 'HANGER', kind: 'PACKING' }] }, { pieceId: 'L1-p2', preferences: [] }] },
    { lineId: 'L2', productId: SUIT, quantity: 1, serviceSpeed: 'EXPRESS', overrideUnitPrice: null, lineDiscounts: [], preferences: [] },
  ],
  orderPreferences: [{ code: 'STARCH', kind: 'SERVICE' }],
  orderAdjustments: [],
  ...over,
});

const deps = { currency: { code: 'OMR', decimalPlaces: 3 } };

describe('a rule for all products and a retail item', () => {
  const expressLine = (lineId: string, productId: string) => ({
    lineId, productId, quantity: 1, serviceSpeed: 'EXPRESS', overrideUnitPrice: null, lineDiscounts: [], preferences: [],
  });

  it('prices the service line from the rule and leaves the retail line at its normal price', async () => {
    const { db } = mockDb({
      ...baseFixtures(),
      org_product_data_mst: [product(SHIRT), product(SUIT, { default_sell_price: '4.000', is_retail_item: true })],
    });
    const facts = await loadCommercialFacts(db, TENANT, intent({ lines: [expressLine('L1', SHIRT), expressLine('L2', SUIT)], orderPreferences: [] }), deps);
    const { prices, input } = buildCommercialOrderInput(intent({ lines: [expressLine('L1', SHIRT), expressLine('L2', SUIT)], orderPreferences: [] }), facts);
    expect(prices.map((price) => price.speed.ruleId)).toEqual(['rule-1', null]);
    expect(prices[1].speed.unitPremium.toString()).toBe('0');
    expect(input.lines[1].readyBy.speedRuleHours).toBeNull();
  });
});

describe('loadCommercialFacts', () => {
  it('filters every org_* read by tenant_org_id (org_tenants_mst by its own id)', async () => {
    const { db, calls } = mockDb(baseFixtures());
    await loadCommercialFacts(db, TENANT, intent(), deps);
    const orgCalls = calls.filter((c) => c.model.startsWith('org_'));
    expect(orgCalls.length).toBeGreaterThanOrEqual(10);
    for (const call of orgCalls) {
      if (call.model === 'org_tenants_mst') expect(call.args.where).toEqual({ id: TENANT });
      else expect(call.args.where?.tenant_org_id).toBe(TENANT);
    }
  });

  it('reads the customer list type, the business date in the tenant zone and the ACCOUNTING mode', async () => {
    const { db } = mockDb(baseFixtures());
    const facts = await loadCommercialFacts(db, TENANT, intent({ receivedAt: new Date('2026-10-24T21:30:00Z') }), deps);
    expect(facts.customerListType).toBe('vip');
    // 21:30 UTC is 01:30 the next day in Muscat (UTC+4).
    expect(facts.businessDate).toBe('2026-10-25');
    expect(facts.rounding).toEqual({ decimalPlaces: 3, mode: 'HALF_UP' });
    expect(facts.preferences.get('SERVICE:STARCH')).toEqual({ amount: '0.200', extraMinutes: 30 });
  });

  it('P6-03: a tenant with no tax profile has no tax profile and no tax line, never an assumed rate', async () => {
    const fixtures = baseFixtures();
    fixtures.org_tax_profiles_cf = [];
    const { db } = mockDb(fixtures);
    const facts = await loadCommercialFacts(db, TENANT, intent(), deps);
    expect(facts.taxProfiles).toEqual([]);
    expect(facts.taxProfileLabels.has('tenant-vat-rate')).toBe(false);
  });

  it('labels every tax line', async () => {
    const { db } = mockDb(baseFixtures());
    expect((await loadCommercialFacts(db, TENANT, intent(), deps)).taxProfileLabels.get('vat')).toEqual({ label: 'VAT', label2: 'ضريبة' });
  });

  it('a setup that is not confirmed charges no tax and writes no tax record', async () => {
    const fixtures = baseFixtures();
    fixtures.org_tax_config_cf = [{ status: 'PENDING_CONFIRMATION', tax_enabled: false }];
    const facts = await loadCommercialFacts(mockDb(fixtures).db, TENANT, intent(), deps);
    expect(facts.taxEngine).toBeNull();
    expect(facts.taxProfiles).toEqual([]);
    const { input, prices, chargeTaxRecord } = buildCommercialOrderInput(intent(), facts);
    expect(input.lines[0].tax.profiles).toEqual([]);
    expect(prices[0].taxRecord).toBeNull();
    expect(chargeTaxRecord).toBeNull();
  });

  it('a confirmed setup with no rule for the line is refused, never a silent zero', async () => {
    const fixtures = baseFixtures();
    fixtures.org_tax_rules_cf = [];
    const facts = await loadCommercialFacts(mockDb(fixtures).db, TENANT, intent(), deps);
    expect(() => buildCommercialOrderInput(intent(), facts)).toThrow(expect.objectContaining({ code: 'NO_TAX_RULE' }));
  });

  it('refuses to guess a time zone', async () => {
    const fixtures = baseFixtures();
    fixtures.org_tenants_mst = [{ commercial_level: 'ITEM', disc_alloc_mode: 'DOCUMENT_LEVEL', disc_alloc_basis: 'PROPORTIONAL_NET', timezone: null }];
    const { db } = mockDb(fixtures);
    await expect(loadCommercialFacts(db, TENANT, intent(), deps)).rejects.toMatchObject({ code: 'TIMEZONE_NOT_CONFIGURED' });
  });
});

describe('buildCommercialOrderInput → calculateCommercialOrder', () => {
  it('prices from server facts only: standard list with its discount, the VIP list, the express rule, preferences', async () => {
    const { db } = mockDb(baseFixtures());
    const facts = await loadCommercialFacts(db, TENANT, intent(), deps);
    const { input, prices } = buildCommercialOrderInput(intent(), facts);
    // Shirt: no VIP row, so the standard list (2.000, 10% as a PRICE_LIST line discount).
    expect(prices[0].standard).toMatchObject({ source: 'PRICE_LIST', priceListItemId: 'pli-std' });
    // Suit: VIP list 3.500, express ×0.5 = +1.750 per unit.
    expect(prices[1].standard).toMatchObject({ source: 'CUSTOMER_PRICE' });
    expect(prices[1].speed).toMatchObject({ outcome: 'RULE_APPLIED', ruleId: 'rule-1' });

    const result = calculateCommercialOrder(input);
    const [shirt, suit] = result.lines;
    // 2 × 2.000 + starch 0.200 + hanger 0.100 = 4.300; list discount 10% of 4.000 = 0.400.
    expect(shirt.item.money.grossAmount.toString()).toBe('4.3');
    expect(shirt.item.money.lineDiscountAmount.toString()).toBe('0.4');
    expect(suit.item.money.grossAmount.toString()).toBe('5.25');
    expect(suit.item.money.speedPremiumAmount.toString()).toBe('1.75');
    // The order starch is a separate charge, taxed like a standard line (L25): 5% of 0.200.
    expect(result.charges.map((c) => [c.chargeId, c.netAmount.toString(), c.taxAmount.toString()]))
      .toEqual([['order:SERVICE:STARCH', '0.2', '0.01']]);
    // Ready-by: shirt 24 h product + 30 min starch + 30 min order starch; suit express rule 6 h + 30 min.
    expect(shirt.readyBy.readyByAt.toISOString()).toBe('2026-10-25T07:00:00.000Z');
    expect(suit.readyBy).toMatchObject({ hours: 6, source: 'SPEED_RULE' });
  });

  it('rejects a product, speed or preference the tenant does not have', async () => {
    const { db } = mockDb(baseFixtures());
    const facts = await loadCommercialFacts(db, TENANT, intent(), deps);
    const unknown = intent({ lines: [{ ...intent().lines[1], productId: 'aaaaaaaa-0000-0000-0000-00000000ffff' }] });
    expect(() => buildCommercialOrderInput(unknown, facts)).toThrow(CommercialContextError);
    const badSpeed = intent({ lines: [{ ...intent().lines[1], serviceSpeed: 'SAME_DAY' }] });
    expect(() => buildCommercialOrderInput(badSpeed, facts)).toThrow(/not an active speed/);
    const badPref = intent({ orderPreferences: [{ code: 'PERFUME', kind: 'SERVICE' }] });
    expect(() => buildCommercialOrderInput(badPref, facts)).toThrow(/not enabled/);
  });

  it('a customer exemption makes every line EXEMPT with no tax', async () => {
    const fixtures = baseFixtures();
    fixtures.org_tax_exemptions_cf = [{ customer_id: CUSTOMER, service_type: null }];
    const { db } = mockDb(fixtures);
    const facts = await loadCommercialFacts(db, TENANT, intent(), deps);
    const result = calculateCommercialOrder(buildCommercialOrderInput(intent(), facts).input);
    expect(result.lines.map((l) => [l.item.tax.taxCategoryCode, l.item.tax.exemptReason, l.item.money.taxAmount.toString()]))
      .toEqual([['EXEMPT', 'CUSTOMER_EXEMPTION', '0'], ['EXEMPT', 'CUSTOMER_EXEMPTION', '0']]);
    // The exemption covers the order charge too.
    expect(result.charges[0].tax?.taxCategoryCode).toBe('EXEMPT');
    expect(result.totals.taxTotal.isZero()).toBe(true);
  });
});

describe('Service Speeds S3: calendar, offered speeds, ECONOMY discount', () => {
  const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
  const open = { open: '08:00', close: '20:00' };
  // Fri–Sat weekend, as the OM template.
  const hours = { sun: open, mon: open, tue: open, wed: open, thu: open, fri: null, sat: null };
  const rule = (id: string, speed: string, over: Record<string, unknown>) => ({
    id, service_speed: speed, branch_id: null, service_category_code: null, product_id: null,
    speed_price_type: 'MULTIPLIER', default_speed_sell_price: null, multiplier_speed: '0.25', speed_extra_amount: null,
    price_basis: null, turnaround_hh_speed: null, turnaround_unit: null, turnaround_days_speed: null, cutoff_time_speed: null,
    effective_from: d('2026-01-01'), effective_to: null, is_active: true, rec_status: 1, ...over,
  });
  const calendarFixtures = (): Fixtures => ({
    ...baseFixtures(),
    org_tenants_mst: [{
      commercial_level: 'ITEM', disc_alloc_mode: 'ALLOCATE_TO_LINES', disc_alloc_basis: 'PROPORTIONAL_NET',
      timezone: 'Asia/Muscat', country: 'OM', business_hours: hours, order_cutoff_time: time('11:00'), ready_time: time('18:00'),
    }],
    org_branches_mst: [{ timezone_code: null, country: null, business_hours: null, order_cutoff_time: null, ready_time: null }],
    sys_service_speed_cd: [
      { code: 'ECONOMY', display_order: 1 }, { code: 'STANDARD', display_order: 2 }, { code: 'NEXT_DAY', display_order: 3 },
      { code: 'EXPRESS', display_order: 4 }, { code: 'URGENT', display_order: 5 },
    ],
    org_speed_price_rules_cf: [
      rule('nd', 'NEXT_DAY', { turnaround_unit: 'WORKING_DAYS', turnaround_days_speed: 1 }),
      rule('eco', 'ECONOMY', { multiplier_speed: '-0.10', turnaround_unit: 'WORKING_DAYS', turnaround_days_speed: 5 }),
    ],
    // Sunday 2026-10-25 is a (test) public holiday.
    sys_public_holidays_cf: [{ holiday_date: d('2026-10-25') }],
    org_holidays_cf: [],
  });
  const oneLine = (serviceSpeed: string) => intent({
    serviceSpeed, orderPreferences: [],
    lines: [{ lineId: 'L1', productId: SUIT, quantity: 1, serviceSpeed: null, overrideUnitPrice: null, lineDiscounts: [], preferences: [] }],
  });

  it('reads the calendar once, tenant-filtered, holidays from the start date for the window', async () => {
    const { db, calls } = mockDb(calendarFixtures());
    // Thursday 2026-10-22 09:00 Muscat.
    const facts = await loadCommercialFacts(db, TENANT, oneLine('NEXT_DAY'), deps);
    expect(facts.calendar).not.toBeNull();
    const own = calls.filter((c) => c.model === 'org_holidays_cf');
    expect(own).toHaveLength(1);
    expect(own[0].args.where?.tenant_org_id).toBe(TENANT);
    const pub = calls.find((c) => c.model === 'sys_public_holidays_cf');
    expect(pub?.args.where).toMatchObject({ country_code: 'OM' });
  });

  it('NEXT_DAY = 1 working day at the ready time, skipping the weekend and a public holiday', async () => {
    const { db } = mockDb(calendarFixtures());
    const order = oneLine('NEXT_DAY');
    order.receivedAt = new Date('2026-10-22T05:00:00Z'); // Thu 09:00 Muscat, before the 11:00 cut-off
    const facts = await loadCommercialFacts(db, TENANT, order, deps);
    const result = calculateCommercialOrder(buildCommercialOrderInput(order, facts).input);
    // Fri–Sat weekend, Sun 25th holiday → Mon 26th 18:00 Muscat = 14:00 UTC.
    expect(result.lines[0].readyBy.readyByAt.toISOString()).toBe('2026-10-26T14:00:00.000Z');
  });

  it('ECONOMY (ranked below STANDARD) may discount; the premium is negative', async () => {
    const { db } = mockDb(calendarFixtures());
    const facts = await loadCommercialFacts(db, TENANT, oneLine('ECONOMY'), deps);
    const { prices } = buildCommercialOrderInput(oneLine('ECONOMY'), facts);
    // VIP 3.500 × −0.10 = −0.350.
    expect(prices[0].speed.unitPremium.toString()).toBe('-0.35');
    expect(prices[0].speed.warnings).toEqual([]);
  });

  it('a speed with no rule is not offered (SPEED_NOT_OFFERED), EXPRESS included', async () => {
    const { db } = mockDb(calendarFixtures());
    const facts = await loadCommercialFacts(db, TENANT, oneLine('URGENT'), deps);
    expect(() => buildCommercialOrderInput(oneLine('URGENT'), facts)).toThrow(expect.objectContaining({ code: 'SPEED_NOT_OFFERED' }));
    const express = await loadCommercialFacts(mockDb(calendarFixtures()).db, TENANT, oneLine('EXPRESS'), deps);
    expect(() => buildCommercialOrderInput(oneLine('EXPRESS'), express)).toThrow(expect.objectContaining({ code: 'SPEED_NOT_OFFERED' }));
  });
});

describe('customerPriceListType', () => {
  it.each([
    ['b2b', null, 'b2b'],
    ['VIP', {}, 'vip'],
    ['walk_in', { pricing_tier: 'B2B' }, 'b2b'],
    ['vip', { pricing_tier: 'gold' }, 'vip'],
    [null, null, null],
  ])('type %s, preferences %j → %s', (type, prefs, expected) => {
    expect(customerPriceListType(type, prefs)).toBe(expected);
  });
});

describe('quoteCommercialOrder', () => {
  it('gives the resolver the lines net, then applies what it returns', async () => {
    const { db } = mockDb(baseFixtures());
    const resolver = jest.fn(async (ctx: OrderAdjustmentContext) => {
      // A trial manual 10% leaves 8.235 (9.150 − 0.915) for the next discount to see.
      expect(ctx.netAfter([{ id: 'm', source: 'MANUAL', calcType: 'PERCENTAGE', value: '10' }]).toString()).toBe('8.235');
      return [{ id: 'promo', source: 'PROMO_CODE', calcType: 'FIXED_AMOUNT' as const, value: '1' }];
    });
    const quote = await quoteCommercialOrder(db, TENANT, intent(), deps, resolver);
    // Lines net: shirt 4.300 − 0.400 + suit 5.250 = 9.150.
    expect(resolver.mock.calls[0][0].linesNet.toString()).toBe('9.15');
    expect(quote.result.totals.orderDiscountTotal.toString()).toBe('1');
    expect(quote.orderAdjustments).toHaveLength(1);
  });
});
