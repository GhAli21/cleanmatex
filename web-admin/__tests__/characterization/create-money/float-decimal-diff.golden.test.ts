/**
 * P1-01 float -> decimal sign-off list (PLAN §4, rule #15).
 *
 * Today Create rounds money with `Number(x.toFixed(d))` on float products
 * (order-calculation `round`, tax-engine `roundAmount`, pricing
 * `roundMoneyAmount` on numbers). The Phase 4 calculator uses exact decimal
 * HALF_UP. This scan measures, over a deterministic grid, how many results
 * differ and pins the counts and the first examples, so the owner signs off
 * a known, bounded list. Every difference is exactly one minor unit, and the
 * decimal value is the correct one.
 *
 * Named cases from the other golden files: FD-01 (price 3.3335, pricing P09),
 * FD-02 (piece split 10/3, line-write W03), FD-03 (0.4 + 0.8, line-write W05).
 */

import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;

const today = (x: number, dp: number) => Number(x.toFixed(dp));
const exact = (x: Prisma.Decimal, dp: number) => x.toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber();

interface Scan {
  differences: number;
  total: number;
  maxGapMinorUnits: number;
  examples: string[];
}

/** Rate × base (tax, percent discount) for base = step, 2·step, … max·step. */
function scanRate(dp: number, step: string, count: number, ratesPercent: number[]): Scan {
  const unit = new D(1).div(new D(10).pow(dp));
  const out: Scan = { differences: 0, total: 0, maxGapMinorUnits: 0, examples: [] };
  for (let i = 1; i <= count; i++) {
    const base = new D(i).times(step);
    for (const rate of ratesPercent) {
      out.total++;
      const t = today(base.toNumber() * (rate / 100), dp);
      const e = exact(base.times(rate).div(100), dp);
      if (t !== e) {
        out.differences++;
        out.maxGapMinorUnits = Math.max(out.maxGapMinorUnits, new D(t).minus(e).abs().div(unit).toNumber());
        if (out.examples.length < 3) out.examples.push(`${base.toFixed(dp)} × ${rate}% -> today ${t}, decimal ${e}`);
      }
    }
  }
  return out;
}

/** Item total / quantity stored at 4 decimals (piece price). */
function scanPieceSplit(count: number, quantities: number[]): Scan {
  const out: Scan = { differences: 0, total: 0, maxGapMinorUnits: 0, examples: [] };
  for (let i = 1; i <= count; i++) {
    const total = new D(i).times('0.001');
    for (const q of quantities) {
      out.total++;
      const t = today(total.toNumber() / q, 4);
      const e = exact(total.div(q), 4);
      if (t !== e) {
        out.differences++;
        out.maxGapMinorUnits = Math.max(out.maxGapMinorUnits, new D(t).minus(e).abs().times(10000).toNumber());
        if (out.examples.length < 3) out.examples.push(`${total.toFixed(3)} / ${q} -> today ${t}, decimal ${e}`);
      }
    }
  }
  return out;
}

describe('P1-01 float -> decimal sign-off list', () => {
  it('FD-T1 OMR (3 decimals): rate × base for VAT 5%, 15%, 2% and a 10% discount, bases 0.001 … 30.000', () => {
    const s = scanRate(3, '0.001', 30000, [5, 15, 2, 10]);
    expect(s).toMatchSnapshot();
    expect(s.maxGapMinorUnits).toBeLessThanOrEqual(1);
  });

  it('FD-T2 SAR (2 decimals): the same rates, bases 0.01 … 300.00', () => {
    const s = scanRate(2, '0.01', 30000, [5, 15, 2, 10]);
    expect(s).toMatchSnapshot();
    expect(s.maxGapMinorUnits).toBeLessThanOrEqual(1);
  });

  it('FD-T3 piece split at 4 decimals: totals 0.001 … 20.000 over 3, 6 and 7 pieces', () => {
    const s = scanPieceSplit(20000, [3, 6, 7]);
    expect(s).toMatchSnapshot();
    expect(s.maxGapMinorUnits).toBeLessThanOrEqual(1);
  });
});
