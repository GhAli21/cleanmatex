/**
 * The tax record (`org_tax_lines_tr`) of sales documents.
 *
 * PROVISIONAL rows follow the order until its tax document is issued; issuing makes
 * them FINAL. After that an Edit posts reversal rows and new FINAL rows, and a refund
 * reverses a share at the original rates. Every row and query is tenant-scoped.
 *
 * The rows always add up to the order's header tax: what a line cannot explain
 * (order charges, the tax effect of an order discount) sits on a row with no line id.
 */
import 'server-only';

import type { Prisma } from '@prisma/client';
import { allocateLargestRemainder } from '@/lib/commercial/allocation';
import { ZERO, sumMoney, toMoney, type Money, type MoneyInput } from '@/lib/commercial/money';
import { MONEY_BASIS, TAX_CATEGORIES } from '@/lib/constants/commercial';
import { DOC_SEQ_TYPES } from '@/lib/constants/doc-seq';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import type { CommercialQuote } from '@/lib/services/commercial/commercial-quote.service';
import type { OrderTaxRecord } from '@/lib/tax/order-line-tax';

type Tx = Prisma.TransactionClient;
type TaxLineRow = Prisma.org_tax_lines_trUncheckedCreateInput;

const STATUS = { PROVISIONAL: 'PROVISIONAL', FINAL: 'FINAL' } as const;
const money = (value: MoneyInput) => toMoney(value).toFixed(4);

/** What the rows of one order share. */
export interface OrderTaxLineContext {
  tenantOrgId: string;
  orderId: string;
  orderNo: string | null;
  branchId: string | null;
  customerId: string | null;
  taxDate: string;
  currencyCode: string;
  baseCurrencyCode: string;
  /** `base = amount × rate`; ignored when the currencies are the same. */
  fxRate: MoneyInput;
  userId: string | null;
  itemIds: ReadonlyMap<string, string>;
  pieceIds: ReadonlyMap<string, string>;
}

const baseFields = (ctx: Pick<OrderTaxLineContext, 'currencyCode' | 'baseCurrencyCode' | 'fxRate' | 'taxDate'>, taxable: Money, tax: Money) => {
  const same = ctx.currencyCode === ctx.baseCurrencyCode;
  const rate = toMoney(ctx.fxRate);
  return {
    currency_code: ctx.currencyCode,
    base_currency_code: ctx.baseCurrencyCode,
    base_taxable_amount: money(same ? taxable : taxable.times(rate)),
    base_tax_amount: money(same ? tax : tax.times(rate)),
    fx_rate: same ? null : rate.toString(),
    fx_rate_date: same ? null : new Date(ctx.taxDate),
    fx_rate_source: same ? null : 'ORDER',
  };
};

/**
 * Builds the PROVISIONAL rows of a calculated order.
 * @param quote - The calculated order and what each line's tax came from
 * @param ctx - Order identity and created row ids
 * @returns Rows ready for `createMany`; empty for an order the rules did not tax
 * @throws Error when a created item or piece id is missing
 */
