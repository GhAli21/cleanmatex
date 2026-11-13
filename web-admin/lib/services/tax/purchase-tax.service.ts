/**
 * Tax of purchases and supplier payments: loads the organization's rules for one
 * document, checks the line with `decidePurchaseTax`, and writes FINAL rows to
 * `org_tax_lines_tr` (a posted expense or supplier invoice is its own tax point).
 * Every query filters `tenant_org_id`; callers pass their open transaction.
 */
import 'server-only';

import type { Prisma } from '@prisma/client';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';
import { toMoney, type Money } from '@/lib/commercial/money';
import { roundMoney } from '@/lib/commercial/rounding';
import { TAX_CONFIG_STATUS } from '@/lib/constants/tax';
import type { DocFxRate } from '@/lib/services/fx/doc-fx-rate';
import { isoDate } from '@/lib/tax/determine';
import { taxPartyScope } from '@/lib/tax/order-line-tax';
import { decidePurchaseTax, type PurchaseTaxCode, type PurchaseTaxResult } from '@/lib/tax/purchase-tax';
import { loadActiveTaxRules } from './tax-rule-reader';
import { periodIdFor } from './tax-lines.writer';

type Tx = Prisma.TransactionClient;

/** A supplier with no tax class is treated as a VAT-registered business (sys_tax_party_class_cd). */
const SUPPLIER_DEFAULT_PARTY_CLASS = 'BUSINESS_REGISTERED';
const money = (m: Money) => m.toFixed(4);

export interface PurchaseTaxRequest {
  tenantOrgId: string;
  flow: 'INPUT' | 'WITHHOLDING';
  docTypeCode: string;
  /** Document date (YYYY-MM-DD): invoice, expense or payment date. */
  date: string;
  branchId: string | null;
  supplierId: string | null;
  /** Chosen item tax class; null = the organization's default purchase class. Ignored for withholding. */
  itemClass: string | null;
  currencyCode: string;
  /** Rate into the organization currency, already resolved for `date`. */
  fx: DocFxRate;
  net: number;
  /** Typed tax; null = take the code's tax. */
  enteredTax: number | null;
}

/** A decided line and what its record rows need. */
export interface PurchaseTax extends PurchaseTaxResult {
  itemClass: string | null;
  supplierId: string | null;
  branchId: string | null;
  date: string;
  currencyCode: string;
  flow: 'INPUT' | 'WITHHOLDING';
  fx: DocFxRate;
}

/**
 * Decides a purchase line's tax from the rules.
 * @param tx - The document's transaction
 * @param req - Organization, document facts and amounts
 * @returns The decision; null while the tax setup is not active (the typed tax is kept and nothing is recorded, ADR-061)
 * @throws CommercialRuleError on a missing/tied rule, a bad class or a tax mismatch
 */
export async function resolvePurchaseTax(tx: Tx, req: PurchaseTaxRequest): Promise<PurchaseTax | null> {
  const { tenantOrgId } = req;
  const config = await tx.org_tax_config_cf.findFirst({
    where: { tenant_org_id: tenantOrgId, is_active: true, rec_status: 1 },
    select: { status: true, tax_enabled: true },
  });
  if (config?.status !== TAX_CONFIG_STATUS.ACTIVE || !config.tax_enabled) return null;

  const [tenant, branch, supplier, currency, rules, profiles, cls] = await Promise.all([
    tx.org_tenants_mst.findFirst({ where: { id: tenantOrgId }, select: { country: true, currency: true } }),
    req.branchId ? tx.org_branches_mst.findFirst({ where: { id: req.branchId, tenant_org_id: tenantOrgId }, select: { country: true } }) : null,
    req.supplierId ? tx.org_fin_supp_mst.findFirst({
      where: { id: req.supplierId, tenant_org_id: tenantOrgId }, select: { tax_party_class_code: true, tax_country: true },
    }) : null,
    tx.sys_currency_cd.findUnique({ where: { code: req.currencyCode }, select: { minor_unit: true } }),
    loadActiveTaxRules(tenantOrgId, tx),
    tx.org_tax_profiles_cf.findMany({ where: { tenant_org_id: tenantOrgId, tax_flow_code: req.flow, is_active: true, rec_status: 1 } }),
    req.flow === 'INPUT'
      ? tx.org_tax_item_classes_cf.findFirst({
        where: {
          tenant_org_id: tenantOrgId, tax_flow_code: 'INPUT', is_active: true, rec_status: 1,
          ...(req.itemClass ? { class_code: req.itemClass } : { is_default: true }),
        },
        select: { class_code: true },
      })
      : null,
  ]);

  // Never tax with a default party class when the named supplier is not this organization's.
  if (req.supplierId && !supplier) throw new Error('Selected supplier was not found for this tenant');
  if (req.flow === 'INPUT' && req.itemClass && !cls) {
    throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.TAX_CLASS_INVALID, 'This is not an active purchase tax class.', { itemClass: req.itemClass });
  }

  const supplyCountry = branch?.country ?? tenant?.country ?? '';
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
    recoverablePct: (p.recoverable_pct ?? 0).toString(),
  }));
  const itemClass = cls?.class_code ?? null;
  const result = decidePurchaseTax(rules, codes, {
    flow: req.flow,
    docTypeCode: req.docTypeCode,
    date: req.date,
    branchId: req.branchId,
    placeOfSupplyCountry: supplyCountry,
    itemClass,
    partyTaxClass: supplier?.tax_party_class_code ?? SUPPLIER_DEFAULT_PARTY_CLASS,
    partyCountryScope: taxPartyScope(supplier?.tax_country ?? null, supplyCountry),
    net: toMoney(req.net),
    enteredTax: req.enteredTax == null ? null : toMoney(req.enteredTax),
    decimals: currency?.minor_unit ?? 2,
  });
  return {
    ...result, itemClass, supplierId: req.supplierId, branchId: req.branchId, date: req.date,
    currencyCode: req.currencyCode, flow: req.flow, fx: req.fx,
  };
}

