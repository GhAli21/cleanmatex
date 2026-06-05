import { Decimal } from '@prisma/client/runtime/library';
import {
  classifyRefunds,
  type RefundFactRow,
} from '@/lib/services/order-financial-write.service';

/**
 * Phase 6 (ADR-030) — Refund source-lineage classification.
 *
 * classifyRefunds() routes each PROCESSED refund row into one of four buckets:
 *   • realPaymentRefundedAmount    — REAL_PAYMENT_REFUND
 *   • storedValueRestoredAmount    — GIFT_CARD_RESTORE | WALLET_RESTORE | CUSTOMER_ADVANCE_RESTORE
 *   • customerCreditIssuedAmount   — CUSTOMER_CREDIT_ISSUE | CREDIT_NOTE_ISSUE
 *   • hasUnclassifiedRefundSource  — MANUAL_EXCEPTION (flag only, no amount bucket)
 *
 * It also sums reopens_due_amount across every PROCESSED row regardless of source type.
 *
 * Non-PROCESSED rows (PENDING, APPROVED, REJECTED) must be skipped entirely.
 */

function makeRefund(overrides: Partial<RefundFactRow> & { refund_amount: number }): RefundFactRow {
  return {
    refund_amount: new Decimal(overrides.refund_amount),
    refund_status: overrides.refund_status ?? 'PROCESSED',
    refund_method_code: overrides.refund_method_code ?? null,
    original_payment_id: overrides.original_payment_id ?? null,
    refund_source_type: overrides.refund_source_type ?? null,
    reopens_due_amount: overrides.reopens_due_amount != null
      ? new Decimal(overrides.reopens_due_amount)
      : new Decimal(0),
    metadata: overrides.metadata ?? {},
  };
}

describe('classifyRefunds — canonical refund_source_type path (Phase 6+)', () => {

  describe('REAL_PAYMENT_REFUND routing', () => {
    it('credits realPaymentRefundedAmount for REAL_PAYMENT_REFUND', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 50, refund_source_type: 'REAL_PAYMENT_REFUND' }),
      ]);
      expect(result.realPaymentRefundedAmount).toBe(50);
      expect(result.storedValueRestoredAmount).toBe(0);
      expect(result.customerCreditIssuedAmount).toBe(0);
      expect(result.hasUnclassifiedRefundSource).toBe(false);
    });
  });

  describe('stored-value restore routing', () => {
    it('credits storedValueRestoredAmount for GIFT_CARD_RESTORE', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 30, refund_source_type: 'GIFT_CARD_RESTORE' }),
      ]);
      expect(result.storedValueRestoredAmount).toBe(30);
      expect(result.realPaymentRefundedAmount).toBe(0);
    });

    it('credits storedValueRestoredAmount for WALLET_RESTORE', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 20, refund_source_type: 'WALLET_RESTORE' }),
      ]);
      expect(result.storedValueRestoredAmount).toBe(20);
    });

    it('credits storedValueRestoredAmount for CUSTOMER_ADVANCE_RESTORE', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 15, refund_source_type: 'CUSTOMER_ADVANCE_RESTORE' }),
      ]);
      expect(result.storedValueRestoredAmount).toBe(15);
    });
  });

  describe('customer-credit routing', () => {
    it('credits customerCreditIssuedAmount for CUSTOMER_CREDIT_ISSUE', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 40, refund_source_type: 'CUSTOMER_CREDIT_ISSUE' }),
      ]);
      expect(result.customerCreditIssuedAmount).toBe(40);
      expect(result.realPaymentRefundedAmount).toBe(0);
    });

    it('credits customerCreditIssuedAmount for CREDIT_NOTE_ISSUE', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 25, refund_source_type: 'CREDIT_NOTE_ISSUE' }),
      ]);
      expect(result.customerCreditIssuedAmount).toBe(25);
    });
  });

  describe('MANUAL_EXCEPTION routing', () => {
    it('sets hasUnclassifiedRefundSource = true for MANUAL_EXCEPTION', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 10, refund_source_type: 'MANUAL_EXCEPTION' }),
      ]);
      expect(result.hasUnclassifiedRefundSource).toBe(true);
      expect(result.realPaymentRefundedAmount).toBe(0);
      expect(result.storedValueRestoredAmount).toBe(0);
      expect(result.customerCreditIssuedAmount).toBe(0);
      expect(result.refundedAmount).toBe(10);
    });
  });

  describe('refundedAmount total', () => {
    it('sums refundedAmount across all PROCESSED rows regardless of source type', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 50, refund_source_type: 'REAL_PAYMENT_REFUND' }),
        makeRefund({ refund_amount: 30, refund_source_type: 'GIFT_CARD_RESTORE' }),
        makeRefund({ refund_amount: 10, refund_source_type: 'MANUAL_EXCEPTION' }),
      ]);
      expect(result.refundedAmount).toBe(90);
    });
  });

  describe('reopens_due_amount summing', () => {
    it('sums reopens_due_amount across all PROCESSED rows', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 100, refund_source_type: 'REAL_PAYMENT_REFUND', reopens_due_amount: 100 }),
        makeRefund({ refund_amount: 50, refund_source_type: 'GIFT_CARD_RESTORE', reopens_due_amount: 0 }),
        makeRefund({ refund_amount: 25, refund_source_type: 'CREDIT_NOTE_ISSUE', reopens_due_amount: 25 }),
      ]);
      expect(result.refundReopensDueAmount).toBe(125);
    });

    it('treats null reopens_due_amount as 0', () => {
      const row: RefundFactRow = {
        ...makeRefund({ refund_amount: 50, refund_source_type: 'REAL_PAYMENT_REFUND' }),
        reopens_due_amount: null,
      };
      const result = classifyRefunds([row]);
      expect(result.refundReopensDueAmount).toBe(0);
    });

    it('refundReopensDueAmount is 0 when no PROCESSED rows exist', () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 50, refund_status: 'PENDING_APPROVAL', refund_source_type: 'REAL_PAYMENT_REFUND', reopens_due_amount: 50 }),
      ]);
      expect(result.refundReopensDueAmount).toBe(0);
    });
  });
});

