/**
 * Money invariants I1–I6 checked on a whole calculated order (PLAN.md §5.2, P4-06).
 *
 * Why: each calculator step keeps its own figures exact, but only the whole
 * order shows whether they still fit together (pieces = item, header = rows,
 * one home per amount). Create, Edit and the recompute run this on the full
 * output before any write; a failure is a programming error, so nothing is
 * written (`COMMERCIAL_INVARIANT_FAILED`).
 *
 * All comparisons are exact: every figure is already a rounded decimal.
 */
import { DISC_ALLOC_MODES, MONEY_BASIS, type DiscAllocMode, type MoneyBasis } from '@/lib/constants/commercial';
import { TAX_PRICING_MODES, type TaxPricingMode } from '@/lib/constants/order-financial';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { ZERO, sumMoney, toMoney, type Money, type MoneyInput } from './money';
import type { RowMoney } from './levels';

/** The invariant codes, as numbered in PLAN.md §5.2. */
export const MONEY_INVARIANTS = {
  /** `ALLOCATED`: Σ pieces = item for every money column. */
  I1: 'I1',
  /** `ROLLUP`: item = Σ pieces for every money column. */
  I2: 'I2',
  /** Header total = Σ item totals + Σ separate charges − document-level discounts (with tax effect). */
  I3: 'I3',
  /** One home per amount: line, charge or document discount, never two. */
  I4: 'I4',
  /** Row identity: net = gross − line disc − order share; total = net + tax (exclusive) or net (inclusive). */
  I5: 'I5',
  /** Every line has the order's `tax_pricing_mode`. */
  I6: 'I6',
} as const;
/** Derived union of invariant codes. */
export type MoneyInvariant = (typeof MONEY_INVARIANTS)[keyof typeof MONEY_INVARIANTS];

/** One piece row as it will be written. */
export interface InvariantPiece {
  pieceId: string;
  moneyBasis: MoneyBasis;
  /** The row's `tax_pricing_mode`. */
  pricingMode: TaxPricingMode;
  money: RowMoney;
}

/** One item row and its pieces as they will be written. */
export interface InvariantItem {
  itemId: string;
  moneyBasis: MoneyBasis;
  pricingMode: TaxPricingMode;
  money: RowMoney;
  pieces: readonly InvariantPiece[];
}

/** One separate charge row (delivery, SEPARATE modifiers, order preference extras). */
export interface InvariantCharge {
  chargeId: string;
  netAmount: MoneyInput;
  taxAmount: MoneyInput;
  lineTotalAmount: MoneyInput;
}

/** A whole calculated order. */
export interface InvariantOrder {
  /** The order's `tax_pricing_mode` snapshot. */
  pricingMode: TaxPricingMode;
  /** The order's `disc_alloc_mode` snapshot. */
  discAllocMode: DiscAllocMode;
  items: readonly InvariantItem[];
  charges: readonly InvariantCharge[];
  /**
   * `DOCUMENT_LEVEL` allowance: its amount (Σ category shares) and its tax
   * effect (`lineTaxTotal − documentTaxTotal` from `calculateTax`). Both zero
   * under `ALLOCATE_TO_LINES`.
   */
  documentAllowance: { amount: MoneyInput; taxEffect: MoneyInput };
  /** The header `total_amount` the writer will store. */
  headerTotalAmount: MoneyInput;
}

/** One broken invariant, with the figures that broke it. */
export interface InvariantViolation {
  invariant: MoneyInvariant;
  /** The item, piece or charge id, or `ORDER` for header checks. */
  rowId: string;
  message: string;
  details: Record<string, string>;
}

/** The money columns that must add up between item and pieces (I1/I2). */
const PIECE_SUM_KEYS = [
  'speedPremiumAmount',
  'includedModifierAmount',
  'grossAmount',
  'lineDiscountAmount',
  'orderDiscountAllocAmount',
  'netAmount',
  'taxableAmount',
  'taxAmount',
  'lineTotalAmount',
] as const satisfies readonly (keyof RowMoney)[];

const ORDER_ROW = 'ORDER';

