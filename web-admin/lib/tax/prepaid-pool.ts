/**
 * Tax already recorded on prepayments (customer advances, single-purpose gift cards)
 * is netted when the prepayment pays for an invoiced order. Pure, no I/O.
 */
import { ZERO, sumMoney, type Money } from '@/lib/commercial/money';

/** What is left of one prepayment receipt: its net and the tax of each of its codes. */
export interface PrepaidReceipt {
  taxable: Money;
  taxes: Money[];
}

/**
 * Takes a tax-inclusive amount from the receipts, oldest first. A receipt used in part
 * gives its share of each tax; a receipt used in full gives exactly what it has left.
 * @param receipts - Remaining receipts, oldest first
 * @param amount - Prepayment spent (tax-inclusive)
 * @param decimals - Minor-unit digits of the currency
 * @returns What to reverse from each receipt, in the same order (zero when untouched)
 */
export function takeFromPrepaid(receipts: readonly PrepaidReceipt[], amount: Money, decimals: number): PrepaidReceipt[] {
  let left = amount;
  return receipts.map((r) => {
    const gross = r.taxable.plus(sumMoney(r.taxes));
    if (left.lessThanOrEqualTo(0) || gross.lessThanOrEqualTo(0)) return { taxable: ZERO, taxes: r.taxes.map(() => ZERO) };
    if (left.greaterThanOrEqualTo(gross)) {
      left = left.minus(gross);
      return { taxable: r.taxable, taxes: r.taxes };
    }
    const taxes = r.taxes.map((t) => t.times(left).dividedBy(gross).toDecimalPlaces(decimals));
    const taken = { taxable: left.minus(sumMoney(taxes)), taxes };
    left = ZERO;
    return taken;
  });
}