export function buildOrderTaxLines(quote: Pick<CommercialQuote, 'result' | 'prices' | 'facts' | 'chargeTaxRecord'>, ctx: OrderTaxLineContext): TaxLineRow[] {
  const { result, prices, facts, chargeTaxRecord } = quote;
  const recordOf = new Map(prices.map((p) => [p.lineId, p.taxRecord ?? null] as const));
  if (![...recordOf.values()].some(Boolean) && !chargeTaxRecord) return [];

  const profile = new Map(facts.taxProfiles.map((p) => [p.id, p] as const));
  const rows: TaxLineRow[] = [];
  const add = (a: {
    lineId: string | null; subId: string | null; seq: number; taxCode: string; profileId: string | null; ruleId: string | null;
    category: string; reason: string | null; rate: Money; compound: boolean; taxable: Money; tax: Money;
  }) => rows.push({
    tenant_org_id: ctx.tenantOrgId,
    source_doc_type_code: DOC_SEQ_TYPES.ORDER,
    source_doc_id: ctx.orderId,
    source_doc_no: ctx.orderNo,
    source_doc_line_id: a.lineId,
    source_doc_sub_line_id: a.subId,
    line_status: STATUS.PROVISIONAL,
    tax_date: new Date(ctx.taxDate),
    tax_flow_code: 'OUTPUT',
    branch_id: ctx.branchId,
    party_type: ctx.customerId ? 'CUSTOMER' : null,
    party_id: ctx.customerId,
    tax_code: a.taxCode,
    tax_profile_id: a.profileId,
    tax_rule_id: a.ruleId,
    tax_category_code: a.category,
    exempt_reason_code: a.reason,
    calc_level: a.lineId ? 'LINE' : 'DOCUMENT',
    rate: a.rate.toFixed(2),
    taxable_amount: money(a.taxable),
    tax_amount: money(a.tax),
    ...baseFields(ctx, a.taxable, a.tax),
    compound_base: a.compound,
    applied_seq: a.seq,
    created_by: ctx.userId,
    created_info: 'tax lines',
  });

  const idOf = (map: ReadonlyMap<string, string>, key: string) => {
    const id = map.get(key);
    if (!id) throw new Error(`No created row id for ${key}.`);
    return id;
  };

  // ─── One row per tax on each priced row ────────────────────────────────
  const taxOnLines = new Map<string, { taxable: Money; tax: Money }>();
  for (const line of result.lines) {
    const record = recordOf.get(line.lineId);
    if (!record) continue;
    const lineId = idOf(ctx.itemIds, line.lineId);
    const priced = line.item.moneyBasis === MONEY_BASIS.ROLLUP ? line.pieces : [line.item];
    for (const row of priced) {
      const subId = row === line.item ? null : idOf(ctx.pieceIds, row.rowId);
      if (row.tax.taxCategoryCode !== TAX_CATEGORIES.STANDARD) {
        if (!record.zeroCode) continue;
        add({
          lineId, subId, seq: 1, taxCode: record.zeroCode.taxCode, profileId: record.zeroCode.profileId, ruleId: record.ruleId,
          category: row.tax.taxCategoryCode, reason: row.tax.exemptReason, rate: ZERO, compound: false, taxable: row.money.taxableAmount, tax: ZERO,
        });
        continue;
      }
      let prior = ZERO;
      row.tax.profileTaxes.forEach((taxed, i) => {
        const code = profile.get(taxed.profileId);
        if (!code?.taxCode) return;
        const taxable = code.isCompound ? row.money.taxableAmount.plus(prior) : row.money.taxableAmount;
        add({
          lineId, subId, seq: i + 1, taxCode: code.taxCode, profileId: code.id, ruleId: record.ruleId,
          category: TAX_CATEGORIES.STANDARD, reason: null, rate: toMoney(code.ratePercent), compound: code.isCompound, taxable, tax: taxed.amount,
        });
        prior = prior.plus(taxed.amount);
        const sum = taxOnLines.get(code.id) ?? { taxable: ZERO, tax: ZERO };
        taxOnLines.set(code.id, { taxable: sum.taxable.plus(taxable), tax: sum.tax.plus(taxed.amount) });
      });
    }
  }

  // ─── Rows with no line: charges and the effect of an order discount ────
  let docSeq = 0;
  for (const header of result.taxLines) {
    const code = profile.get(header.profileId);
    if (!code?.taxCode) continue;
    const onLines = taxOnLines.get(code.id) ?? { taxable: ZERO, tax: ZERO };
    const taxable = header.taxableAmount.minus(onLines.taxable);
    const tax = header.taxAmount.minus(onLines.tax);
    if (taxable.isZero() && tax.isZero()) continue;
    docSeq += 1;
    add({
      lineId: null, subId: null, seq: docSeq, taxCode: code.taxCode, profileId: code.id, ruleId: null,
      category: TAX_CATEGORIES.STANDARD, reason: null, rate: header.ratePercent, compound: code.isCompound, taxable, tax,
    });
  }

  const zeroGroups = new Map<string, { record: OrderTaxRecord; category: string; reason: string | null; taxable: Money }>();
  const addZero = (record: OrderTaxRecord | null | undefined, category: string, reason: string | null, taxable: Money) => {
    if (!record?.zeroCode) return;
    const prior = zeroGroups.get(record.zeroCode.profileId);
    zeroGroups.set(record.zeroCode.profileId, { record, category, reason, taxable: (prior?.taxable ?? ZERO).plus(taxable) });
  };
  for (const charge of result.charges) {
    if (!charge.tax || charge.tax.taxCategoryCode === TAX_CATEGORIES.STANDARD) continue;
    addZero(charge.sourceLineId ? recordOf.get(charge.sourceLineId) : chargeTaxRecord, charge.tax.taxCategoryCode, charge.tax.exemptReason, charge.taxableAmount);
  }
  for (const [category, share] of result.document.categoryShares) {
    if (category === TAX_CATEGORIES.STANDARD || share.isZero()) continue;
    const line = result.lines.find((l) => l.item.tax.taxCategoryCode === category);
    if (line) addZero(recordOf.get(line.lineId), category, line.item.tax.exemptReason, share.negated());
  }
  for (const group of zeroGroups.values()) {
    if (group.taxable.isZero()) continue;
    docSeq += 1;
    add({
      lineId: null, subId: null, seq: docSeq, taxCode: group.record.zeroCode!.taxCode, profileId: group.record.zeroCode!.profileId, ruleId: group.record.ruleId,
      category: group.category, reason: group.reason, rate: ZERO, compound: false, taxable: group.taxable, tax: ZERO,
    });
  }
  return rows;
}

