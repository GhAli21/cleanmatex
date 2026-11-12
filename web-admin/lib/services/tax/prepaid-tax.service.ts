/**
 * Tax of prepayments (T6): money received before the service is taxed when received,
 * and netted when it pays for an invoiced order, so it is never taxed twice.
 *
 * - Customer advance received on a receipt voucher: FINAL OUTPUT rows on that voucher
 *   line when the organization's kit has `tax_on_advance` (rule class ADVANCE_DEPOSIT).
 * - Single-purpose gift card (`voucher_tax_mode` SPV) sold: FINAL rows on the card,
 *   taxed like the services it buys (the default sales class). MPV cards are not taxed
 *   at sale; the order they pay for is taxed as usual.
 * - The order's invoice nets what the prepayment paid: reversal rows on the invoice,
 *   oldest receipt first, at the original codes and rates.
 *
 * Every query filters `tenant_org_id`; callers pass their open transaction.
 */
import 'server-only';

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';
import { ZERO, sumMoney, toMoney, type Money } from '@/lib/commercial/money';
import { CREDIT_APPLICATION_STATUSES, CREDIT_APPLICATION_TYPES, TAX_DOCUMENT_STATUSES } from '@/lib/constants/order-financial';
import { DOC_SEQ_TYPES } from '@/lib/constants/doc-seq';
import { GIFT_CARD_TXN_TYPE, GIFT_CARD_VOUCHER_TAX_MODES } from '@/lib/constants/gift-card';
import { TAX_CONFIG_STATUS } from '@/lib/constants/tax';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import { isoDate } from '@/lib/tax/determine';
import { taxPartyScope } from '@/lib/tax/order-line-tax';
import { takeFromPrepaid } from '@/lib/tax/prepaid-pool';
import { decidePurchaseTax, type PurchaseTaxCode } from '@/lib/tax/purchase-tax';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';
import { safeDispatchAutoPost } from '@/lib/services/erp-lite-auto-post.util';
import { loadActiveTaxRules } from './tax-rule-reader';
import { periodIdFor, remainingTaxLines, reversalOf, type FinalRemaining } from './tax-lines.writer';

type Tx = Prisma.TransactionClient;

/** Item class of advance and deposit receipts (sys_tax_item_class_cd). */
const ADVANCE_CLASS = 'ADVANCE_DEPOSIT';
const CONSUMER = 'CONSUMER';
const INVOICE_DOC_TYPES = [DOC_SEQ_TYPES.TAX_INVOICE, DOC_SEQ_TYPES.TAX_SIMPLIFIED];
const money = (m: Money) => m.toFixed(4);

async function taxDateOf(tx: Tx, tenantOrgId: string, branchId: string | null, at: Date): Promise<string> {
  const [branch, tenant] = await Promise.all([
    branchId ? tx.org_branches_mst.findFirst({ where: { id: branchId, tenant_org_id: tenantOrgId }, select: { timezone_code: true } }) : null,
    tx.org_tenants_mst.findFirst({ where: { id: tenantOrgId }, select: { timezone: true } }),
  ]);
  const timezone = [branch?.timezone_code, tenant?.timezone].find((tz) => isValidTimeZone(tz));
  return timezone ? businessDateForTimezone(timezone, at) : at.toISOString().slice(0, 10);
}

type TaxRow = Prisma.org_tax_lines_trUncheckedCreateInput;
const withIds = (rows: TaxRow[]): TaxRow[] => rows.map((r) => ({ ...r, id: randomUUID() }));

/**
 * Moves the batch's tax between the prepayment liability and Output VAT in the ledger (T7).
 * NON_BLOCKING: a missing account mapping lands in the finance exception queue, never fails the sale.
 */
async function postTaxReclass(tx: Tx, rows: TaxRow[], input: {
  tenantOrgId: string; kind: 'ADVANCE' | 'GIFT_CARD'; direction: 'RECORDED' | 'NETTED';
  currencyCode: string; taxDate: string; branchId: string | null; docNo: string | null; userId: string | null;
}): Promise<void> {
  const amount = sumMoney(rows.map((r) => String(r.tax_amount))).abs();
  if (rows.length === 0 || amount.isZero()) return;
  const event = `TAX_${input.kind === 'ADVANCE' ? 'ADVANCE' : 'GIFT_CARD'}_${input.direction}` as const;
  await safeDispatchAutoPost('tax_prepayment_reclass', () =>
    ErpLiteAutoPostService.dispatchTaxReclassInTransaction(tx, {
      tenant_org_id: input.tenantOrgId, event_code: event, tax_line_id: rows[0].id as string,
      source_doc_no: input.docNo, tax_amount: amount.toNumber(), currency_code: input.currencyCode,
      tax_date: input.taxDate, branch_id: input.branchId, created_by: input.userId,
    }),
  );
}