/**
 * Document amount in the organization currency, rounded to the base minor unit.
 * Same currency keeps the document amount: a second rounding would change a figure the user already accepted.
 * @param amount - Taxable or tax in the document currency
 * @param currencyCode - Document currency
 * @param fx - Rate facts for the document
 * @returns DECIMAL(19,4) storage string
 */
function baseStorage(amount: Money, currencyCode: string, fx: DocFxRate): string {
  if (currencyCode.trim().toUpperCase() === fx.baseCurrencyCode) return amount.toFixed(4);
  const converted = roundMoney(amount.times(toMoney(fx.exchangeRate)), {
    decimalPlaces: fx.baseMinorUnit,
    mode: 'HALF_UP',
  });
  return converted.toFixed(4);
}

/**
 * Records a decided line as FINAL tax rows of its document.
 * @param tx - The document's transaction
 * @param input - Organization, the document identity, actor and the decision
 * @returns Nothing
 */
export async function writePurchaseTaxLines(tx: Tx, input: {
  tenantOrgId: string;
  docTypeCode: string;
  docId: string;
  docNo: string | null;
  lineId: string | null;
  userId: string | null;
  at: Date;
  tax: PurchaseTax;
}): Promise<void> {
  const { tenantOrgId, tax } = input;
  const sameCurrency = tax.currencyCode.trim().toUpperCase() === tax.fx.baseCurrencyCode;
  const periodId = await periodIdFor(tx, tenantOrgId, tax.date);
  await tx.org_tax_lines_tr.createMany({
    data: tax.parts.map((p) => ({
      tenant_org_id: tenantOrgId,
      source_doc_type_code: input.docTypeCode,
      source_doc_id: input.docId,
      source_doc_no: input.docNo,
      source_doc_line_id: input.lineId,
      line_status: 'FINAL',
      tax_point_at: input.at,
      tax_date: new Date(tax.date),
      tax_flow_code: tax.flow,
      branch_id: tax.branchId,
      party_type: tax.supplierId ? 'SUPPLIER' : null,
      party_id: tax.supplierId,
      tax_code: p.code.taxCode,
      tax_profile_id: p.code.id,
      tax_rule_id: tax.ruleId,
      tax_category_code: p.code.categoryCode,
      exempt_reason_code: p.code.exemptReasonCode,
      calc_level: 'LINE',
      rate: toMoney(p.code.ratePercent as string).toFixed(2),
      taxable_amount: money(p.taxable),
      tax_amount: money(p.tax),
      recoverable_amount: money(p.recoverable),
      currency_code: tax.currencyCode,
      base_currency_code: tax.fx.baseCurrencyCode,
      base_taxable_amount: baseStorage(p.taxable, tax.currencyCode, tax.fx),
      base_tax_amount: baseStorage(p.tax, tax.currencyCode, tax.fx),
      fx_rate: sameCurrency ? null : tax.fx.exchangeRate,
      fx_rate_date: sameCurrency || !tax.fx.fxRateDate ? null : new Date(tax.fx.fxRateDate),
      fx_rate_source: sameCurrency ? null : tax.fx.fxRateSource,
      fx_rate_id: sameCurrency ? null : tax.fx.fxRateId,
      compound_base: false,
      applied_seq: p.seq,
      period_id: periodId,
      created_by: input.userId,
      created_info: 'purchase tax lines',
    })),
  });
}
