import 'server-only';

import type { Prisma } from '@prisma/client';

import { SPEED_RULE_LEVELS, resolveSpeedPricing, selectSpeedRule, speedRulesForProduct, type SpeedRuleCandidate, type SpeedRuleLevel } from '@/lib/commercial/speed';
import { PRICE_HISTORY_SPEED_RULE, SERVICE_SPEEDS, type PriceBasis, type SpeedPriceType } from '@/lib/constants/commercial';
import { prisma } from '@/lib/db/prisma';
import type { SpeedRuleBulkInput, SpeedRuleBulkStatusInput, SpeedRuleCreateInput } from '@/lib/validations/speed-rule-schemas';

/**
 * Speed Pricing rules (Line-Level P7-01, PLAN §7, §10.1): CRUD and the
 * "Which rule applies?" resolver over `org_speed_price_rules_cf`. Every query
 * filters `tenant_org_id`; ids from input (product, branch) are checked against
 * the same tenant before they are stored. A rule that priced any order line is
 * never deleted, only deactivated (`RULE_IN_USE`), so history stays explainable.
 * A rule no line used is really deleted: its scope stays in the unique index
 * otherwise, and the same scope could never be created again. Every change writes
 * one `org_price_history_audit` row in the same transaction.
 */

/** A refused request; `status` is the HTTP status the route answers. */
export class SpeedRuleError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'DUPLICATE_SCOPE' | 'RULE_IN_USE' | 'INVALID_REFERENCE', public readonly status: number) {
    super(code);
  }
}

/** One rule as the screen shows it (money as exact decimal strings). */
export interface SpeedRuleView {
  id: string;
  serviceSpeed: string;
  branchId: string | null;
  serviceCategoryCode: string | null;
  productId: string | null;
  productName: string | null;
  productName2: string | null;
  speedPriceType: string;
  defaultSpeedSellPrice: string | null;
  multiplierSpeed: string | null;
  speedExtraAmount: string | null;
  priceBasis: string | null;
  turnaroundHhSpeed: string | null;
  name: string | null;
  name2: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  level: SpeedRuleLevel;
}

type RuleRow = Prisma.org_speed_price_rules_cfGetPayload<object>;

const dateText = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dec = (v: Prisma.Decimal | null) => (v == null ? null : v.toString());

function levelOf(r: { productId: string | null; serviceCategoryCode: string | null; branchId: string | null }): SpeedRuleLevel {
  const branch = r.branchId != null;
  if (r.productId) return branch ? 'PRODUCT_BRANCH' : 'PRODUCT';
  if (r.serviceCategoryCode) return branch ? 'CATEGORY_BRANCH' : 'CATEGORY';
  return branch ? 'TENANT_BRANCH' : 'TENANT';
}

function toCandidate(r: RuleRow): SpeedRuleCandidate {
  return {
    id: r.id,
    serviceSpeed: r.service_speed,
    branchId: r.branch_id,
    serviceCategoryCode: r.service_category_code,
    productId: r.product_id,
    speedPriceType: r.speed_price_type as SpeedPriceType,
    defaultSpeedSellPrice: dec(r.default_speed_sell_price),
    multiplierSpeed: dec(r.multiplier_speed),
    speedExtraAmount: dec(r.speed_extra_amount),
    priceBasis: r.price_basis as PriceBasis | null,
    turnaroundHhSpeed: dec(r.turnaround_hh_speed),
    effectiveFrom: dateText(r.effective_from)!,
    effectiveTo: dateText(r.effective_to),
    isActive: r.is_active && r.rec_status === 1,
  };
}

function toView(r: RuleRow, names: Map<string, { name: string | null; name2: string | null }>): SpeedRuleView {
  const c = toCandidate(r);
  const product = r.product_id ? names.get(r.product_id) : undefined;
  return {
    id: r.id,
    serviceSpeed: c.serviceSpeed,
    branchId: c.branchId,
    serviceCategoryCode: c.serviceCategoryCode,
    productId: c.productId,
    productName: product?.name ?? null,
    productName2: product?.name2 ?? null,
    speedPriceType: r.speed_price_type,
    defaultSpeedSellPrice: dec(r.default_speed_sell_price),
    multiplierSpeed: dec(r.multiplier_speed),
    speedExtraAmount: dec(r.speed_extra_amount),
    priceBasis: r.price_basis,
    turnaroundHhSpeed: dec(r.turnaround_hh_speed),
    name: r.name,
    name2: r.name2,
    effectiveFrom: c.effectiveFrom,
    effectiveTo: c.effectiveTo,
    isActive: c.isActive,
    level: levelOf(c),
  };
}

