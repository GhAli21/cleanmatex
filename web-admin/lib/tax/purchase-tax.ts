/**
 * Picks and checks the tax of one purchase line (expense, purchase order, supplier
 * invoice) or one supplier payment (withholding) from the organization's rules.
 * Pure, no I/O.
 *
 * A supplier invoice states its own tax, so an entered amount is kept when it is within
 * one minor unit of what the code gives (supplier rounding) and refused otherwise; it is
 * never rewritten. A blank amount takes the code's tax.
 */
import { allocateLargestRemainder } from '@/lib/commercial/allocation';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';
import { ZERO, sumMoney, toMoney, type Money } from '@/lib/commercial/money';
import { determineTaxRule, pickTaxCodeVersion, type TaxRuleForMatch } from './determine';

/** One version of a purchase or withholding tax code. */
export interface PurchaseTaxCode {
  id: string;
  taxCode: string;
  versionNo: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Percent, e.g. "5.00"; null = saved without a rate (no usable version). */
  ratePercent: string | null;
  amountKind: string;
  calcLevel: string;
  categoryCode: string;
  exemptReasonCode: string | null;
  /** Share of the tax that can be reclaimed, 0–100. */
  recoverablePct: string;
}

export type PurchaseTaxRule = TaxRuleForMatch & { tax_codes: string[] };

export interface PurchaseTaxFacts {
  flow: 'INPUT' | 'WITHHOLDING';
  docTypeCode: string;
  date: string;
  branchId: string | null;
  placeOfSupplyCountry: string;
  /** Already defaulted to the organization's purchase class; null for withholding. */
  itemClass: string | null;
  partyTaxClass: string;
  partyCountryScope: string;
  net: Money;
  /** What the user typed; null = take the code's tax. */
  enteredTax: Money | null;
  /** Minor-unit digits of the document currency. */
  decimals: number;
}

/** One code's share of the line, ready for `org_tax_lines_tr`. */
export interface PurchaseTaxPart {
  code: PurchaseTaxCode;
  seq: number;
  taxable: Money;
  tax: Money;
  recoverable: Money;
}

export interface PurchaseTaxResult {
  ruleId: string;
  parts: PurchaseTaxPart[];
  taxAmount: Money;
}

const fail = (code: keyof typeof COMMERCIAL_ERROR_CODES, message: string, details: Record<string, string>) =>
  new CommercialRuleError(COMMERCIAL_ERROR_CODES[code], message, details);

/**
 * Decides and checks a purchase line's tax.
 * @param rules - The organization's active rules
 * @param codes - Every version of its codes for this flow
 * @param facts - The line and its document
 * @returns The rule, one part per code and the total tax
 * @throws CommercialRuleError NO_TAX_RULE, TAX_RULE_AMBIGUOUS, TAX_CODE_VERSION_MISSING, TAX_CODE_UNSUPPORTED, PURCHASE_TAX_MISMATCH
 */
export function decidePurchaseTax(
  rules: readonly PurchaseTaxRule[],
  codes: readonly PurchaseTaxCode[],
  facts: PurchaseTaxFacts,
): PurchaseTaxResult {
  const outcome = determineTaxRule({
    date: facts.date,
    doc_type_code: facts.docTypeCode,
    tax_flow_code: facts.flow,
    branch_id: facts.branchId,
    place_of_supply_country: facts.placeOfSupplyCountry,
    tax_item_class_code: facts.itemClass,
    party_tax_class_code: facts.partyTaxClass,
    party_country_scope: facts.partyCountryScope,
    service_category_code: null,
  }, [...rules]);
  const details = { itemClass: facts.itemClass ?? '', flow: facts.flow };
  if (outcome.status === 'NO_TAX_RULE') throw fail('NO_TAX_RULE', 'No tax rule matches this purchase.', details);
  if (outcome.status === 'AMBIGUOUS') throw fail('TAX_RULE_AMBIGUOUS', 'Two equally specific tax rules match this purchase.', details);

  const versions = outcome.rule.tax_codes.map((taxCode) => {
    const version = pickTaxCodeVersion(
      codes.filter((c) => c.taxCode === taxCode && c.ratePercent != null)
        .map((c) => ({ ...c, version_no: c.versionNo, effective_from: c.effectiveFrom, effective_to: c.effectiveTo })),
      facts.date,
    );
    if (!version) throw fail('TAX_CODE_VERSION_MISSING', `Tax code ${taxCode} has no usable version on ${facts.date}.`, { taxCode });
    // shortcut: fixed-amount and document-level codes are refused, no seeded kit has one; add them when a kit needs them.
    if (version.amountKind !== 'PERCENT' || version.calcLevel !== 'LINE') {
      throw fail('TAX_CODE_UNSUPPORTED', `Tax code ${taxCode} is not a line percent.`, { taxCode });
    }
    return version;
  });

  const round = (m: Money) => m.toDecimalPlaces(facts.decimals);
  const expected = versions.map((v) => round(facts.net.times(toMoney(v.ratePercent as string)).dividedBy(100)));
  const expectedTotal = sumMoney(expected);
  const minorUnit = toMoney(1).dividedBy(toMoney(10).pow(facts.decimals));

  let taxes = expected;
  if (facts.enteredTax) {
    if (facts.enteredTax.minus(expectedTotal).abs().greaterThan(minorUnit)) {
      throw fail('PURCHASE_TAX_MISMATCH', 'The entered tax does not match the tax code.', {
        expected: expectedTotal.toFixed(facts.decimals), entered: facts.enteredTax.toFixed(facts.decimals),
      });
    }
    // The supplier's own rounding is kept, split over the codes by what each gives.
    taxes = expectedTotal.isZero() ? expected : allocateLargestRemainder(facts.enteredTax, expected, facts.decimals);
  }

  const parts = versions.map((code, i) => ({
    code,
    seq: i + 1,
    taxable: facts.net,
    tax: taxes[i],
    recoverable: facts.flow === 'INPUT' ? round(taxes[i].times(toMoney(code.recoverablePct)).dividedBy(100)) : ZERO,
  }));
  return { ruleId: outcome.rule.id, parts, taxAmount: sumMoney(taxes) };
}