/**
 * Records the tax inside a prepayment as FINAL rows of its document.
 * @param tx - The receiving transaction
 * @param input - Organization, kind, the document line, customer, branch, amount received (tax-inclusive) and currency
 * @returns Nothing; skipped while the setup is not active, for an advance where the kit does not tax advances, and for a zero amount
 * @throws CommercialRuleError when no rule or code fits, or the currency is not the organization's
 */
export async function recordPrepaidTaxTx(tx: Tx, input: {
  tenantOrgId: string;
  kind: 'ADVANCE' | 'GIFT_CARD_SPV';
  docTypeCode: string;
  docId: string;
  docNo: string | null;
  lineId: string | null;
  customerId: string | null;
  branchId: string | null;
  gross: number;
  currencyCode: string;
  userId: string | null;
  at: Date;
}): Promise<void> {
  const { tenantOrgId } = input;
  if (!(input.gross > 0)) return;
  const config = await tx.org_tax_config_cf.findFirst({
    where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 },
    select: { status: true, tax_enabled: true, kit_version_id: true },
  });
  if (config?.status !== TAX_CONFIG_STATUS.ACTIVE || !config.tax_enabled) return;
  if (input.kind === 'ADVANCE') {
    const kit = config.kit_version_id
      ? await tx.sys_tax_kit_versions_mst.findFirst({ where: { id: config.kit_version_id }, select: { tax_on_advance: true } })
      : null;
    if (!kit?.tax_on_advance) return;
  }

  const [tenant, branch, customer, currency, rules, profiles, defaultClass] = await Promise.all([
    tx.org_tenants_mst.findFirst({ where: { id: tenantOrgId }, select: { country: true, currency: true } }),
    input.branchId ? tx.org_branches_mst.findFirst({ where: { id: input.branchId, tenant_org_id: tenantOrgId }, select: { country: true } }) : null,
    input.customerId ? tx.org_customers_mst.findFirst({
      where: { id: input.customerId, tenant_org_id: tenantOrgId }, select: { tax_party_class_code: true, tax_country: true },
    }) : null,
    tx.sys_currency_cd.findUnique({ where: { code: input.currencyCode }, select: { minor_unit: true } }),
    loadActiveTaxRules(tenantOrgId, tx),
    tx.org_tax_profiles_cf.findMany({ where: { tenant_org_id: tenantOrgId, tax_flow_code: 'OUTPUT', is_active: true, rec_status: 1 } }),
    input.kind === 'GIFT_CARD_SPV'
      ? tx.org_tax_item_classes_cf.findFirst({
        where: { tenant_org_id: tenantOrgId, tax_flow_code: 'OUTPUT', is_default: true, is_active: true, rec_status: 1 },
        select: { class_code: true },
      })
      : null,
  ]);
  // shortcut: prepayments are valued in the organization currency only; allow others once receipts record an exchange rate.
  if (tenant?.currency && tenant.currency !== input.currencyCode) {
    throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.TAX_CURRENCY_UNSUPPORTED, 'A taxed prepayment must be in the organization currency.', {
      currency: input.currencyCode, baseCurrency: tenant.currency,
    });
  }

  const supplyCountry = branch?.country ?? tenant?.country ?? '';
  const date = await taxDateOf(tx, tenantOrgId, input.branchId, input.at);
  const codes: PurchaseTaxCode[] = profiles.map((p) => ({
    id: p.id,
    taxCode: p.tax_code,
    versionNo: p.version_no,
    effectiveFrom: isoDate(p.effective_from),
    effectiveTo: p.effective_to ? isoDate(p.effective_to) : null,
    ratePercent: p.rate == null ? null : p.rate.toString(),
    amountKind: p.amount_kind,
    calcLevel: p.calc_level,
    categoryCode: p.tax_category_code,
    exemptReasonCode: p.exempt_reason_code,
    recoverablePct: '0',
  }));
  const decided = decidePurchaseTax(rules, codes, {
    flow: 'OUTPUT',
    docTypeCode: input.docTypeCode,
    date,
    branchId: input.branchId,
    placeOfSupplyCountry: supplyCountry,
    itemClass: input.kind === 'ADVANCE' ? ADVANCE_CLASS : defaultClass?.class_code ?? null,
    partyTaxClass: customer?.tax_party_class_code ?? CONSUMER,
    partyCountryScope: taxPartyScope(customer?.tax_country ?? null, supplyCountry),
    net: toMoney(input.gross),
    inclusive: true,
    enteredTax: null,
    decimals: currency?.minor_unit ?? 2,
  });

  const periodId = await periodIdFor(tx, tenantOrgId, date);
  const rows = withIds(decided.parts.map((p) => ({
      tenant_org_id: tenantOrgId,
      source_doc_type_code: input.docTypeCode,
      source_doc_id: input.docId,
      source_doc_no: input.docNo,
      source_doc_line_id: input.lineId,
      line_status: 'FINAL',
      tax_point_at: input.at,
      tax_date: new Date(date),
      tax_flow_code: 'OUTPUT',
      branch_id: input.branchId,
      party_type: input.customerId ? 'CUSTOMER' : null,
      party_id: input.customerId,
      tax_code: p.code.taxCode,
      tax_profile_id: p.code.id,
      tax_rule_id: decided.ruleId,
      tax_category_code: p.code.categoryCode,
      exempt_reason_code: p.code.exemptReasonCode,
      calc_level: 'LINE',
      rate: toMoney(p.code.ratePercent as string).toFixed(2),
      taxable_amount: money(p.taxable),
      tax_amount: money(p.tax),
      currency_code: input.currencyCode,
      base_currency_code: input.currencyCode,
      base_taxable_amount: money(p.taxable),
      base_tax_amount: money(p.tax),
      compound_base: false,
      applied_seq: p.seq,
      period_id: periodId,
      created_by: input.userId,
      created_info: input.kind === 'ADVANCE' ? 'advance tax' : 'gift card tax',
  })));
  await tx.org_tax_lines_tr.createMany({ data: rows });
  await postTaxReclass(tx, rows, {
    tenantOrgId, kind: input.kind === 'ADVANCE' ? 'ADVANCE' : 'GIFT_CARD', direction: 'RECORDED',
    currencyCode: input.currencyCode, taxDate: date, branchId: input.branchId, docNo: input.docNo, userId: input.userId,
  });
}