async function productNames(tenantId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, { name: string | null; name2: string | null }>();
  const rows = await prisma.org_product_data_mst.findMany({
    where: { tenant_org_id: tenantId, id: { in: [...new Set(ids)] } },
    select: { id: true, product_name: true, product_name2: true },
  });
  return new Map(rows.map((p) => [p.id, { name: p.product_name, name2: p.product_name2 }]));
}

/**
 * Lists rules with filters, most specific first, paged on the server.
 * @param tenantId - session tenant
 * @param q - filters and page
 * @example await listSpeedRules(tenantId, { serviceSpeed: 'EXPRESS', page: 1, pageSize: 20 })
 */
export async function listSpeedRules(tenantId: string, q: {
  serviceSpeed?: string; branchId?: string; serviceCategoryCode?: string; productId?: string; active?: 'true' | 'false'; page: number; pageSize: number;
}): Promise<{ rows: SpeedRuleView[]; total: number }> {
  const where: Prisma.org_speed_price_rules_cfWhereInput = {
    tenant_org_id: tenantId,
    rec_status: { in: [1, 2] },
    ...(q.serviceSpeed && { service_speed: q.serviceSpeed }),
    ...(q.branchId && { branch_id: q.branchId }),
    ...(q.serviceCategoryCode && { service_category_code: q.serviceCategoryCode }),
    ...(q.productId && { product_id: q.productId }),
    ...(q.active && { is_active: q.active === 'true' }),
  };
  const [rows, total] = await Promise.all([
    prisma.org_speed_price_rules_cf.findMany({
      where,
      orderBy: [{ service_speed: 'asc' }, { product_id: { sort: 'asc', nulls: 'last' } }, { service_category_code: { sort: 'asc', nulls: 'last' } }, { effective_from: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.org_speed_price_rules_cf.count({ where }),
  ]);
  const names = await productNames(tenantId, rows.flatMap((r) => (r.product_id ? [r.product_id] : [])));
  return { rows: rows.map((r) => toView(r, names)), total };
}

async function findRule(tenantId: string, id: string): Promise<RuleRow> {
  const row = await prisma.org_speed_price_rules_cf.findFirst({ where: { id, tenant_org_id: tenantId, rec_status: { in: [1, 2] } } });
  if (!row) throw new SpeedRuleError('NOT_FOUND', 404);
  return row;
}

/**
 * One rule.
 * @param tenantId - session tenant
 * @param id - rule id
 * @throws SpeedRuleError NOT_FOUND
 */
export async function getSpeedRule(tenantId: string, id: string): Promise<SpeedRuleView> {
  const row = await findRule(tenantId, id);
  return toView(row, await productNames(tenantId, row.product_id ? [row.product_id] : []));
}

/** References must exist in this tenant (or the global catalog). */
async function checkReferences(tenantId: string, input: SpeedRuleCreateInput) {
  const [speed, product, branch, category] = await Promise.all([
    prisma.sys_service_speed_cd.findFirst({ where: { code: input.serviceSpeed, is_active: true, rec_status: 1 }, select: { code: true } }),
    input.productId ? prisma.org_product_data_mst.findFirst({ where: { id: input.productId, tenant_org_id: tenantId }, select: { id: true } }) : Promise.resolve({ id: '' }),
    input.branchId ? prisma.org_branches_mst.findFirst({ where: { id: input.branchId, tenant_org_id: tenantId }, select: { id: true } }) : Promise.resolve({ id: '' }),
    input.serviceCategoryCode ? prisma.sys_service_category_cd.findFirst({ where: { service_category_code: input.serviceCategoryCode }, select: { service_category_code: true } }) : Promise.resolve({ service_category_code: '' }),
  ]);
  if (!speed || !product || !branch || !category) throw new SpeedRuleError('INVALID_REFERENCE', 422);
}

/** Prevented before save (UX rule); `duplicateToError` covers two saves racing past this check. */
async function checkScopeFree(tenantId: string, input: SpeedRuleCreateInput, selfId: string | null) {
  const clash = await prisma.org_speed_price_rules_cf.findFirst({
    where: {
      tenant_org_id: tenantId,
      service_speed: input.serviceSpeed,
      branch_id: input.branchId,
      service_category_code: input.serviceCategoryCode,
      product_id: input.productId,
      effective_from: new Date(`${input.effectiveFrom}T00:00:00Z`),
      ...(selfId ? { NOT: { id: selfId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new SpeedRuleError('DUPLICATE_SCOPE', 409);
}

const prismaCode = (e: unknown) => (e as { code?: string } | null)?.code;

/** The unique scope index refused a save that raced past `checkScopeFree`. */
function duplicateToError(e: unknown): never {
  throw prismaCode(e) === 'P2002' ? new SpeedRuleError('DUPLICATE_SCOPE', 409) : e;
}

/** One column holds the value, whichever the type uses (CHECK `chk_org_spd_price_rules_value_cols`). */
const ruleValue = (r: RuleRow | null) => (r ? r.default_speed_sell_price ?? r.multiplier_speed ?? r.speed_extra_amount : null);

/** The history row of one change; `before` is null on create, `after` is null on delete. */
function auditRow(tenantId: string, userId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', before: RuleRow | null, after: RuleRow | null) {
  const row = (after ?? before)!;
  return {
    tenant_org_id: tenantId,
    entity_type: PRICE_HISTORY_SPEED_RULE,
    entity_id: row.id,
    product_id: row.product_id,
    old_price: ruleValue(before),
    new_price: ruleValue(after),
    change_reason: `${action}: ${before?.speed_price_type ?? '-'} -> ${after?.speed_price_type ?? '-'}`,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    created_by: userId,
    created_info: 'Speed Pricing',
  };
}

function columns(input: SpeedRuleCreateInput) {
  return {
    service_speed: input.serviceSpeed,
    branch_id: input.branchId,
    service_category_code: input.serviceCategoryCode,
    product_id: input.productId,
    speed_price_type: input.speedPriceType,
    default_speed_sell_price: input.defaultSpeedSellPrice ?? null,
    multiplier_speed: input.multiplierSpeed ?? null,
    speed_extra_amount: input.speedExtraAmount ?? null,
    price_basis: input.priceBasis ?? null,
    turnaround_hh_speed: input.turnaroundHhSpeed ?? null,
    name: input.name ?? null,
    name2: input.name2 ?? null,
    effective_from: new Date(`${input.effectiveFrom}T00:00:00Z`),
    effective_to: input.effectiveTo ? new Date(`${input.effectiveTo}T00:00:00Z`) : null,
    is_active: input.isActive ?? true,
  };
}

/**
 * Creates a rule.
 * @param tenantId - session tenant
 * @param userId - actor
 * @param input - validated rule
 * @throws SpeedRuleError INVALID_REFERENCE | DUPLICATE_SCOPE
 */
export async function createSpeedRule(tenantId: string, userId: string, input: SpeedRuleCreateInput): Promise<SpeedRuleView> {
  await checkReferences(tenantId, input);
  await checkScopeFree(tenantId, input, null);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.org_speed_price_rules_cf.create({
      data: { ...columns(input), tenant_org_id: tenantId, created_by: userId },
    });
    await tx.org_price_history_audit.create({ data: auditRow(tenantId, userId, 'CREATE', null, created) });
    return created;
  }).catch(duplicateToError);
  return getSpeedRule(tenantId, row.id);
}

/**
 * Creates one product rule for every active product of a category. A product that
 * already has a rule for this speed, branch and start date keeps it (counted as skipped).
 * @param tenantId - session tenant
 * @param userId - actor
 * @param input - the rule to copy, with the category
 * @returns how many rules were created and how many products were skipped
 * @throws SpeedRuleError INVALID_REFERENCE
 * @example await bulkCreateSpeedRules(tenantId, userId, { ...rule, serviceCategoryCode: 'DRY_CLEAN', productId: null })
 */
export async function bulkCreateSpeedRules(tenantId: string, userId: string, input: SpeedRuleBulkInput): Promise<{ created: number; skipped: number }> {
  await checkReferences(tenantId, input);
  const products = await prisma.org_product_data_mst.findMany({
    where: { tenant_org_id: tenantId, service_category_code: input.serviceCategoryCode, is_active: true, rec_status: 1 },
    select: { id: true },
  });
  const base = columns({ ...input, serviceCategoryCode: null });
  const taken = await prisma.org_speed_price_rules_cf.findMany({
    where: {
      tenant_org_id: tenantId,
      service_speed: input.serviceSpeed,
      branch_id: input.branchId,
      service_category_code: null,
      product_id: { in: products.map((p) => p.id) },
      effective_from: base.effective_from,
    },
    select: { product_id: true },
  });
  const takenIds = new Set(taken.map((r) => r.product_id));
  const data = products.filter((p) => !takenIds.has(p.id)).map((p) => ({ ...base, product_id: p.id, tenant_org_id: tenantId, created_by: userId }));
  if (data.length === 0) return { created: 0, skipped: products.length };
  const created = await prisma.$transaction(async (tx) => {
    const rows = await tx.org_speed_price_rules_cf.createManyAndReturn({ data, skipDuplicates: true });
    await tx.org_price_history_audit.createMany({ data: rows.map((r) => auditRow(tenantId, userId, 'CREATE', null, r)) });
    return rows.length;
  });
  return { created, skipped: products.length - created };
}

/**
 * Retires or restores the product rules of a speed, optionally for one category, so
 * products fall back to a general rule (or come back from it). Rules are deactivated,
 * never deleted, so this can be undone and history stays explainable. Each one writes
 * its history row in the same transaction.
 * @param tenantId - session tenant
 * @param userId - actor
 * @param input - the speed, the category, the new status and `dryRun`
 * @returns the rules that match, the rules changed, and how many active general rules would take over
 * @example await setProductRulesActive(tenantId, userId, { serviceSpeed: 'EXPRESS', serviceCategoryCode: null, isActive: false, dryRun: true })
 */
export async function setProductRulesActive(tenantId: string, userId: string, input: SpeedRuleBulkStatusInput): Promise<{ matched: number; changed: number; generalRules: number }> {
  const { serviceSpeed, serviceCategoryCode, isActive, dryRun } = input;
  // A product rule names its product, not its category, so the category is read from the products.
  const categoryProducts = serviceCategoryCode
    ? await prisma.org_product_data_mst.findMany({ where: { tenant_org_id: tenantId, service_category_code: serviceCategoryCode }, select: { id: true } })
    : null;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const [rows, generalRules] = await Promise.all([
    prisma.org_speed_price_rules_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        service_speed: serviceSpeed,
        rec_status: 1,
        is_active: !isActive,
        product_id: categoryProducts ? { in: categoryProducts.map((p) => p.id) } : { not: null },
      },
    }),
    prisma.org_speed_price_rules_cf.count({
      where: {
        tenant_org_id: tenantId,
        service_speed: serviceSpeed,
        rec_status: 1,
        is_active: true,
        product_id: null,
        effective_from: { lte: today },
        OR: [{ effective_to: null }, { effective_to: { gte: today } }],
        ...(serviceCategoryCode ? { service_category_code: { in: [serviceCategoryCode] } } : { service_category_code: null }),
      },
    }),
  ]);
  if (dryRun || rows.length === 0) return { matched: rows.length, changed: 0, generalRules };

  const ids = rows.map((r) => r.id);
  const changed = await prisma.$transaction(async (tx) => {
    const updated = await tx.org_speed_price_rules_cf.updateMany({
      where: { id: { in: ids }, tenant_org_id: tenantId, is_active: !isActive },
      data: { is_active: isActive, updated_by: userId, updated_at: new Date() },
    });
    await tx.org_price_history_audit.createMany({
      data: rows.map((r) => ({
        ...auditRow(tenantId, userId, 'UPDATE', r, { ...r, is_active: isActive }),
        change_reason: isActive ? 'BULK_RESTORE' : 'BULK_RETIRE',
      })),
    });
    return updated.count;
  });
  return { matched: rows.length, changed, generalRules };
}

/**
 * Replaces a rule's scope, type and values (validated together).
 * @param tenantId - session tenant
 * @param userId - actor
 * @param id - rule id
 * @param input - the rule as it should be
 * @throws SpeedRuleError NOT_FOUND | INVALID_REFERENCE | DUPLICATE_SCOPE
 */
export async function updateSpeedRule(tenantId: string, userId: string, id: string, input: SpeedRuleCreateInput): Promise<SpeedRuleView> {
  const before = await findRule(tenantId, id);
  await checkReferences(tenantId, input);
  await checkScopeFree(tenantId, input, id);
  await prisma.$transaction(async (tx) => {
    await tx.org_speed_price_rules_cf.updateMany({
      where: { id, tenant_org_id: tenantId },
      data: { ...columns(input), updated_by: userId, updated_at: new Date() },
    });
    const after = await tx.org_speed_price_rules_cf.findFirstOrThrow({ where: { id, tenant_org_id: tenantId } });
    await tx.org_price_history_audit.create({ data: auditRow(tenantId, userId, 'UPDATE', before, after) });
  }).catch(duplicateToError);
  return getSpeedRule(tenantId, id);
}

/**
 * Deletes a rule no order line used; a used rule must be deactivated instead.
 * @param tenantId - session tenant
 * @param userId - actor
 * @param id - rule id
 * @throws SpeedRuleError NOT_FOUND | RULE_IN_USE
 */
export async function deleteSpeedRule(tenantId: string, userId: string, id: string): Promise<void> {
  const before = await findRule(tenantId, id);
  const [items, pieces] = await Promise.all([
    prisma.org_order_items_dtl.count({ where: { tenant_org_id: tenantId, speed_rule_id: id } }),
    prisma.org_order_item_pieces_dtl.count({ where: { tenant_org_id: tenantId, speed_rule_id: id } }),
  ]);
  if (items + pieces > 0) throw new SpeedRuleError('RULE_IN_USE', 409);
  await prisma.$transaction(async (tx) => {
    await tx.org_price_history_audit.create({ data: auditRow(tenantId, userId, 'DELETE', before, null) });
    await tx.org_speed_price_rules_cf.deleteMany({ where: { id, tenant_org_id: tenantId } });
  }).catch((e: unknown) => {
    // An order line picked this rule up after the count above (FK ON DELETE RESTRICT).
    throw prismaCode(e) === 'P2003' ? new SpeedRuleError('RULE_IN_USE', 409) : e;
  });
}

/** A product's own Express rule, as the catalog export writes it. */
export interface ProductExpressRule {
  sellPrice: string | null;
  multiplier: string | null;
  turnaroundHours: string | null;
}

/**
 * Each product's own all-branches Express rule in effect today, for the catalog
 * export. shortcut: a FIXED_AMOUNT rule has no export column, so it exports blank;
 * add a column if bulk users ask for it.
 * @param tenantId - session tenant
 * @returns the rule per product id
 */
export async function listProductExpressRules(tenantId: string): Promise<Map<string, ProductExpressRule>> {
  const rows = await prisma.org_speed_price_rules_cf.findMany({
    where: {
      tenant_org_id: tenantId,
      service_speed: SERVICE_SPEEDS.EXPRESS,
      branch_id: null,
      service_category_code: null,
      product_id: { not: null },
      is_active: true,
      rec_status: 1,
    },
  });
  const byProduct = new Map<string, SpeedRuleCandidate[]>();
  for (const row of rows) {
    const list = byProduct.get(row.product_id!) ?? [];
    list.push(toCandidate(row));
    byProduct.set(row.product_id!, list);
  }
  const businessDate = new Date().toISOString().slice(0, 10);
  const result = new Map<string, ProductExpressRule>();
  for (const [productId, rules] of byProduct) {
    const selected = selectSpeedRule({ serviceSpeed: SERVICE_SPEEDS.EXPRESS, productId, serviceCategoryCode: null, branchId: null, businessDate }, rules);
    if (selected) {
      result.set(productId, {
        sellPrice: selected.rule.defaultSpeedSellPrice?.toString() ?? null,
        multiplier: selected.rule.multiplierSpeed?.toString() ?? null,
        turnaroundHours: selected.rule.turnaroundHhSpeed?.toString() ?? null,
      });
    }
  }
  return result;
}

/** The resolver's answer: the winning rule and every rule that matched, most specific first. */
export interface SpeedRuleResolution {
  winner: SpeedRuleView | null;
  matched: SpeedRuleView[];
  /** One unit at this speed from the product's default price; null with no product or no default price. */
  price: { standardUnitPrice: string; unitPrice: string; linePremium: string } | null;
  context: { serviceSpeed: string; productId: string | null; serviceCategoryCode: string | null; branchId: string | null; date: string };
}

/**
 * "Which rule applies?" — the same selection the calculator makes
 * (`selectSpeedRule`), with every matching rule listed so the reason is visible.
 * @param tenantId - session tenant
 * @param q - speed, product (or category), branch, date (default today)
 * @example await resolveSpeedRule(tenantId, { serviceSpeed: 'EXPRESS', productId })
 */
export async function resolveSpeedRule(tenantId: string, q: {
  serviceSpeed: string; productId?: string; serviceCategoryCode?: string; branchId?: string; date?: string;
}): Promise<SpeedRuleResolution> {
  const product = q.productId
    ? await prisma.org_product_data_mst.findFirst({ where: { id: q.productId, tenant_org_id: tenantId }, select: { service_category_code: true, default_sell_price: true, is_retail_item: true } })
    : null;
  if (q.productId && !product) throw new SpeedRuleError('INVALID_REFERENCE', 422);
  const ctx = {
    serviceSpeed: q.serviceSpeed,
    productId: q.productId ?? null,
    serviceCategoryCode: product?.service_category_code ?? q.serviceCategoryCode ?? null,
    branchId: q.branchId ?? null,
    businessDate: q.date ?? new Date().toISOString().slice(0, 10),
  };
  const rows = await prisma.org_speed_price_rules_cf.findMany({
    where: { tenant_org_id: tenantId, service_speed: q.serviceSpeed, rec_status: 1 },
  });
  // The same rules the calculator may use for this product.
  const candidates = [...speedRulesForProduct(rows.map(toCandidate), product?.is_retail_item === true)];
  const winner = selectSpeedRule(ctx, candidates);
  const standard = product?.default_sell_price?.toString() ?? null;
  const priced = standard == null
    ? null
    : resolveSpeedPricing({ ...ctx, standardUnitPrice: standard, referenceUnitPrice: standard, quantity: 1, rules: candidates });
  const names = await productNames(tenantId, rows.flatMap((r) => (r.product_id ? [r.product_id] : [])));
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Every rule that alone would apply, in the calculator's order of preference.
  const matched = candidates
    .filter((c) => selectSpeedRule(ctx, [c]))
    .map((c) => toView(byId.get(c.id)!, names))
    .sort((a, b) => levelRank(a.level) - levelRank(b.level) || b.effectiveFrom.localeCompare(a.effectiveFrom) || a.id.localeCompare(b.id));
  return {
    winner: winner ? toView(byId.get(winner.rule.id)!, names) : null,
    matched,
    price: priced && standard != null
      ? { standardUnitPrice: standard, unitPrice: priced.unitPrice.toString(), linePremium: priced.linePremium.toString() }
      : null,
    context: { serviceSpeed: ctx.serviceSpeed, productId: ctx.productId, serviceCategoryCode: ctx.serviceCategoryCode, branchId: ctx.branchId, date: ctx.businessDate },
  };
}

const levelRank = (l: SpeedRuleLevel) => SPEED_RULE_LEVELS.indexOf(l);