/** The return period holding a date; a closed one is refused by `fn_otl_guard`. */
export async function periodIdFor(tx: Tx, tenantOrgId: string, taxDate: string): Promise<string | null> {
  const date = new Date(taxDate);
  const period = await tx.org_tax_periods_mst.findFirst({
    where: { tenant_org_id: tenantOrgId, period_start: { lte: date }, period_end: { gte: date }, is_active: true, rec_status: 1 },
    select: { id: true },
  });
  return period?.id ?? null;
}

/** The final lines of a document, each with what is left after earlier reversals. */
async function remainingFinalLines(tx: Tx, tenantOrgId: string, orderId: string) {
  const finals = await tx.org_tax_lines_tr.findMany({
    where: {
      tenant_org_id: tenantOrgId, source_doc_type_code: DOC_SEQ_TYPES.ORDER, source_doc_id: orderId,
      line_status: STATUS.FINAL, reverses_tax_line_id: null, is_active: true, rec_status: 1,
    },
    orderBy: [{ created_at: 'asc' }, { applied_seq: 'asc' }],
  });
  if (finals.length === 0) return [];
  const reversals = await tx.org_tax_lines_tr.findMany({
    where: { tenant_org_id: tenantOrgId, reverses_tax_line_id: { in: finals.map((f) => f.id) }, is_active: true, rec_status: 1 },
    select: { reverses_tax_line_id: true, taxable_amount: true, tax_amount: true },
  });
  return finals.map((line) => {
    const own = reversals.filter((r) => r.reverses_tax_line_id === line.id);
    return {
      line,
      taxable: toMoney(line.taxable_amount.toString()).plus(sumMoney(own.map((r) => r.taxable_amount.toString()))),
      tax: toMoney(line.tax_amount.toString()).plus(sumMoney(own.map((r) => r.tax_amount.toString()))),
    };
  }).filter((r) => !r.taxable.isZero() || !r.tax.isZero());
}

type FinalRemaining = Awaited<ReturnType<typeof remainingFinalLines>>[number];

