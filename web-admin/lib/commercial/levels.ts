/**
 * Commercial level: item and piece money kept exactly consistent
 * (PLAN.md §5.1, §5.2 I1/I2, L10–L12; PF-12, PF-23).
 *
 * Why: today a piece stores item total ÷ quantity with no remainder (10 ÷ 3
 * = 3 × 3.3333 = 9.9999), and Create and Edit disagree on piece extras.
 * Here both levels are always filled from one source:
 * - `ITEM`: the item is PRICED; each piece is an exact ALLOCATED share.
 * - `PIECE`: each piece is PRICED; the item is the exact ROLLUP of its pieces.
 * - PIECE fallback: a line that cannot be priced per piece stays PRICED on
 *   the item, its pieces ALLOCATED.
 *
 * Only the amount columns are split or summed; the row identities (I5) are
 * then derived, so they hold on every row and Σ pieces = item exactly.
 */
import {
  COMMERCIAL_LEVELS,
  MONEY_BASIS,
  PRODUCT_PRICE_TYPES,
  type CommercialLevel,
  type MoneyBasis,
} from '@/lib/constants/commercial';
import { TAX_PRICING_MODES, type TaxPricingMode } from '@/lib/constants/order-financial';
import { allocateLargestRemainder } from './allocation';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { sumMoney, toMoney, type Money, type MoneyInput } from './money';
import { roundMoney, type RoundingRule } from './rounding';

// ─── Basis decision ────────────────────────────────────────────────────────

/** Why a PIECE-level line is priced on the item instead. */
export const PIECE_FALLBACK_REASONS = {
  /** `price_type = FIXED`: one unit may be several pieces (a suit set). */
  FIXED_PRICE_TYPE: 'FIXED_PRICE_TYPE',
  /** The line's piece count differs from its quantity, so a piece is not one unit. */
  PIECE_COUNT_MISMATCH: 'PIECE_COUNT_MISMATCH',
  /** The line has no pieces at all. */
  NO_PIECES: 'NO_PIECES',
} as const;
/** Derived union of PIECE fallback reasons. */
export type PieceFallbackReason = (typeof PIECE_FALLBACK_REASONS)[keyof typeof PIECE_FALLBACK_REASONS];

/** Where one line's price lives. */
export interface MoneyBasisDecision {
  itemBasis: MoneyBasis;
  pieceBasis: MoneyBasis;
  /** Set when PIECE level fell back to item pricing. */
  fallbackReason: PieceFallbackReason | null;
}

/**
 * Decides which row carries the price for one line.
 * @param level the order's `commercial_level` snapshot
 * @param line the product's `price_type`, the line quantity and its piece count
 * @returns the item and piece bases and any fallback reason
 */
export function resolveMoneyBasis(
  level: CommercialLevel,
  line: { priceType: string | null; quantity: MoneyInput; pieceCount: number },
): MoneyBasisDecision {
  const itemPriced = (fallbackReason: PieceFallbackReason | null): MoneyBasisDecision => ({
    itemBasis: MONEY_BASIS.PRICED, pieceBasis: MONEY_BASIS.ALLOCATED, fallbackReason,
  });
  if (level !== COMMERCIAL_LEVELS.PIECE) return itemPriced(null);
  if (line.priceType === PRODUCT_PRICE_TYPES.FIXED) return itemPriced(PIECE_FALLBACK_REASONS.FIXED_PRICE_TYPE);
  if (line.pieceCount === 0) return itemPriced(PIECE_FALLBACK_REASONS.NO_PIECES);
  if (!toMoney(line.quantity).equals(line.pieceCount)) return itemPriced(PIECE_FALLBACK_REASONS.PIECE_COUNT_MISMATCH);
  return { itemBasis: MONEY_BASIS.ROLLUP, pieceBasis: MONEY_BASIS.PRICED, fallbackReason: null };
}

// ─── Row money ─────────────────────────────────────────────────────────────

/** The §6.1 amount columns of one item or piece row. */
export interface RowMoney {
  /** `list_unit_price` */
  listUnitPrice: Money;
  /** `price_per_unit` */
  unitPrice: Money;
  /** `speed_premium_amount` */
  speedPremiumAmount: Money;
  /** `service_pref_charge`: included extras. */
  includedModifierAmount: Money;
  /** `total_price` */
  grossAmount: Money;
  /** `line_disc_amount` */
  lineDiscountAmount: Money;
  /** `order_disc_alloc_amount` */
  orderDiscountAllocAmount: Money;
  /** `net_amount` = gross − line discount − order share (I5) */
  netAmount: Money;
  taxableAmount: Money;
  taxAmount: Money;
  /** `line_total_amount` = net + tax (exclusive) or net (inclusive) (I5) */
  lineTotalAmount: Money;
}

/** The amounts that are split or summed; every other figure is derived from them. */
const SPLIT_KEYS = [
  'speedPremiumAmount',
  'includedModifierAmount',
  'grossAmount',
  'lineDiscountAmount',
  'orderDiscountAllocAmount',
  'taxAmount',
] as const;
type SplitKey = (typeof SPLIT_KEYS)[number];

/**
 * Builds a full row from its split amounts, deriving the identities (I5).
 * @param amounts the split amounts and the unit prices
 * @param pricingMode the order's `tax_pricing_mode`
 * @returns the row with `netAmount`, `taxableAmount` and `lineTotalAmount` derived
 */