/** I5 on one row: the derived figures match its amounts. */
function rowIdentityViolations(rowId: string, row: RowMoney, inclusive: boolean): InvariantViolation[] {
  const net = row.grossAmount.minus(row.lineDiscountAmount).minus(row.orderDiscountAllocAmount);
  const total = inclusive ? row.netAmount : row.netAmount.plus(row.taxAmount);
  const taxable = inclusive ? row.netAmount.minus(row.taxAmount) : row.netAmount;
  const out: InvariantViolation[] = [];
  const check = (field: string, actual: Money, expected: Money) => {
    if (!actual.equals(expected)) {
      out.push({
        invariant: MONEY_INVARIANTS.I5, rowId,
        message: `Row ${rowId}: ${field} is ${actual.toString()}, expected ${expected.toString()}.`,
        details: { field, actual: actual.toString(), expected: expected.toString() },
      });
    }
  };
  check('netAmount', row.netAmount, net);
  check('taxableAmount', row.taxableAmount, taxable);
  check('lineTotalAmount', row.lineTotalAmount, total);
  return out;
}

/** I1/I2 on one item: its basis matches its pieces' basis, and the columns add up. */
function pieceSumViolations(item: InvariantItem): InvariantViolation[] {
  const { itemId, moneyBasis, pieces } = item;
  const invariant = moneyBasis === MONEY_BASIS.ROLLUP ? MONEY_INVARIANTS.I2 : MONEY_INVARIANTS.I1;
  const basisError = (message: string): InvariantViolation[] => [{
    invariant, rowId: itemId, message: `Item ${itemId}: ${message}`, details: { moneyBasis },
  }];

  if (moneyBasis === MONEY_BASIS.ALLOCATED) return basisError('an item row is never ALLOCATED.');
  if (moneyBasis === MONEY_BASIS.ROLLUP && pieces.length === 0) return basisError('a ROLLUP item has no pieces.');
  if (pieces.length === 0) return [];
  const expectedPieceBasis = moneyBasis === MONEY_BASIS.ROLLUP ? MONEY_BASIS.PRICED : MONEY_BASIS.ALLOCATED;
  const wrong = pieces.find((p) => p.moneyBasis !== expectedPieceBasis);
  if (wrong) return basisError(`piece ${wrong.pieceId} is ${wrong.moneyBasis}, expected ${expectedPieceBasis}.`);

  return PIECE_SUM_KEYS.flatMap((key) => {
    const pieceSum = sumMoney(pieces.map((p) => p.money[key]));
    if (pieceSum.equals(item.money[key])) return [];
    return [{
      invariant, rowId: itemId,
      message: `Item ${itemId}: Σ pieces ${key} is ${pieceSum.toString()}, item has ${item.money[key].toString()}.`,
      details: { field: key, item: item.money[key].toString(), pieces: pieceSum.toString() },
    }];
  });
}

/**
 * Checks a whole calculated order against I1–I6.
 * @param order the item, piece and charge rows, the allowance and the header total the writer will store
 * @returns every violation found, empty when the order is consistent
 * @example
 * checkMoneyInvariants({ pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'DOCUMENT_LEVEL', items: [], charges: [],
 *   documentAllowance: { amount: 0, taxEffect: 0 }, headerTotalAmount: 0 }); // []
 */