const reversalOf = (
  { line }: FinalRemaining,
  amounts: { taxable: Money; tax: Money },
  doc: { typeCode: string; id: string; no: string | null; taxDate: string; at: Date; periodId: string | null; userId: string | null },
): TaxLineRow => ({
  tenant_org_id: line.tenant_org_id,
  source_doc_type_code: doc.typeCode,
  source_doc_id: doc.id,
  source_doc_no: doc.no,
  source_doc_line_id: line.source_doc_line_id,
  source_doc_sub_line_id: line.source_doc_sub_line_id,
  line_status: STATUS.FINAL,
  tax_point_at: doc.at,
  tax_date: new Date(doc.taxDate),
  tax_flow_code: line.tax_flow_code,
  branch_id: line.branch_id,
  party_type: line.party_type,
  party_id: line.party_id,
  tax_code: line.tax_code,
  tax_profile_id: line.tax_profile_id,
  tax_rule_id: line.tax_rule_id,
  tax_category_code: line.tax_category_code,
  exempt_reason_code: line.exempt_reason_code,
  calc_level: line.calc_level,
  rate: line.rate,
  fixed_amount: line.fixed_amount,
  taxable_amount: money(amounts.taxable.negated()),
  tax_amount: money(amounts.tax.negated()),
  ...baseFields({
    currencyCode: line.currency_code,
    baseCurrencyCode: line.base_currency_code,
    fxRate: line.fx_rate?.toString() ?? 1,
    taxDate: doc.taxDate,
  }, amounts.taxable.negated(), amounts.tax.negated()),
  compound_base: line.compound_base,
  applied_seq: line.applied_seq,
  reverses_tax_line_id: line.id,
  report_box_code: line.report_box_code,
  period_id: doc.periodId,
  created_by: doc.userId,
  created_info: 'tax lines reversal',
});

/**
 * Writes an order's tax record in the order's transaction, replacing its provisional rows.
 * If the order was already finalized, the final rows are reversed and the new rows are final.
 * @param tx - The order's transaction
 * @param input - Tenant, order, actor, the calculated order and the created row ids
 * @returns Nothing; an order the rules did not tax is left untouched
 */
export async function writeOrderTaxLines(tx: Tx, input: {
  tenantOrgId: string;
  orderId: string;
  userId: string | null;
  at: Date;
  quote: Pick<CommercialQuote, 'result' | 'prices' | 'facts' | 'chargeTaxRecord'>;
  itemIds: ReadonlyMap<string, string>;
  pieceIds: ReadonlyMap<string, string>;
}): Promise<void> {
  const { tenantOrgId, orderId, userId, at, quote } = input;
  if (!quote.prices.some((p) => p.taxRecord) && !quote.chargeTaxRecord) return;

  const order = await tx.org_orders_mst.findFirst({
    where: { id: orderId, tenant_org_id: tenantOrgId },
    select: { order_no: true, branch_id: true, customer_id: true, currency_code: true, base_cur_currency_code: true, currency_ex_rate: true },
  });
  if (!order?.currency_code) throw new Error(`Order ${orderId} has no currency for its tax lines.`);

  const taxDate = quote.facts.businessDate;
  const rows = buildOrderTaxLines(quote, {
    tenantOrgId, orderId, orderNo: order.order_no, branchId: order.branch_id, customerId: order.customer_id, taxDate,
    currencyCode: order.currency_code, baseCurrencyCode: order.base_cur_currency_code ?? order.currency_code,
    fxRate: order.currency_ex_rate?.toString() ?? 1, userId, itemIds: input.itemIds, pieceIds: input.pieceIds,
  });

  await tx.org_tax_lines_tr.deleteMany({
    where: { tenant_org_id: tenantOrgId, source_doc_type_code: DOC_SEQ_TYPES.ORDER, source_doc_id: orderId, line_status: STATUS.PROVISIONAL },
  });
  const finals = await remainingFinalLines(tx, tenantOrgId, orderId);
  if (finals.length === 0) {
    if (rows.length > 0) await tx.org_tax_lines_tr.createMany({ data: rows });
    return;
  }

  const periodId = await periodIdFor(tx, tenantOrgId, taxDate);
  const doc = { typeCode: DOC_SEQ_TYPES.ORDER, id: orderId, no: order.order_no, taxDate, at, periodId, userId };
  await tx.org_tax_lines_tr.createMany({
    data: [
      ...finals.map((f) => reversalOf(f, f, doc)),
      ...rows.map((r) => ({ ...r, line_status: STATUS.FINAL, tax_point_at: at, period_id: periodId })),
    ],
  });
}