/** Rows of one receipt share their net; each holds one code's tax, and a receipt starts at its first code. */
function groupByReceipt(lines: FinalRemaining[]) {
  const groups: FinalRemaining[][] = [];
  for (const l of lines) {
    if (l.line.applied_seq === 1 || groups.length === 0) groups.push([l]);
    else groups[groups.length - 1].push(l);
  }
  return groups;
}

type ReversalDoc = Parameters<typeof reversalOf>[2];

/** Reverses `amount` (tax-inclusive) from a pool of receipt lines, oldest first. */
function reversalsFromPool(pool: FinalRemaining[], amount: Money, decimals: number, doc: ReversalDoc) {
  const groups = groupByReceipt(pool);
  const taken = takeFromPrepaid(groups.map((g) => ({ taxable: g[0].taxable, taxes: g.map((l) => l.tax) })), amount, decimals);
  return groups.flatMap((g, i) => g
    .map((l, j) => ({ l, tax: taken[i].taxes[j], taxable: taken[i].taxable }))
    .filter((x) => !x.tax.isZero() || !x.taxable.isZero())
    .map((x) => reversalOf(x.l, { taxable: x.taxable, tax: x.tax }, doc)));
}

/**
 * Nets the prepayment tax of what advances and single-purpose gift cards paid on an order,
 * against the order's issued invoice. Safe to call again: only the part not yet netted is taken.
 * @param tx - The invoicing or paying transaction
 * @param input - Organization, order, actor, moment; `invoice` when the caller has just issued it
 * @returns Nothing; skipped until the order has an issued invoice and while nothing was prepaid
 */
