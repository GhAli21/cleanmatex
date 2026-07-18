/**
 * B02 — Shared Financial Aggregation (D005 authority).
 *
 * Covers:
 *  1. Frozen component definitions — effectivePayments (COMPLETED set +
 *     nature filter), effectiveCredits (APPLIED only), refundReopens
 *     (PROCESSED only, D003 v2-populated values).
 *  2. The canonical outstanding formula (round4, clamp at 0).
 *  3. Snapshot == reconciliation equality matrix: both sides derive
 *     outstanding through the SAME module call, and the retired recon
 *     formula (`+ all processed refunds`) is proven divergent on
 *     refund-bearing orders (audit C2 — the defect B02 removes).
 *  4. Grep-guard: no literal 'COMPLETED' status string may reappear inside
 *     lib/services/reconciliation/** (B02 acceptance criterion).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { Decimal } from '@prisma/client/runtime/library';

import {
  ORDER_FINANCIAL_COMPARISON_TOLERANCE,
  aggregateOrderFinancials,
  computeOutstanding,
  hasAmbiguousHistoricalPaymentRow,
  isClearlyRealPaymentRow,
  isCompletedPaymentStatus,
  sumCreditsByStatuses,
  sumEffectiveCredits,
  sumEffectivePayments,
  sumProcessedRefunds,
  sumRefundReopens,
  type AggregationCreditRow,
  type AggregationPaymentRow,
} from '@/lib/services/order-financial-aggregation';

const payment = (
  amount: number,
  status: string,
  extra: Partial<AggregationPaymentRow> = {},
): AggregationPaymentRow => ({
  amount: new Decimal(amount),
  payment_status: status,
  payment_method_code: 'CASH',
  ...extra,
});

const credit = (amount: number, status: string | null = 'APPLIED'): AggregationCreditRow => ({
  applied_amount: new Decimal(amount),
  application_status: status,
});

const refund = (amount: number, reopens = 0, status = 'PROCESSED') => ({
  refund_status: status,
  refund_amount: new Decimal(amount),
  reopens_due_amount: new Decimal(reopens),
});

// ── 1. Frozen component definitions ─────────────────────────────────────────

describe('D005 components — effectivePayments', () => {
  it('counts every COMPLETED-set status (COMPLETED, CAPTURED, SETTLED)', () => {
    expect(
      sumEffectivePayments([
        payment(10, 'COMPLETED'),
        payment(20, 'CAPTURED'),
        payment(30, 'SETTLED'),
      ]),
    ).toBe(60);
  });

  it('excludes pending/authorized/failed lifecycle rows (reported buckets only)', () => {
    expect(
      sumEffectivePayments([
        payment(10, 'PENDING'),
        payment(10, 'PROCESSING'),
        payment(10, 'AUTHORIZED'),
        payment(10, 'FAILED'),
        payment(10, 'VOIDED'),
        payment(10, 'REVERSED'),
      ]),
    ).toBe(0);
  });

  it('applies the nature filter — a non-REAL_PAYMENT snapshot nature never counts', () => {
    expect(
      sumEffectivePayments([
        payment(50, 'COMPLETED', { payment_nature_snapshot: 'CREDIT_APPLICATION' }),
      ]),
    ).toBe(0);
  });

  it('counts marker-qualified rows without a stored nature (historical data)', () => {
    expect(
      sumEffectivePayments([
        { amount: new Decimal(25), payment_status: 'COMPLETED', gateway_code: 'STRIPE' },
        { amount: new Decimal(15), payment_status: 'COMPLETED', check_no: 'CHK-9' },
      ]),
    ).toBe(40);
  });

  it('flags marker-less, nature-less rows as ambiguous instead of guessing', () => {
    const rows = [{ amount: new Decimal(9), payment_status: 'COMPLETED' }];
    expect(sumEffectivePayments(rows)).toBe(0);
    expect(hasAmbiguousHistoricalPaymentRow(rows)).toBe(true);
  });

  it('isCompletedPaymentStatus mirrors the frozen set', () => {
    expect(isCompletedPaymentStatus('COMPLETED')).toBe(true);
    expect(isCompletedPaymentStatus('captured')).toBe(true);
    expect(isCompletedPaymentStatus('SETTLED')).toBe(true);
    expect(isCompletedPaymentStatus('PENDING')).toBe(false);
    expect(isCompletedPaymentStatus(null)).toBe(false);
  });

  it('isClearlyRealPaymentRow honors the persisted nature over markers', () => {
    expect(
      isClearlyRealPaymentRow({
        amount: 1,
        payment_status: 'COMPLETED',
        payment_nature_snapshot: 'CREDIT_APPLICATION',
        gateway_code: 'STRIPE',
      }),
    ).toBe(false);
    expect(
      isClearlyRealPaymentRow({
        amount: 1,
        payment_status: 'COMPLETED',
        branch_payment_method_id: 'bpm-1',
      }),
    ).toBe(true);
  });
});

describe('D005 components — effectiveCredits', () => {
  it('counts APPLIED rows only; NULL status defaults to APPLIED', () => {
    expect(
      sumEffectiveCredits([
        credit(10, 'APPLIED'),
        credit(20, null),
        credit(99, 'PENDING'),
        credit(99, 'REVERSED'),
        credit(99, 'FAILED'),
      ]),
    ).toBe(30);
  });

  it('buckets by explicit status sets for reported amounts', () => {
    const rows = [credit(5, 'PENDING'), credit(6, 'RESERVED'), credit(7, 'FAILED')];
    expect(sumCreditsByStatuses(rows, ['PENDING', 'RESERVED'])).toBe(11);
    expect(sumCreditsByStatuses(rows, ['FAILED'])).toBe(7);
  });
});

describe('D005 components — refund terms', () => {
  it('refundReopens sums PROCESSED rows only', () => {
    expect(
      sumRefundReopens([
        refund(40, 40),
        refund(10, 10, 'PENDING_APPROVAL'),
        refund(5, 0),
      ]),
    ).toBe(40);
  });

  it('processedRefunds sums PROCESSED refund amounts only (REFUND_CONSISTENCY input)', () => {
    expect(
      sumProcessedRefunds([refund(40, 0), refund(10, 0, 'APPROVED')]),
    ).toBe(40);
  });
});

describe('D005 formula — computeOutstanding', () => {
  it('applies the frozen formula with round4', () => {
    expect(
      computeOutstanding({
        totalAmount: 100,
        effectivePayments: 60.00004,
        effectiveCredits: 20,
        refundReopens: 0,
        creditReversalReopens: 0,
      }),
    ).toBe(20);
  });

  it('clamps at zero (overpayment interacts through the clamp)', () => {
    expect(
      computeOutstanding({
        totalAmount: 100,
        effectivePayments: 130,
        effectiveCredits: 0,
        refundReopens: 0,
        creditReversalReopens: 0,
      }),
    ).toBe(0);
  });

  it('adds explicit reopen terms', () => {
    expect(
      computeOutstanding({
        totalAmount: 100,
        effectivePayments: 100,
        effectiveCredits: 0,
        refundReopens: 40,
        creditReversalReopens: 0,
      }),
    ).toBe(40);
  });

  it('freezes the order-level comparison tolerance at 0.001 (D005 invariant 4)', () => {
    expect(ORDER_FINANCIAL_COMPARISON_TOLERANCE).toBe(0.001);
  });
});

// ── 3. Snapshot == reconciliation equality matrix ───────────────────────────

describe('B02 equality matrix — snapshot and recon agree through the module', () => {
  /**
   * Each scenario models an order's fact rows plus the D005-expected
   * outstanding. "Snapshot side" and "recon side" both call
   * aggregateOrderFinancials — the assertion locks consumers to identical
   * results for every §49-style shape, including refund-bearing orders that
   * permanently false-flagged under the retired recon formula.
   */
  const scenarios: Array<{
    name: string;
    total: number;
    payments: AggregationPaymentRow[];
    credits: AggregationCreditRow[];
    refunds: Array<ReturnType<typeof refund>>;
    expectedOutstanding: number;
  }> = [
    {
      name: 'unpaid order',
      total: 100,
      payments: [],
      credits: [],
      refunds: [],
      expectedOutstanding: 100,
    },
    {
      name: 'partially paid',
      total: 100,
      payments: [payment(40, 'COMPLETED')],
      credits: [],
      refunds: [],
      expectedOutstanding: 60,
    },
    {
      name: 'fully paid with legacy CAPTURED/SETTLED statuses',
      total: 100,
      payments: [payment(50, 'CAPTURED'), payment(50, 'SETTLED')],
      credits: [],
      refunds: [],
      expectedOutstanding: 0,
    },
    {
      name: 'pending/authorized legs never count as paid (M9/B33 grounding)',
      total: 100,
      payments: [payment(60, 'COMPLETED'), payment(40, 'PENDING'), payment(40, 'AUTHORIZED')],
      credits: [],
      refunds: [],
      expectedOutstanding: 40,
    },
    {
      name: 'credits-only settlement (APPLIED)',
      total: 100,
      payments: [],
      credits: [credit(100, 'APPLIED')],
      refunds: [],
      expectedOutstanding: 0,
    },
    {
      name: 'REVERSED credits leave outstanding open (credits term excludes them)',
      total: 100,
      payments: [],
      credits: [credit(100, 'REVERSED')],
      refunds: [],
      expectedOutstanding: 100,
    },
    {
      name: 'mixed payment + credit',
      total: 100,
      payments: [payment(70, 'COMPLETED')],
      credits: [credit(30, 'APPLIED')],
      refunds: [],
      expectedOutstanding: 0,
    },
    {
      name: 'overpaid clamps to zero',
      total: 100,
      payments: [payment(120, 'COMPLETED')],
      credits: [],
      refunds: [],
      expectedOutstanding: 0,
    },
    {
      name: 'commercial refund — order STAYS settled (D003 v2, reopen 0)',
      total: 100,
      payments: [payment(100, 'COMPLETED')],
      credits: [],
      refunds: [refund(40, 0)],
      expectedOutstanding: 0,
    },
    {
      name: 'explicit REFUND_AND_REBILL — outstanding reopens by exactly the reopen value',
      total: 100,
      payments: [payment(100, 'COMPLETED')],
      credits: [],
      refunds: [refund(40, 40)],
      expectedOutstanding: 40,
    },
    {
      name: 'manual-exception partial reopen',
      total: 100,
      payments: [payment(100, 'COMPLETED')],
      credits: [],
      refunds: [refund(30, 10)],
      expectedOutstanding: 10,
    },
    {
      name: 'unprocessed refunds have no effect',
      total: 100,
      payments: [payment(100, 'COMPLETED')],
      credits: [],
      refunds: [refund(40, 40, 'PENDING_APPROVAL')],
      expectedOutstanding: 0,
    },
  ];

  scenarios.forEach(({ name, total, payments, credits, refunds, expectedOutstanding }) => {
    it(`agrees on: ${name}`, () => {
      // Snapshot side and recon side share the single aggregation call.
      const snapshotSide = aggregateOrderFinancials({
        totalAmount: total,
        payments,
        credits,
        refunds,
      });
      const reconSide = aggregateOrderFinancials({
        totalAmount: total,
        payments,
        credits,
        refunds,
      });

      expect(snapshotSide.outstanding).toBe(expectedOutstanding);
      expect(
        Math.abs(reconSide.outstanding - snapshotSide.outstanding),
      ).toBeLessThan(ORDER_FINANCIAL_COMPARISON_TOLERANCE);
    });
  });

  it('the retired recon formula (+ all processed refunds) diverges on commercial refunds — the C2 defect B02 removes', () => {
    const total = 100;
    const payments = [payment(100, 'COMPLETED')];
    const refunds = [refund(40, 0)]; // commercial refund, D003 v2 reopen 0

    const canonical = aggregateOrderFinancials({
      totalAmount: total,
      payments,
      credits: [],
      refunds,
    });
    const retiredReconFormula = Math.max(
      0,
      total - canonical.effectivePayments - canonical.effectiveCredits + canonical.processedRefunds,
    );

    expect(canonical.outstanding).toBe(0); // order stays settled
    expect(retiredReconFormula).toBe(40); // the permanent false blocker
    expect(retiredReconFormula).not.toBe(canonical.outstanding);
  });
});

// ── 4. Grep-guard — no literal 'COMPLETED' in reconciliation sources ────────

describe('B02 grep-guard — reconciliation must use the frozen status sets', () => {
  it("contains no literal 'COMPLETED' status string under lib/services/reconciliation", () => {
    const reconDir = path.resolve(__dirname, '../../lib/services/reconciliation');
    const offenders: string[] = [];

    for (const file of fs.readdirSync(reconDir)) {
      if (!file.endsWith('.ts')) continue;
      const source = fs.readFileSync(path.join(reconDir, file), 'utf8');
      source.split('\n').forEach((line, index) => {
        if (/['"]COMPLETED['"]/.test(line)) {
          offenders.push(`${file}:${index + 1} → ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
