/** @jest-environment node */

/**
 * Line-Level P7-01: Speed Pricing rules. Every query carries the tenant, every
 * change writes its history row, a used rule cannot be deleted, and the resolver
 * picks the same rule the calculator would.
 */
jest.mock('server-only', () => ({}));

const rules = {
  count: jest.fn(),
  findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createManyAndReturn: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
};
const audit = { create: jest.fn(), createMany: jest.fn() };
const items = { count: jest.fn() };
const pieces = { count: jest.fn() };
const products = { findFirst: jest.fn(), findMany: jest.fn() };

jest.mock('@/lib/db/prisma', () => {
  const tx = {
    get org_speed_price_rules_cf() { return rules; },
    get org_price_history_audit() { return audit; },
  };
  return {
    prisma: {
      get org_speed_price_rules_cf() { return rules; },
      get org_order_items_dtl() { return items; },
      get org_order_item_pieces_dtl() { return pieces; },
      get org_product_data_mst() { return products; },
      sys_service_speed_cd: {
        findMany: async ({ where }: { where: { code: { in: string[] } } }) => [['ECONOMY', 1], ['STANDARD', 2], ['EXPRESS', 4], ['URGENT', 5]]
          .filter(([code]) => where.code.in.includes(code as string)).map(([code, display_order]) => ({ code, display_order })),
      },
      org_branches_mst: { findFirst: async () => ({ id: 'b1' }) },
      sys_service_category_cd: { findFirst: async () => ({ service_category_code: 'DRY' }) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});

import {
  SpeedRuleError,
  bulkCreateSpeedRules,
  createSpeedRule,
  deleteSpeedRule,
  resolveSpeedRule,
  setProductRulesActive,
  updateSpeedRule,
} from '@/lib/services/catalog/speed-rules.service';
import { speedRuleBulkSchema, speedRuleCreateSchema } from '@/lib/validations/speed-rule-schemas';

const TENANT = 'tenant-1';
const USER = 'user-1';
const PRODUCT = '11111111-1111-4111-8111-111111111111';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  service_speed: 'EXPRESS',
  branch_id: null,
  service_category_code: null,
  product_id: null,
  speed_price_type: 'MULTIPLIER',
  default_speed_sell_price: null,
  multiplier_speed: { toString: () => '0.3' },
  speed_extra_amount: null,
  price_basis: null,
  turnaround_hh_speed: null,
  name: null,
  name2: null,
  effective_from: new Date('2026-01-01T00:00:00Z'),
  effective_to: null,
  is_active: true,
  rec_status: 1,
  ...over,
});

const input = {
  serviceSpeed: 'EXPRESS',
  branchId: null,
  serviceCategoryCode: null,
  productId: null,
  speedPriceType: 'MULTIPLIER',
  multiplierSpeed: '0.3',
  effectiveFrom: '2026-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  rules.findFirst.mockResolvedValue(null);
  products.findMany.mockResolvedValue([]);
  items.count.mockResolvedValue(0);
  pieces.count.mockResolvedValue(0);
});

describe('speedRuleCreateSchema', () => {
  it('needs the value column of the type and refuses the others', () => {
    expect(speedRuleCreateSchema.safeParse(input).success).toBe(true);
    expect(speedRuleCreateSchema.safeParse({ ...input, multiplierSpeed: null }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, speedExtraAmount: '1' }).success).toBe(false);
  });

  it('refuses a STANDARD rule, price basis off a fixed amount, and an end before the start', () => {
    expect(speedRuleCreateSchema.safeParse({ ...input, serviceSpeed: 'STANDARD' }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, priceBasis: 'PER_LINE' }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, effectiveTo: '2025-12-31' }).success).toBe(false);
  });

  it('bulk needs a category', () => {
    expect(speedRuleBulkSchema.safeParse(input).success).toBe(false);
    expect(speedRuleBulkSchema.safeParse({ ...input, serviceCategoryCode: 'DRY' }).success).toBe(true);
  });
});