export function checkMoneyInvariants(order: InvariantOrder): InvariantViolation[] {
  const inclusive = order.pricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE;
  const violations: InvariantViolation[] = [];
  const push = (v: InvariantViolation) => violations.push(v);

  // ─── I6: every row has the order's pricing mode ─────────────────────────
  const modeCheck = (rowId: string, mode: TaxPricingMode) => {
    if (mode !== order.pricingMode) {
      push({
        invariant: MONEY_INVARIANTS.I6, rowId,
        message: `Row ${rowId} is ${mode}, the order is ${order.pricingMode}.`,
        details: { rowMode: mode, orderMode: order.pricingMode },
      });
    }
  };

  // ─── I4: one home per amount ────────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueCheck = (rowId: string) => {
    if (seen.has(rowId)) {
      push({ invariant: MONEY_INVARIANTS.I4, rowId, message: `Row ${rowId} appears twice.`, details: { rowId } });
    }
    seen.add(rowId);
  };
  const allowance = toMoney(order.documentAllowance.amount);
  const allowanceTaxEffect = toMoney(order.documentAllowance.taxEffect);
  const documentLevel = order.discAllocMode === DISC_ALLOC_MODES.DOCUMENT_LEVEL;
  if (!documentLevel && !(allowance.isZero() && allowanceTaxEffect.isZero())) {
    push({
      invariant: MONEY_INVARIANTS.I4, rowId: ORDER_ROW,
      message: `ALLOCATE_TO_LINES has a document allowance ${allowance.toString()} (tax effect ${allowanceTaxEffect.toString()}).`,
      details: { amount: allowance.toString(), taxEffect: allowanceTaxEffect.toString() },
    });
  }
  const shareCheck = (rowId: string, row: RowMoney) => {
    if (documentLevel && !row.orderDiscountAllocAmount.isZero()) {
      push({
        invariant: MONEY_INVARIANTS.I4, rowId,
        message: `Row ${rowId} carries an order-discount share ${row.orderDiscountAllocAmount.toString()} under DOCUMENT_LEVEL.`,
        details: { share: row.orderDiscountAllocAmount.toString() },
      });
    }
  };

  // ─── Rows ───────────────────────────────────────────────────────────────
  for (const item of order.items) {
    uniqueCheck(item.itemId);
    modeCheck(item.itemId, item.pricingMode);
    shareCheck(item.itemId, item.money);
    rowIdentityViolations(item.itemId, item.money, inclusive).forEach(push);
    for (const piece of item.pieces) {
      uniqueCheck(piece.pieceId);
      modeCheck(piece.pieceId, piece.pricingMode);
      shareCheck(piece.pieceId, piece.money);
      rowIdentityViolations(piece.pieceId, piece.money, inclusive).forEach(push);
    }
    pieceSumViolations(item).forEach(push);
  }
  for (const charge of order.charges) {
    uniqueCheck(charge.chargeId);
    const net = toMoney(charge.netAmount);
    const expected = inclusive ? net : net.plus(toMoney(charge.taxAmount));
    const actual = toMoney(charge.lineTotalAmount);
    if (!actual.equals(expected)) {
      push({
        invariant: MONEY_INVARIANTS.I5, rowId: charge.chargeId,
        message: `Charge ${charge.chargeId}: total is ${actual.toString()}, expected ${expected.toString()}.`,
        details: { field: 'lineTotalAmount', actual: actual.toString(), expected: expected.toString() },
      });
    }
  }

  // ─── I3: header = rows ──────────────────────────────────────────────────
  // Inclusive prices already hold the tax, so the allowance's tax effect stays inside it.
  const rows = sumMoney([
    ...order.items.map((i) => i.money.lineTotalAmount),
    ...order.charges.map((c) => toMoney(c.lineTotalAmount)),
  ]);
  const expectedHeader = rows.minus(allowance).minus(inclusive ? ZERO : allowanceTaxEffect);
  const header = toMoney(order.headerTotalAmount);
  if (!header.equals(expectedHeader)) {
    push({
      invariant: MONEY_INVARIANTS.I3, rowId: ORDER_ROW,
      message: `Header total is ${header.toString()}, the rows give ${expectedHeader.toString()}.`,
      details: { header: header.toString(), expected: expectedHeader.toString() },
    });
  }

  return violations;
}

/**
 * Throws when the order breaks any invariant; the writer calls this before writing.
 * @param order the whole calculated order
 * @throws CommercialRuleError COMMERCIAL_INVARIANT_FAILED, with the first violation's figures and the count
 */
export function assertMoneyInvariants(order: InvariantOrder): void {
  const violations = checkMoneyInvariants(order);
  if (violations.length === 0) return;
  const [first] = violations;
  throw new CommercialRuleError(COMMERCIAL_ERROR_CODES.COMMERCIAL_INVARIANT_FAILED, first.message, {
    invariant: first.invariant,
    rowId: first.rowId,
    violationCount: String(violations.length),
    ...first.details,
  });
}
