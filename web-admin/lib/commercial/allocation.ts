/**
 * Largest-remainder allocation (ADR-060 §4, PLAN.md §5.2).
 *
 * Why: when one amount is split across rows (an item over its pieces, an
 * order discount over lines, a document tax over rows), the rounded shares
 * must add up to the total exactly (invariant I1). Rounding each share on its
 * own loses or invents minor units (FD-02: 10 ÷ 3 stored as 9.9999).
 */
import { MoneyDecimal, ZERO, sumMoney, toMoney, type Money, type MoneyInput } from './money';

/**
 * Splits `total` across rows in proportion to `weights`, at `decimalPlaces`,
 * so the shares sum to `total` exactly.
 *
 * Each share is first truncated towards zero; the leftover minor units go one
 * each to the rows with the largest truncated-away remainder. Ties go to the
 * earlier row, so callers fix the tie-break by ordering (PLAN.md §5.2: pieces
 * by `piece_seq`, then `id`). All-zero weights split equally.
 * @param total amount to split; must already be at `decimalPlaces`
 * @param weights one non-negative weight per row
 * @param decimalPlaces output precision
 * @returns one share per row, in input order
 * @throws Error on an empty weight list, a negative weight, or a total with more decimals than `decimalPlaces`
 * @example
 * allocateLargestRemainder('10', ['1', '1', '1'], 4).map(String); // ['3.3334', '3.3333', '3.3333']
 */
export function allocateLargestRemainder(
  total: MoneyInput,
  weights: readonly MoneyInput[],
  decimalPlaces: number,
): Money[] {
  if (weights.length === 0) throw new Error('Cannot allocate across zero rows.');
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new Error(`Invalid decimal places: ${decimalPlaces}`);
  }
  const amount = toMoney(total);
  if (amount.decimalPlaces() > decimalPlaces) {
    throw new Error(`Total ${amount.toString()} has more than ${decimalPlaces} decimals; round it first.`);
  }
  const parsed = weights.map((weight) => toMoney(weight));
  if (parsed.some((weight) => weight.isNegative())) throw new Error('Allocation weights must be non-negative.');

  const weightSum = sumMoney(parsed);
  const effective = weightSum.isZero() ? parsed.map(() => new MoneyDecimal(1)) : parsed;
  const effectiveSum = weightSum.isZero() ? new MoneyDecimal(parsed.length) : weightSum;

  const unit = new MoneyDecimal(10).pow(-decimalPlaces);
  const exact = effective.map((weight) => amount.times(weight).dividedBy(effectiveSum));
  const shares = exact.map((share) => share.toDecimalPlaces(decimalPlaces, MoneyDecimal.ROUND_DOWN));

  // Leftover in whole units; its sign follows the total (negative totals hand out -unit).
  const leftoverUnits = amount.minus(sumMoney(shares)).dividedBy(unit).toNumber();
  const step = leftoverUnits >= 0 ? unit : unit.negated();
  const order = exact
    .map((share, index) => ({ index, remainder: share.minus(shares[index]).abs() }))
    .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);

  for (let k = 0; k < Math.abs(leftoverUnits); k += 1) {
    const { index } = order[k % order.length];
    shares[index] = shares[index].plus(step);
  }
  return shares.map((share) => (share.isZero() ? ZERO : share));
}

/**
 * Splits a grid exactly: every row adds up to its row total and every column
 * to its column total, each cell within one minor unit of its exact share.
 *
 * Why: under DOCUMENT_LEVEL each order discount (a row) is stored per tax
 * category (a column). Splitting row by row keeps the rows exact but can
 * miss the category totals by a unit, and the other way round; an integer
 * grid with both margins always exists, so it is found directly. Cells
 * start at their exact share rounded down; the leftover units are placed by
 * augmenting paths (each cell takes at most one unit), larger remainders first,
 * then earlier rows and columns, so the result is deterministic.
 * @param rowTotals non-negative row totals at `decimalPlaces`
 * @param columnTotals non-negative column totals at `decimalPlaces`, with the same sum
 * @param decimalPlaces output precision
 * @returns `cells[row][column]`
 * @throws Error on empty input, negative or over-precise totals, or unequal sums
 * @example
 * allocateMatrix(['0.6', '0.4'], ['0.7', '0.3'], 3).map((r) => r.map(String)); // [['0.42','0.18'],['0.28','0.12']]
 */
export function allocateMatrix(
  rowTotals: readonly MoneyInput[],
  columnTotals: readonly MoneyInput[],
  decimalPlaces: number,
): Money[][] {
  if (rowTotals.length === 0 || columnTotals.length === 0) throw new Error('Cannot allocate an empty grid.');
  const rows = rowTotals.map((v) => toMoney(v));
  const cols = columnTotals.map((v) => toMoney(v));
  for (const value of [...rows, ...cols]) {
    if (value.isNegative()) throw new Error('Grid totals must be non-negative.');
    if (value.decimalPlaces() > decimalPlaces) throw new Error(`Total ${value.toString()} has more than ${decimalPlaces} decimals.`);
  }
  const total = sumMoney(rows);
  if (!total.equals(sumMoney(cols))) throw new Error(`Row totals ${total.toString()} and column totals ${sumMoney(cols).toString()} differ.`);
  if (total.isZero()) return rows.map(() => cols.map(() => ZERO));

  const unit = new MoneyDecimal(10).pow(-decimalPlaces);
  const exact = rows.map((r) => cols.map((c) => r.times(c).dividedBy(total)));
  const cells = exact.map((row) => row.map((x) => x.toDecimalPlaces(decimalPlaces, MoneyDecimal.ROUND_DOWN)));
  const rowNeed = rows.map((r, i) => r.minus(sumMoney(cells[i])).dividedBy(unit).toNumber());
  const colNeed = cols.map((c, j) => c.minus(sumMoney(cells.map((row) => row[j]))).dividedBy(unit).toNumber());
  // Cells that may take one more unit (their exact share is not whole), best remainder first.
  const candidates = exact.map((row, i) => row
    .map((x, j) => ({ j, remainder: x.minus(cells[i][j]) }))
    .filter((c) => !c.remainder.isZero())
    .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.j - b.j)
    .map((c) => c.j));
  const added = rows.map(() => cols.map(() => false));

  // Augmenting path from row i: take an untaken cell (i, j); if column j is
  // full, free one unit there by moving another row's unit elsewhere.
  const augment = (i: number, seenCols: Set<number>): boolean => {
    for (const j of candidates[i]) {
      if (added[i][j] || seenCols.has(j)) continue;
      seenCols.add(j);
      if (colNeed[j] > 0) {
        added[i][j] = true;
        colNeed[j] -= 1;
        return true;
      }
      for (let k = 0; k < rows.length; k += 1) {
        if (k !== i && added[k][j]) {
          added[k][j] = false;
          if (augment(k, seenCols)) {
            added[i][j] = true;
            return true;
          }
          added[k][j] = true;
        }
      }
    }
    return false;
  };
  rowNeed.forEach((need, i) => {
    for (let n = 0; n < need; n += 1) {
      if (!augment(i, new Set())) throw new Error('No exact grid split exists for these totals.');
    }
  });
  return cells.map((row, i) => row.map((cell, j) => (added[i][j] ? cell.plus(unit) : cell)));
}