describe('Service Speeds: turnaround unit and discounts', () => {
  it('unit and value go together; hours alone read as HOURS', () => {
    expect(speedRuleCreateSchema.safeParse({ ...input, turnaroundHhSpeed: '6' }).success).toBe(true);
    expect(speedRuleCreateSchema.safeParse({ ...input, turnaroundUnit: 'WORKING_DAYS', turnaroundDaysSpeed: 1 }).success).toBe(true);
    expect(speedRuleCreateSchema.safeParse({ ...input, turnaroundUnit: 'WORKING_DAYS', turnaroundHhSpeed: '6' }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, turnaroundUnit: 'HOURS', turnaroundDaysSpeed: 1 }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, turnaroundDaysSpeed: 1 }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, cutoffTimeSpeed: '25:00' }).success).toBe(false);
    expect(speedRuleCreateSchema.safeParse({ ...input, multiplierSpeed: '-1' }).success).toBe(false);
  });

  it('stores the working-days turnaround and the speed cut-off', async () => {
    rules.create.mockResolvedValue(row());
    rules.findFirst.mockResolvedValueOnce(null).mockResolvedValue(row());
    await createSpeedRule(TENANT, USER, speedRuleCreateSchema.parse({ ...input, turnaroundUnit: 'WORKING_DAYS', turnaroundDaysSpeed: 0, cutoffTimeSpeed: '10:00' }));
    expect(rules.create.mock.calls[0][0].data).toMatchObject({
      turnaround_unit: 'WORKING_DAYS', turnaround_days_speed: 0, turnaround_hh_speed: null,
      cutoff_time_speed: new Date('1970-01-01T10:00:00.000Z'),
    });
  });

  it('only a speed ranked below STANDARD (ECONOMY) may lower the price', async () => {
    const discount = speedRuleCreateSchema.parse({ ...input, multiplierSpeed: '-0.1' });
    await expect(createSpeedRule(TENANT, USER, discount)).rejects.toMatchObject({ code: 'DISCOUNT_NOT_ALLOWED', status: 422 });
    expect(rules.create).not.toHaveBeenCalled();

    rules.create.mockResolvedValue(row({ service_speed: 'ECONOMY' }));
    rules.findFirst.mockResolvedValueOnce(null).mockResolvedValue(row({ service_speed: 'ECONOMY' }));
    await createSpeedRule(TENANT, USER, { ...discount, serviceSpeed: 'ECONOMY' });
    expect(rules.create).toHaveBeenCalledTimes(1);
  });

  it('a product sell price below the product price is a discount', async () => {
    products.findFirst.mockResolvedValue({ id: PRODUCT, default_sell_price: { toString: () => '2' } });
    const below = speedRuleCreateSchema.parse({ ...input, productId: PRODUCT, speedPriceType: 'SELL_PRICE', multiplierSpeed: null, defaultSpeedSellPrice: '1.5' });
    await expect(createSpeedRule(TENANT, USER, below)).rejects.toMatchObject({ code: 'DISCOUNT_NOT_ALLOWED' });
  });
});

describe('createSpeedRule', () => {
  it('stores the tenant and writes the history row', async () => {
    rules.create.mockResolvedValue(row());
    rules.findFirst.mockResolvedValueOnce(null).mockResolvedValue(row());

    await createSpeedRule(TENANT, USER, speedRuleCreateSchema.parse(input));

    expect(rules.create.mock.calls[0][0].data.tenant_org_id).toBe(TENANT);
    expect(audit.create.mock.calls[0][0].data).toMatchObject({
      tenant_org_id: TENANT,
      entity_type: 'speed_rule',
      entity_id: 'r1',
      old_price: null,
      change_reason: 'CREATE: - -> MULTIPLIER',
      created_by: USER,
    });
  });

  it('refuses a taken scope before saving', async () => {
    rules.findFirst.mockResolvedValue({ id: 'other' });
    await expect(createSpeedRule(TENANT, USER, speedRuleCreateSchema.parse(input))).rejects.toMatchObject({ code: 'DUPLICATE_SCOPE', status: 409 });
    expect(rules.create).not.toHaveBeenCalled();
    expect(rules.findFirst.mock.calls[0][0].where.tenant_org_id).toBe(TENANT);
  });

  it('turns a save that raced past the check into DUPLICATE_SCOPE', async () => {
    rules.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(createSpeedRule(TENANT, USER, speedRuleCreateSchema.parse(input))).rejects.toBeInstanceOf(SpeedRuleError);
  });

  it('refuses a product of another organization', async () => {
    products.findFirst.mockResolvedValue(null);
    await expect(createSpeedRule(TENANT, USER, speedRuleCreateSchema.parse({ ...input, productId: PRODUCT }))).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    expect(products.findFirst.mock.calls[0][0].where).toMatchObject({ id: PRODUCT, tenant_org_id: TENANT });
  });
});

