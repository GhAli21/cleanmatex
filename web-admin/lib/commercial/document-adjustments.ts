/**
 * Order (document) discounts and their split (PLAN.md §8.4, L5, L15, L21).
 *
 * Why: the order's `disc_alloc_mode` snapshot decides where an order discount
 * lives (invariant I4, one home per amount):
 * - `ALLOCATE_TO_LINES`: split across lines, so each line carries exact tax.
 * - `DOCUMENT_LEVEL` (today's behaviour): an allowance at document level,
 *   split by tax category only, so the header can tax each category's base.
 *
 * Order discounts reduce the lines only; separate charges (delivery, order
 * preference extras) are not discounted, as in Create today.
 */
import {
  DISC_ALLOC_BASIS,
  DISC_ALLOC_MODES,
  type DiscAllocBasis,
  type DiscAllocMode,
} from '@/lib/constants/commercial';
import { applySequentialAdjustments, type AdjustmentInput, type AppliedAdjustment } from './adjustments';
import { allocateLargestRemainder } from './allocation';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { ZERO, sumMoney, toMoney, type Money, type MoneyInput } from './money';
import type { RoundingRule } from './rounding';

/** One line as the order discount sees it, in allocation tie-break order. */
export interface DocumentLine {
  lineId: string;
  /** `priceLine(...).grossAmount` */
  grossAmount: MoneyInput;
  /** `priceLine(...).netBeforeDocument` */
  netAmount: MoneyInput;
  /** The line's tax category (`sys_tax_category_cd.code`), for the DOCUMENT_LEVEL split. */
  taxCategoryCode: string;
}

/** The order discounts to apply and how to split them. */
export interface DocumentAdjustmentInput {
  /** ORDER-level discounts in the order they apply (manual → rule → promo today). */
  adjustments: readonly AdjustmentInput[];
  /** Lines in tie-break order (PLAN.md §5.2: `piece_seq`, then id). */
  lines: readonly DocumentLine[];
  mode: DiscAllocMode;
  /** Used under `ALLOCATE_TO_LINES` only. */
  basis: DiscAllocBasis;
  /** The currency rule (decimals and mode). */
  rounding: RoundingRule;
}

/** Each discount, its total, and where it went. */
export interface DocumentAdjustmentResult {
  adjustments: AppliedAdjustment[];
  total: Money;
  /** `ALLOCATE_TO_LINES`: each line's `order_disc_alloc_amount` (zero under DOCUMENT_LEVEL). */
  lineShares: Map<string, Money>;
  /** `DOCUMENT_LEVEL`: the allowance per tax category, in first-seen order (empty under ALLOCATE_TO_LINES). */
  categoryShares: Map<string, Money>;
}

/**
 * Applies the order discounts on the lines' net and splits the total.
 * Shares come from one largest-remainder allocation of the total, so they
 * add up to it exactly (I1).
 * @param input discounts, lines, allocation mode and basis, rounding rule
 * @returns the applied discounts, their total, and the line or category shares
 * @throws CommercialRuleError DOCUMENT_DISCOUNT_EXCEEDS_BASE, DOCUMENT_DISCOUNT_EXCEEDS_LINE, GIFT_CARD_NOT_ADJUSTMENT, INVALID_ADJUSTMENT
 * @example
 * applyDocumentAdjustments({ adjustments: [{ id: 'm', source: 'MANUAL', calcType: 'FIXED_AMOUNT', value: '1' }],
 *   lines, mode: 'ALLOCATE_TO_LINES', basis: 'PROPORTIONAL_NET', rounding }).lineShares;
 */
export function applyDocumentAdjustments(input: DocumentAdjustmentInput): DocumentAdjustmentResult {
  const { lines, rounding } = input;
  const nets = lines.map((line) => toMoney(line.netAmount));
  const base = sumMoney(nets);
  const { applied, total } = applySequentialAdjustments(
    base, input.adjustments, rounding, COMMERCIAL_ERROR_CODES.DOCUMENT_DISCOUNT_EXCEEDS_BASE,
  );

  const lineShares = new Map<string, Money>(lines.map((line) => [line.lineId, ZERO]));
  const categoryShares = new Map<string, Money>();
  if (total.isZero() || lines.length === 0) return { adjustments: applied, total, lineShares, categoryShares };

  if (input.mode === DISC_ALLOC_MODES.ALLOCATE_TO_LINES) {
    const weights = input.basis === DISC_ALLOC_BASIS.PROPORTIONAL_GROSS
      ? lines.map((line) => toMoney(line.grossAmount))
      : nets;
    const shares = allocateLargestRemainder(total, weights, rounding.decimalPlaces);
    shares.forEach((share, i) => {
      // Gross weights can push a heavily line-discounted row below zero.
      if (share.greaterThan(nets[i])) {
        throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.DOCUMENT_DISCOUNT_EXCEEDS_LINE,
          `The order discount share ${share.toString()} is more than line ${lines[i].lineId}'s net ${nets[i].toString()}.`,
          { lineId: lines[i].lineId, share: share.toString(), net: nets[i].toString() });
      }
      lineShares.set(lines[i].lineId, share);
    });
    return { adjustments: applied, total, lineShares, categoryShares };
  }

  // DOCUMENT_LEVEL: split by tax category in proportion to each category's net.
  const categoryNets = new Map<string, Money>();
  lines.forEach((line, i) => {
    categoryNets.set(line.taxCategoryCode, (categoryNets.get(line.taxCategoryCode) ?? ZERO).plus(nets[i]));
  });
  const categories = [...categoryNets.keys()];
  const shares = allocateLargestRemainder(total, categories.map((c) => categoryNets.get(c) as Money), rounding.decimalPlaces);
  categories.forEach((category, i) => categoryShares.set(category, shares[i]));
  return { adjustments: applied, total, lineShares, categoryShares };
}