export async function netPrepaidTaxTx(tx: Tx, input: {
  tenantOrgId: string;
  orderId: string;
  userId: string | null;
  at: Date;
  invoice?: { id: string; docTypeCode: string; no: string | null };
}): Promise<void> {
  const { tenantOrgId, orderId } = input;
  const invoices = await tx.org_tax_documents_mst.findMany({
    where: { tenant_org_id: tenantOrgId, order_id: orderId, doc_type_code: { in: INVOICE_DOC_TYPES }, status: TAX_DOCUMENT_STATUSES.ISSUED },
    select: { id: true, doc_type_code: true, document_no: true },
    orderBy: { issued_at: 'desc' },
  });
  const invoice = input.invoice ?? (invoices[0] ? { id: invoices[0].id, docTypeCode: invoices[0].doc_type_code, no: invoices[0].document_no } : null);
  if (!invoice) return;
  const invoiceIds = [...new Set([invoice.id, ...invoices.map((d) => d.id)])];

  const [advanceApps, cardTxns, order] = await Promise.all([
    tx.org_order_credit_apps_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId, order_id: orderId, application_status: CREDIT_APPLICATION_STATUSES.APPLIED,
        credit_type: CREDIT_APPLICATION_TYPES.ADVANCE,
      },
      select: { applied_amount: true },
    }),
    // A gift card's spend on the order comes from its own ledger (the wiring row does not name the card).
    tx.org_gift_card_txn_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, order_id: orderId, transaction_type: { in: [GIFT_CARD_TXN_TYPE.REDEEM, GIFT_CARD_TXN_TYPE.REFUND] } },
      select: { gift_card_id: true, transaction_type: true, amount: true },
    }),
    tx.org_orders_mst.findFirst({
      where: { id: orderId, tenant_org_id: tenantOrgId }, select: { customer_id: true, branch_id: true, currency_code: true },
    }),
  ]);
  if (!order) return;

  // One pool per prepayment: the customer's advance receipts, or one gift card's sale.
  const pools: { kind: 'ADVANCE' | 'GIFT_CARD'; where: Prisma.org_tax_lines_trWhereInput; applied: Money }[] = [];
  if (advanceApps.length > 0 && order.customer_id) {
    pools.push({
      kind: 'ADVANCE',
      where: {
        party_type: 'CUSTOMER', party_id: order.customer_id, tax_flow_code: 'OUTPUT',
        org_tax_rules_cf: { tenant_org_id: tenantOrgId, tax_item_class_code: ADVANCE_CLASS },
      },
      applied: sumMoney(advanceApps.map((a) => a.applied_amount.toString())),
    });
  }
  const spentByCard = new Map<string, Money>();
  for (const t of cardTxns) {
    const amount = toMoney(t.amount.toString()).abs();
    const spent = spentByCard.get(t.gift_card_id) ?? ZERO;
    spentByCard.set(t.gift_card_id, t.transaction_type === GIFT_CARD_TXN_TYPE.REDEEM ? spent.plus(amount) : spent.minus(amount));
  }
  for (const [cardId, spent] of spentByCard) {
    pools.push({ kind: 'GIFT_CARD', where: { source_doc_type_code: DOC_SEQ_TYPES.GIFT_CARD, source_doc_id: cardId }, applied: spent });
  }
  if (pools.length === 0) return;

  const currency = order.currency_code
    ? await tx.sys_currency_cd.findUnique({ where: { code: order.currency_code }, select: { minor_unit: true } })
    : null;
  const decimals = currency?.minor_unit ?? 2;
  const taxDate = await taxDateOf(tx, tenantOrgId, order.branch_id, input.at);
  const doc: ReversalDoc = {
    typeCode: invoice.docTypeCode, id: invoice.id, no: invoice.no, taxDate, at: input.at,
    periodId: await periodIdFor(tx, tenantOrgId, taxDate), userId: input.userId,
  };

  for (const { kind, where, applied } of pools) {
    const pool = await remainingTaxLines(tx, tenantOrgId, where);
    if (pool.length === 0) continue;
    const netted = await tx.org_tax_lines_tr.findMany({
      where: {
        tenant_org_id: tenantOrgId, source_doc_id: { in: invoiceIds }, is_active: true, rec_status: 1,
        org_tax_lines_tr: { ...where, tenant_org_id: tenantOrgId },
      },
      select: { taxable_amount: true, tax_amount: true, org_tax_lines_tr: { select: { applied_seq: true } } },
    });
    // Gross already netted: every tax, plus each receipt's net once (its first code's row carries it).
    const nettedGross = sumMoney([
      ...netted.map((n) => n.tax_amount.toString()),
      ...netted.filter((n) => n.org_tax_lines_tr?.applied_seq === 1).map((n) => n.taxable_amount.toString()),
    ]).negated();
    const due = applied.minus(nettedGross);
    if (!due.greaterThan(0)) continue;
    const rows = withIds(reversalsFromPool(pool, due, decimals, doc));
    if (rows.length === 0) continue;
    await tx.org_tax_lines_tr.createMany({ data: rows });
    await postTaxReclass(tx, rows, {
      tenantOrgId, kind, direction: 'NETTED', currencyCode: String(rows[0].currency_code), taxDate,
      branchId: order.branch_id, docNo: invoice.no, userId: input.userId,
    });
  }
}

/**
 * Reverses what is left of a prepayment's tax when the receipt or sale itself is undone.
 * @param tx - The unwinding transaction
 * @param input - Organization, which prepayment (advance receipt line or gift card), the reversal voucher and actor
 * @returns Nothing; a prepayment that recorded no tax is left untouched
 */