describe('updateSpeedRule', () => {
  it('filters the tenant and records the old and new value', async () => {
    const after = row({ speed_price_type: 'FIXED_AMOUNT', multiplier_speed: null, speed_extra_amount: { toString: () => '1.5' }, price_basis: 'PER_UNIT' });
    rules.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(null).mockResolvedValue(after);
    rules.findFirstOrThrow.mockResolvedValue(after);

    await updateSpeedRule(TENANT, USER, 'r1', speedRuleCreateSchema.parse({
      ...input, speedPriceType: 'FIXED_AMOUNT', multiplierSpeed: null, speedExtraAmount: '1.5', priceBasis: 'PER_UNIT',
    }));

    expect(rules.updateMany.mock.calls[0][0].where).toEqual({ id: 'r1', tenant_org_id: TENANT });
    const entry = audit.create.mock.calls[0][0].data;
    expect(entry.change_reason).toBe('UPDATE: MULTIPLIER -> FIXED_AMOUNT');
    expect(String(entry.old_price)).toBe('0.3');
    expect(String(entry.new_price)).toBe('1.5');
  });
});

describe('deleteSpeedRule', () => {
  it('answers RULE_IN_USE when an order line used the rule, and deletes nothing', async () => {
    rules.findFirst.mockResolvedValue(row());
    pieces.count.mockResolvedValue(1);
    await expect(deleteSpeedRule(TENANT, USER, 'r1')).rejects.toMatchObject({ code: 'RULE_IN_USE', status: 409 });
    expect(rules.deleteMany).not.toHaveBeenCalled();
    expect(items.count.mock.calls[0][0].where).toEqual({ tenant_org_id: TENANT, speed_rule_id: 'r1' });
  });

  it('deletes an unused rule and keeps its history', async () => {
    rules.findFirst.mockResolvedValue(row());
    await deleteSpeedRule(TENANT, USER, 'r1');
    expect(rules.deleteMany.mock.calls[0][0].where).toEqual({ id: 'r1', tenant_org_id: TENANT });
    expect(audit.create.mock.calls[0][0].data).toMatchObject({ change_reason: 'DELETE: MULTIPLIER -> -', new_price: null });
  });

  it('answers NOT_FOUND for a rule of another organization', async () => {
    rules.findFirst.mockResolvedValue(null);
    await expect(deleteSpeedRule(TENANT, USER, 'r1')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('bulkCreateSpeedRules', () => {
  const bulk = speedRuleBulkSchema.parse({ ...input, serviceCategoryCode: 'DRY' });

  it('creates product rules for the free products and counts the rest as skipped', async () => {
    products.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    rules.findMany.mockResolvedValue([{ product_id: 'p1' }]);
    rules.createManyAndReturn.mockResolvedValue([row({ id: 'r2', product_id: 'p2' })]);

    await expect(bulkCreateSpeedRules(TENANT, USER, bulk)).resolves.toEqual({ created: 1, skipped: 1 });

    const { data } = rules.createManyAndReturn.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ tenant_org_id: TENANT, product_id: 'p2', service_category_code: null });
    expect(products.findMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT, service_category_code: 'DRY' });
    expect(audit.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it('writes nothing when every product already has a rule', async () => {
    products.findMany.mockResolvedValue([{ id: 'p1' }]);
    rules.findMany.mockResolvedValue([{ product_id: 'p1' }]);
    await expect(bulkCreateSpeedRules(TENANT, USER, bulk)).resolves.toEqual({ created: 0, skipped: 1 });
    expect(rules.createManyAndReturn).not.toHaveBeenCalled();
  });
});

describe('resolveSpeedRule', () => {
  it('names the most specific rule the winner and lists the others', async () => {
    products.findFirst.mockResolvedValue({ service_category_code: 'DRY' });
    products.findMany.mockResolvedValue([{ id: PRODUCT, product_name: 'Shirt', product_name2: null }]);
    rules.findMany.mockResolvedValue([
      row({ id: 'tenant-rule' }),
      row({ id: 'category-rule', service_category_code: 'DRY' }),
      row({ id: 'product-rule', product_id: PRODUCT }),
      row({ id: 'other-category', service_category_code: 'WASH' }),
    ]);

    const result = await resolveSpeedRule(TENANT, { serviceSpeed: 'EXPRESS', productId: PRODUCT, date: '2026-06-01' });

    expect(rules.findMany.mock.calls[0][0].where.tenant_org_id).toBe(TENANT);
    expect(result.winner?.id).toBe('product-rule');
    expect(result.matched.map((r) => r.id)).toEqual(['product-rule', 'category-rule', 'tenant-rule']);
  });

  it('prices one unit of the product at this speed from its default price', async () => {
    products.findFirst.mockResolvedValue({ service_category_code: 'DRY', default_sell_price: { toString: () => '10' } });
    rules.findMany.mockResolvedValue([row({ id: 'product-rule', product_id: PRODUCT })]);

    const result = await resolveSpeedRule(TENANT, { serviceSpeed: 'EXPRESS', productId: PRODUCT, date: '2026-06-01' });

    expect(products.findFirst.mock.calls[0][0].where).toMatchObject({ id: PRODUCT, tenant_org_id: TENANT });
    expect(result.price).toEqual({ standardUnitPrice: '10', unitPrice: '13', linePremium: '0' });
  });

  it('has no price without a product', async () => {
    rules.findMany.mockResolvedValue([row({ id: 'tenant-rule' })]);
    const result = await resolveSpeedRule(TENANT, { serviceSpeed: 'EXPRESS', date: '2026-06-01' });
    expect(result.price).toBeNull();
  });

  it('has no winner when no rule matches', async () => {
    rules.findMany.mockResolvedValue([row({ effective_from: new Date('2027-01-01T00:00:00Z') })]);
    const result = await resolveSpeedRule(TENANT, { serviceSpeed: 'EXPRESS', date: '2026-06-01' });
    expect(result.winner).toBeNull();
    expect(result.matched).toEqual([]);
  });
});

describe('retail items and general rules', () => {
  it('leaves out a rule for all products, and keeps one naming its category or product', async () => {
    products.findFirst.mockResolvedValue({ service_category_code: 'RETAIL_ITEMS', default_sell_price: { toString: () => '10' }, is_retail_item: true });
    rules.findMany.mockResolvedValue([row({ id: 'all-products' })]);
    const none = await resolveSpeedRule(TENANT, { serviceSpeed: 'EXPRESS', productId: PRODUCT, date: '2026-06-01' });
    expect(none.winner).toBeNull();
    expect(none.price?.unitPrice).toBe('10');

    rules.findMany.mockResolvedValue([row({ id: 'all-products' }), row({ id: 'own', product_id: PRODUCT })]);
    const own = await resolveSpeedRule(TENANT, { serviceSpeed: 'EXPRESS', productId: PRODUCT, date: '2026-06-01' });
    expect(own.winner?.id).toBe('own');
    expect(own.matched.map((r) => r.id)).toEqual(['own']);
  });
});

describe('setProductRulesActive', () => {
  const retire = { serviceSpeed: 'EXPRESS', serviceCategoryCode: null, isActive: false, dryRun: false };

  beforeEach(() => {
    rules.findMany.mockReset();
    rules.count.mockReset();
    rules.updateMany.mockReset();
    audit.createMany.mockReset();
    products.findMany.mockReset();
    rules.count.mockResolvedValue(1);
    rules.findMany.mockResolvedValue([row({ id: 'a', product_id: PRODUCT }), row({ id: 'b', product_id: PRODUCT })]);
    rules.updateMany.mockResolvedValue({ count: 2 });
  });

  it('only counts on a dry run', async () => {
    const result = await setProductRulesActive(TENANT, USER, { ...retire, dryRun: true });
    expect(result).toEqual({ matched: 2, changed: 0, generalRules: 1 });
    expect(rules.updateMany).not.toHaveBeenCalled();
    expect(audit.createMany).not.toHaveBeenCalled();
  });

  it('deactivates product rules of this tenant, with one history row each, and deletes nothing', async () => {
    const result = await setProductRulesActive(TENANT, USER, retire);
    expect(result.changed).toBe(2);
    expect(rules.findMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT, service_speed: 'EXPRESS', is_active: true, product_id: { not: null } });
    expect(rules.updateMany.mock.calls[0][0]).toMatchObject({ where: { tenant_org_id: TENANT, id: { in: ['a', 'b'] } }, data: { is_active: false, updated_by: USER } });
    expect(audit.createMany.mock.calls[0][0].data.map((d: { entity_id: string; change_reason: string; tenant_org_id: string }) => [d.entity_id, d.change_reason, d.tenant_org_id]))
      .toEqual([['a', 'BULK_RETIRE', TENANT], ['b', 'BULK_RETIRE', TENANT]]);
    expect(rules.deleteMany).not.toHaveBeenCalled();
  });

  it('finds a category through its products, because a product rule does not name its category', async () => {
    products.findMany.mockResolvedValue([{ id: PRODUCT }]);
    await setProductRulesActive(TENANT, USER, { ...retire, serviceCategoryCode: 'DRY', dryRun: true });
    expect(products.findMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT, service_category_code: 'DRY' });
    expect(rules.findMany.mock.calls[0][0].where.product_id).toEqual({ in: [PRODUCT] });
    expect(rules.count.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT, product_id: null, is_active: true });
  });

  it('restores retired rules', async () => {
    await setProductRulesActive(TENANT, USER, { ...retire, isActive: true });
    expect(rules.findMany.mock.calls[0][0].where.is_active).toBe(false);
    expect(rules.updateMany.mock.calls[0][0].data.is_active).toBe(true);
    expect(audit.createMany.mock.calls[0][0].data[0].change_reason).toBe('BULK_RESTORE');
  });
});
