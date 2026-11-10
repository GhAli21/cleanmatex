/**
 * Picks the tax of one sales line from the organization's rules. Pure, no I/O:
 * quote, create and Edit share it, so they can never disagree.
 *
 * A rule names ordered tax codes. STANDARD codes are charged through the existing
 * calculator; a rule that names only non-STANDARD codes makes the line zero-rated,
 * exempt or out of scope, and that code is what the tax record carries.
 */
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';
import type { TaxProfileInput } from '@/lib/commercial/tax';
import { TAX_CATEGORIES, TAX_EXEMPT_REASONS } from '@/lib/constants/commercial';
import { determineTaxRule, pickTaxCodeVersion, type TaxRuleForMatch } from './determine';

/** One version of a sales tax code, ready for the calculator. */
export interface OrderTaxCode extends TaxProfileInput {
  taxCode: string;
  /** A percent code saved without a rate; it is treated as having no usable version. */
  rateMissing: boolean;
  versionNo: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  amountKind: string;
  calcLevel: string;
  categoryCode: string;
  exemptReasonCode: string | null;
}

/** A rule with its ordered codes. */
export type OrderTaxRule = TaxRuleForMatch & { tax_codes: string[] };

/** The organization's rules and the order-wide facts they match on. */
export interface OrderTaxEngine {
  rules: readonly OrderTaxRule[];
  codes: readonly OrderTaxCode[];
  /** Business date of the order. */
  date: string;
  branchId: string | null;
  placeOfSupplyCountry: string;
  /** Class of a line whose product has none (custom item, order charge). */
  defaultItemClass: string | null;
  partyTaxClass: string;
  partyCountryScope: string;
}

/** Why a line carries its tax: kept for `org_tax_lines_tr`. */
export interface OrderTaxRecord {
  ruleId: string | null;
  /** The non-STANDARD code of a line that carries no charged tax. */
  zeroCode: { profileId: string; taxCode: string } | null;
}

export interface OrderLineTaxFacts {
  itemClass: string | null;
  serviceCategory: string | null;
  customerExempt: boolean;
  serviceExempt: boolean;
}

export interface OrderLineTaxDecision {
  taxCategoryCode: string;
  exemptReason: string | null;
  profiles: TaxProfileInput[];
  record: OrderTaxRecord;
}

const GCC_COUNTRIES = new Set(['SA', 'AE', 'BH', 'OM', 'QA', 'KW']);

/**
 * Where the party stands relative to the place of supply.
 * @param partyCountry - The party's tax country; null means same country
 * @param supplyCountry - The place of supply
 * @returns DOMESTIC, GCC or FOREIGN
 */
export function taxPartyScope(partyCountry: string | null, supplyCountry: string): string {
  const party = partyCountry?.toUpperCase();
  if (!party || party === supplyCountry.toUpperCase()) return 'DOMESTIC';
  return GCC_COUNTRIES.has(party) && GCC_COUNTRIES.has(supplyCountry.toUpperCase()) ? 'GCC' : 'FOREIGN';
}

const fail = (code: keyof typeof COMMERCIAL_ERROR_CODES, message: string, details: Record<string, string>) =>
  new CommercialRuleError(COMMERCIAL_ERROR_CODES[code], message, details);

const versionOf = (engine: OrderTaxEngine, taxCode: string) =>
  pickTaxCodeVersion(engine.codes.filter((c) => c.taxCode === taxCode && !c.rateMissing).map((c) => ({
    ...c, version_no: c.versionNo, effective_from: c.effectiveFrom, effective_to: c.effectiveTo,
  })), engine.date);

/**
 * Decides one line's tax.
 * @param engine - Rules, codes and order-wide facts
 * @param line - The line's class, category and exemptions
 * @returns Category, reason, the codes to charge in calculation order, and the record for the tax line
 * @throws CommercialRuleError NO_TAX_RULE, TAX_RULE_AMBIGUOUS, TAX_CODE_VERSION_MISSING, TAX_CODE_UNSUPPORTED
 */
export function decideOrderLineTax(engine: OrderTaxEngine, line: OrderLineTaxFacts): OrderLineTaxDecision {
  const taxItemClass = line.itemClass ?? engine.defaultItemClass;
  const outcome = determineTaxRule({
    date: engine.date,
    doc_type_code: 'ORDER',
    tax_flow_code: 'OUTPUT',
    branch_id: engine.branchId,
    place_of_supply_country: engine.placeOfSupplyCountry,
    tax_item_class_code: taxItemClass,
    party_tax_class_code: engine.partyTaxClass,
    party_country_scope: engine.partyCountryScope,
    service_category_code: line.serviceCategory,
  }, [...engine.rules]);
  const details = { itemClass: taxItemClass ?? '' };
  if (outcome.status === 'NO_TAX_RULE') throw fail('NO_TAX_RULE', 'No tax rule matches this line.', details);
  if (outcome.status === 'AMBIGUOUS') throw fail('TAX_RULE_AMBIGUOUS', 'Two equally specific tax rules match this line.', details);

  const codes = outcome.rule.tax_codes.map((taxCode) => {
    const version = versionOf(engine, taxCode);
    if (!version) throw fail('TAX_CODE_VERSION_MISSING', `Tax code ${taxCode} has no usable version on ${engine.date}.`, { taxCode });
    // shortcut: fixed-amount and document-level codes are refused, no seeded kit has one; add them to calculateTax when a kit needs them.
    if (version.amountKind !== 'PERCENT' || version.calcLevel !== 'LINE') {
      throw fail('TAX_CODE_UNSUPPORTED', `Tax code ${taxCode} is not a line percent.`, { taxCode });
    }
    return version;
  });
  const ruleId = outcome.rule.id;
  const charged = codes.filter((c) => c.categoryCode === TAX_CATEGORIES.STANDARD);
  const exempted = charged.length > 0 && (line.customerExempt || line.serviceExempt);

  if (charged.length > 0 && !exempted) {
    return {
      taxCategoryCode: TAX_CATEGORIES.STANDARD,
      exemptReason: null,
      profiles: [...charged.filter((c) => !c.isCompound), ...charged.filter((c) => c.isCompound)],
      record: { ruleId, zeroCode: null },
    };
  }
  if (exempted) {
    // The organization's EXEMPT code when it has one, so the return reports the line in the right box.
    const exemptCode = engine.codes.find((c) => c.categoryCode === TAX_CATEGORIES.EXEMPT && versionOf(engine, c.taxCode)?.id === c.id) ?? charged[0];
    return {
      taxCategoryCode: TAX_CATEGORIES.EXEMPT,
      exemptReason: line.customerExempt ? TAX_EXEMPT_REASONS.CUSTOMER_EXEMPTION : TAX_EXEMPT_REASONS.SERVICE_EXEMPTION,
      profiles: [],
      record: { ruleId, zeroCode: { profileId: exemptCode.id, taxCode: exemptCode.taxCode } },
    };
  }
  const first = codes[0];
  return {
    taxCategoryCode: first.categoryCode,
    exemptReason: first.exemptReasonCode ?? TAX_EXEMPT_REASONS.PRODUCT_EXEMPT,
    profiles: [],
    record: { ruleId, zeroCode: { profileId: first.id, taxCode: first.taxCode } },
  };
}