export function buildRowMoney(
  amounts: Pick<RowMoney, SplitKey | 'listUnitPrice' | 'unitPrice'>,
  pricingMode: TaxPricingMode,
): RowMoney {
  const netAmount = amounts.grossAmount.minus(amounts.lineDiscountAmount).minus(amounts.orderDiscountAllocAmount);
  const inclusive = pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE;
  return {
    ...amounts,
    netAmount,
    taxableAmount: inclusive ? netAmount.minus(amounts.taxAmount) : netAmount,
    lineTotalAmount: inclusive ? netAmount : netAmount.plus(amounts.taxAmount),
  };
}

const invariantFailed = (message: string, details: Record<string, string>) =>
  new CommercialRuleError(COMMERCIAL_ERROR_CODES.COMMERCIAL_INVARIANT_FAILED, message, details);

/**
 * ITEM level (and the PIECE fallback): splits a priced item into exact piece shares (I1).
 *
 * The gross is split by the piece weights. Every other amount is split by the
 * shares of the amount it comes out of: the premium, extras and line discount
 * by the gross shares, the order share by what is left after the line
 * discount, the tax by the net shares. Largest remainder is not monotone (a
 * piece can get a bigger share of a smaller total when both use the same
 * weights), so this chaining is what keeps every share within its parent and
 * every piece's net and taxable at or above zero. Ties go to the earlier
 * piece, so callers pass pieces by `piece_seq`, then id. Pieces copy the
 * item's unit prices (one piece = one unit).
 * @param item the priced item row
 * @param pieceWeights one non-negative weight per piece (e.g. 1 each, or each piece's own gross)
 * @param pricingMode the order's `tax_pricing_mode`
 * @param decimalPlaces currency decimals (every amount is already at or below them)
 * @returns one row per piece, in input order
 * @throws CommercialRuleError COMMERCIAL_INVARIANT_FAILED if a piece still ends below zero (a guard; the chaining prevents it)
 */
export function allocateItemToPieces(
  item: RowMoney,
  pieceWeights: readonly MoneyInput[],
  pricingMode: TaxPricingMode,
  decimalPlaces: number,
): RowMoney[] {
  if (pieceWeights.length === 0) return [];
  const split = (total: Money, weights: readonly MoneyInput[]) => allocateLargestRemainder(total, weights, decimalPlaces);
  const gross = split(item.grossAmount, pieceWeights);
  const lineDisc = split(item.lineDiscountAmount, gross);
  const afterLine = gross.map((g, i) => g.minus(lineDisc[i]));
  const orderAlloc = split(item.orderDiscountAllocAmount, afterLine);
  const net = afterLine.map((a, i) => a.minus(orderAlloc[i]));
  const shares: Record<SplitKey, Money[]> = {
    grossAmount: gross,
    speedPremiumAmount: split(item.speedPremiumAmount, gross),
    includedModifierAmount: split(item.includedModifierAmount, gross),
    lineDiscountAmount: lineDisc,
    orderDiscountAllocAmount: orderAlloc,
    taxAmount: split(item.taxAmount, net),
  };

  return pieceWeights.map((_, i) => {
    const row = buildRowMoney({
      listUnitPrice: item.listUnitPrice,
      unitPrice: item.unitPrice,
      ...(Object.fromEntries(SPLIT_KEYS.map((key) => [key, shares[key][i]])) as Record<SplitKey, Money>),
    }, pricingMode);
    if (row.netAmount.isNegative() || row.taxableAmount.isNegative()) {
      throw invariantFailed(`Piece ${i + 1}'s share leaves a negative net.`, { piece: String(i + 1), net: row.netAmount.toString() });
    }
    return row;
  });
}

/**
 * PIECE level: the item is the exact sum of its priced pieces (I2).
 *
 * The item's `price_per_unit` is the pieces' unit price when they all share
 * one; otherwise the average (gross base ÷ quantity), rounded once, for
 * display only (the totals never use it).
 * @param pieces the priced piece rows
 * @param quantity the item quantity (equals the piece count at PIECE level)
 * @param pricingMode the order's `tax_pricing_mode`
 * @param rounding the currency rule, for the average unit price
 * @returns the item row
 */
export function rollupPiecesToItem(
  pieces: readonly RowMoney[],
  quantity: MoneyInput,
  pricingMode: TaxPricingMode,
  rounding: RoundingRule,
): RowMoney {
  if (pieces.length === 0) throw new Error('Cannot roll up an item with no pieces.');
  const sum = (key: SplitKey) => sumMoney(pieces.map((p) => p[key]));
  const same = (key: 'listUnitPrice' | 'unitPrice') => pieces.every((p) => p[key].equals(pieces[0][key]));
  const average = (key: 'listUnitPrice' | 'unitPrice') =>
    same(key) ? pieces[0][key] : roundMoney(sumMoney(pieces.map((p) => p[key])).dividedBy(toMoney(quantity)), rounding);
  return buildRowMoney({
    listUnitPrice: average('listUnitPrice'),
    unitPrice: average('unitPrice'),
    ...(Object.fromEntries(SPLIT_KEYS.map((key) => [key, sum(key)])) as Record<SplitKey, Money>),
  }, pricingMode);
}
