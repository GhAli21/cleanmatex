import { TAX_CATEGORIES } from '@/lib/constants/commercial';
import { type Money, type MoneyInput, ZERO, toMoney } from './money';

/** One stored row's share of a tax category; a null category adds nothing (older rows). */
export interface TaxCategoryAmount {
  taxCategoryCode: string | null;
  amount: MoneyInput | null;
}

/** An order's taxable amount per tax category, as the header stores it. */
export interface OrderTaxCategoryBuckets {
  standard: Money;
  zeroRated: Money;
  exempt: Money;
  outOfScope: Money;
}

const sumInto = (totals: Map<string, Money>, rows: readonly TaxCategoryAmount[], sign: 1 | -1) => {
  for (const row of rows) {
    if (row.taxCategoryCode == null || row.amount == null) continue;
    const amount = toMoney(row.amount);
    totals.set(row.taxCategoryCode, (totals.get(row.taxCategoryCode) ?? ZERO).plus(sign === 1 ? amount : amount.negated()));
  }
};

/**
 * The header buckets from the stored rows (PLAN §6.2, the same figures as the
 * calculator's `categoryTaxable`, so a later recalculation never drifts): lines and
 * charges add their taxable amount, and a DOCUMENT_LEVEL order discount takes its
 * share off its category, because line figures do not carry it.
 * @param lines - active order lines
 * @param charges - active order charges
 * @param documentDiscounts - active DOCUMENT_LEVEL order discounts, one row per category
 * @returns the taxable amount per category
 * @example orderTaxCategoryBuckets([{ taxCategoryCode: 'EXEMPT', amount: '10' }], [], []).exempt.toString(); // '10'
 */
export function orderTaxCategoryBuckets(
  lines: readonly TaxCategoryAmount[],
  charges: readonly TaxCategoryAmount[],
  documentDiscounts: readonly TaxCategoryAmount[],
): OrderTaxCategoryBuckets {
  const totals = new Map<string, Money>();
  sumInto(totals, lines, 1);
  sumInto(totals, charges, 1);
  sumInto(totals, documentDiscounts, -1);
  return {
    standard: totals.get(TAX_CATEGORIES.STANDARD) ?? ZERO,
    zeroRated: totals.get(TAX_CATEGORIES.ZERO_RATED) ?? ZERO,
    exempt: totals.get(TAX_CATEGORIES.EXEMPT) ?? ZERO,
    outOfScope: totals.get(TAX_CATEGORIES.OUT_OF_SCOPE) ?? ZERO,
  };
}