/**
 * The tax point has passed (invoice issued): the order's provisional rows become final.
 * @param tx - The issuing transaction
 * @param input - Tenant, order, actor and the moment of issue
 * @returns Nothing; an order with no provisional rows is left untouched
 */
export async function finalizeOrderTaxLines(tx: Tx, input: { tenantOrgId: string; orderId: string; userId: string; at: Date }): Promise<void> {
  const { tenantOrgId, orderId, userId, at } = input;
  const scope = { tenant_org_id: tenantOrgId, source_doc_type_code: DOC_SEQ_TYPES.ORDER, source_doc_id: orderId, line_status: STATUS.PROVISIONAL };
  if ((await tx.org_tax_lines_tr.count({ where: scope })) === 0) return;

  const order = await tx.org_orders_mst.findFirst({ where: { id: orderId, tenant_org_id: tenantOrgId }, select: { branch_id: true } });
  const [branch, tenant] = await Promise.all([
    order?.branch_id
      ? tx.org_branches_mst.findFirst({ where: { id: order.branch_id, tenant_org_id: tenantOrgId }, select: { timezone_code: true } })
      : null,
    tx.org_tenants_mst.findFirst({ where: { id: tenantOrgId }, select: { timezone: true } }),
  ]);
  const timezone = [branch?.timezone_code, tenant?.timezone].find((tz) => isValidTimeZone(tz));
  const taxDate = timezone ? businessDateForTimezone(timezone, at) : at.toISOString().slice(0, 10);
  const periodId = await periodIdFor(tx, tenantOrgId, taxDate);

  await tx.org_tax_lines_tr.updateMany({
    where: scope,
    data: { line_status: STATUS.FINAL, tax_point_at: at, tax_date: new Date(taxDate), period_id: periodId, updated_by: userId, updated_info: 'tax lines final' },
  });
}

/**
 * A refund's credit note: reverses a share of the order's final rows at their original rates.
 * @param tx - The issuing transaction
 * @param input - Tenant, order, the credit note, its tax amount and the share of the order it covers (0–1)
 * @returns Nothing; an order with no final rows is left untouched
 */
export async function reverseOrderTaxLines(tx: Tx, input: {
  tenantOrgId: string;
  orderId: string;
  creditNote: { id: string; no: string | null };
  taxAmount: MoneyInput;
  portion: MoneyInput;
  userId: string;
  at: Date;
}): Promise<void> {
  const { tenantOrgId, orderId, creditNote, taxAmount, userId, at } = input;
  const finals = await remainingFinalLines(tx, tenantOrgId, orderId);
  if (finals.length === 0) return;

  const portion = toMoney(input.portion);
  const taxed = finals.map((f) => f.tax);
  const total = toMoney(taxAmount);
  // The rows add up exactly to the credit note's tax, split by what each still holds.
  const shares = total.isZero() || sumMoney(taxed).isZero() ? finals.map(() => ZERO) : allocateLargestRemainder(total, taxed, 4);
  const taxDate = at.toISOString().slice(0, 10);
  const periodId = await periodIdFor(tx, tenantOrgId, taxDate);
  const doc = { typeCode: DOC_SEQ_TYPES.TAX_CREDIT_NOTE, id: creditNote.id, no: creditNote.no, taxDate, at, periodId, userId };
  await tx.org_tax_lines_tr.createMany({
    data: finals.map((f, i) => reversalOf(f, { taxable: f.taxable.times(portion), tax: shares[i] }, doc)),
  });
}