describe('classifyRefunds — non-PROCESSED rows are skipped', () => {
  const statuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];

  statuses.forEach((status) => {
    it(`skips row with status ${status}`, () => {
      const result = classifyRefunds([
        makeRefund({ refund_amount: 100, refund_status: status, refund_source_type: 'REAL_PAYMENT_REFUND' }),
      ]);
      expect(result.refundedAmount).toBe(0);
      expect(result.realPaymentRefundedAmount).toBe(0);
      expect(result.refundReopensDueAmount).toBe(0);
    });
  });
});

describe('classifyRefunds — legacy heuristic fallback (null refund_source_type)', () => {
  /**
   * Pre-0340 rows may have refund_source_type = NULL.
   * The legacy heuristic uses refund_method_code and metadata to classify.
   * Post-backfill these should not occur, but the fallback is retained.
   */

  it('classifies CASH method as realPaymentRefundedAmount', () => {
    const result = classifyRefunds([
      makeRefund({ refund_amount: 60, refund_source_type: null, refund_method_code: 'CASH' }),
    ]);
    expect(result.realPaymentRefundedAmount).toBe(60);
  });

  it('classifies ORIGINAL_METHOD as realPaymentRefundedAmount', () => {
    const result = classifyRefunds([
      makeRefund({ refund_amount: 40, refund_source_type: null, refund_method_code: 'ORIGINAL_METHOD' }),
    ]);
    expect(result.realPaymentRefundedAmount).toBe(40);
  });

  it('classifies WALLET method as storedValueRestoredAmount', () => {
    const result = classifyRefunds([
      makeRefund({ refund_amount: 20, refund_source_type: null, refund_method_code: 'WALLET' }),
    ]);
    expect(result.storedValueRestoredAmount).toBe(20);
  });

  it('classifies CREDIT_NOTE method as customerCreditIssuedAmount', () => {
    const result = classifyRefunds([
      makeRefund({ refund_amount: 15, refund_source_type: null, refund_method_code: 'CREDIT_NOTE' }),
    ]);
    expect(result.customerCreditIssuedAmount).toBe(15);
  });

  it('sets hasUnclassifiedRefundSource when method is unrecognised', () => {
    const result = classifyRefunds([
      makeRefund({ refund_amount: 5, refund_source_type: null, refund_method_code: 'UNKNOWN' }),
    ]);
    expect(result.hasUnclassifiedRefundSource).toBe(true);
  });
});

describe('classifyRefunds — empty input', () => {
  it('returns all-zero result for an empty array', () => {
    const result = classifyRefunds([]);
    expect(result.refundedAmount).toBe(0);
    expect(result.realPaymentRefundedAmount).toBe(0);
    expect(result.storedValueRestoredAmount).toBe(0);
    expect(result.customerCreditIssuedAmount).toBe(0);
    expect(result.hasUnclassifiedRefundSource).toBe(false);
    expect(result.refundReopensDueAmount).toBe(0);
  });
});