export async function reversePrepaidTaxTx(tx: Tx, input: {
  tenantOrgId: string;
  prepayment: { voucherLineId: string } | { giftCardId: string };
  reversalVoucherId: string;
  userId: string;
  at: Date;
}): Promise<void> {
  const { tenantOrgId, prepayment } = input;
  const lines = await remainingTaxLines(tx, tenantOrgId, 'giftCardId' in prepayment
    ? { source_doc_type_code: DOC_SEQ_TYPES.GIFT_CARD, source_doc_id: prepayment.giftCardId }
    : { source_doc_line_id: prepayment.voucherLineId, tax_flow_code: 'OUTPUT' });
  if (lines.length === 0) return;
  const voucher = await tx.org_fin_vouchers_mst.findFirst({
    where: { id: input.reversalVoucherId, tenant_org_id: tenantOrgId }, select: { doc_type_code: true, voucher_no: true, branch_id: true },
  });
  if (!voucher) throw new Error('VOUCHER_UNWIND_REVERSAL_VOUCHER_NOT_FOUND');
  const taxDate = await taxDateOf(tx, tenantOrgId, voucher.branch_id, input.at);
  const doc: ReversalDoc = {
    typeCode: voucher.doc_type_code, id: input.reversalVoucherId, no: voucher.voucher_no, taxDate, at: input.at,
    periodId: await periodIdFor(tx, tenantOrgId, taxDate), userId: input.userId,
  };
  const rows = withIds(lines.map((l) => reversalOf(l, l, doc)));
  await tx.org_tax_lines_tr.createMany({ data: rows });
  await postTaxReclass(tx, rows, {
    tenantOrgId, kind: 'giftCardId' in prepayment ? 'GIFT_CARD' : 'ADVANCE', direction: 'NETTED',
    currencyCode: String(rows[0].currency_code), taxDate, branchId: voucher.branch_id, docNo: voucher.voucher_no, userId: input.userId,
  });
}

/**
 * Records an advance's tax when real money was received on a receipt voucher.
 * @param tx - The receiving transaction
 * @param input - Organization, customer, amount, currency, the receipt voucher and its line, actor
 * @returns Nothing; a voucher that is not a receipt voucher records nothing
 */
export async function recordAdvanceReceiptTaxTx(tx: Tx, input: {
  tenantOrgId: string;
  customerId: string;
  amount: number;
  currencyCode: string;
  voucherId: string;
  voucherLineId: string | null;
  userId: string | null;
}): Promise<void> {
  const voucher = await tx.org_fin_vouchers_mst.findFirst({
    where: { id: input.voucherId, tenant_org_id: input.tenantOrgId },
    select: { doc_type_code: true, voucher_no: true, branch_id: true },
  });
  if (voucher?.doc_type_code !== DOC_SEQ_TYPES.RECEIPT_VOUCHER) return;
  await recordPrepaidTaxTx(tx, {
    tenantOrgId: input.tenantOrgId, kind: 'ADVANCE', docTypeCode: voucher.doc_type_code, docId: input.voucherId,
    docNo: voucher.voucher_no, lineId: input.voucherLineId, customerId: input.customerId, branchId: voucher.branch_id,
    gross: input.amount, currencyCode: input.currencyCode, userId: input.userId, at: new Date(),
  });
}

/**
 * Records a single-purpose gift card's tax at sale; a multi-purpose card records nothing.
 * The bearer code is never written to the tax record.
 * @param tx - The sale's transaction
 * @param input - Organization, card, amount, branch, actor
 * @returns Nothing
 */
export async function recordGiftCardSaleTaxTx(tx: Tx, input: {
  tenantOrgId: string;
  giftCardId: string;
  amount: number;
  branchId: string | null;
  userId: string | null;
}): Promise<void> {
  const card = await tx.org_gift_cards_mst.findFirst({
    where: { id: input.giftCardId, tenant_org_id: input.tenantOrgId },
    select: { voucher_tax_mode: true, currency_code: true, purchased_by_cust_id: true },
  });
  if (card?.voucher_tax_mode !== GIFT_CARD_VOUCHER_TAX_MODES.SPV || !card.currency_code) return;
  await recordPrepaidTaxTx(tx, {
    tenantOrgId: input.tenantOrgId, kind: 'GIFT_CARD_SPV', docTypeCode: DOC_SEQ_TYPES.GIFT_CARD, docId: input.giftCardId,
    docNo: null, lineId: null, customerId: card.purchased_by_cust_id, branchId: input.branchId,
    gross: input.amount, currencyCode: card.currency_code, userId: input.userId, at: new Date(),
  });
}
