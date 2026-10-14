import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectOrderChangeFinancialResult } from '@/lib/services/order-change/order-change-financial-result.service';
import type { AggregationPaymentRow } from '@/lib/services/order-financial-aggregation';

function payment(amount: string, status = 'COMPLETED'): AggregationPaymentRow {
  return { amount, payment_status: status, payment_nature_snapshot: 'REAL_PAYMENT' };
}

describe('projectOrderChangeFinancialResult', () => {
  it('classifies a lower total as overpayment and a higher total as outstanding without changing the payment', () => {
    const paid = payment('20.0000');
    const before = JSON.stringify(paid);
    const overpaid = projectOrderChangeFinancialResult({ projectedTotal: '15.0000', projectedTax: '0.0000', payments: [paid] });
    const underpaid = projectOrderChangeFinancialResult({ projectedTotal: '20.0000', projectedTax: '0.0000', payments: [payment('10.0000')] });
    const increased = projectOrderChangeFinancialResult({ projectedTotal: '25.0000', projectedTax: '0.0000', payments: [payment('20.0000')] });

    expect(overpaid).toMatchObject({ outcome: 'OVERPAYMENT', outstandingAmount: '0.0000', overpaidAmount: '5.0000', settlementMutated: false });
    expect(underpaid).toMatchObject({ outcome: 'OUTSTANDING', outstandingAmount: '10.0000', overpaidAmount: '0.0000' });
    expect(increased).toMatchObject({ outcome: 'OUTSTANDING', outstandingAmount: '5.0000' });
    expect(JSON.stringify(paid)).toBe(before);
  });

  it('counts a completed payment and applied credit once, and ignores a pending gateway payment', () => {
    const split = projectOrderChangeFinancialResult({
      projectedTotal: '15.0000',
      projectedTax: '0.0000',
      payments: [payment('10.0000')],
      credits: [{ applied_amount: '10.0000', application_status: 'APPLIED' }],
    });
    const pending = projectOrderChangeFinancialResult({
      projectedTotal: '20.0000',
      projectedTax: '0.0000',
      payments: [payment('20.0000', 'PENDING')],
    });

    expect(split).toMatchObject({ outcome: 'OVERPAYMENT', effectivePayments: '10.0000', effectiveCredits: '10.0000', overpaidAmount: '5.0000' });
    expect(pending).toMatchObject({ outcome: 'OUTSTANDING', effectivePayments: '0.0000', outstandingAmount: '20.0000' });
  });

  it('reopens the balance for a processed refund and reduces unresolved overpayment by an existing disposition', () => {
    const reopened = projectOrderChangeFinancialResult({
      projectedTotal: '20.0000',
      projectedTax: '0.0000',
      payments: [payment('20.0000')],
      refunds: [{ refund_status: 'PROCESSED', refund_amount: '5.0000', reopens_due_amount: '5.0000' }],
    });
    const disposed = projectOrderChangeFinancialResult({
      projectedTotal: '15.0000',
      projectedTax: '0.0000',
      payments: [payment('20.0000')],
      appliedDispositions: ['5.0000'],
    });

    expect(reopened).toMatchObject({ outcome: 'OUTSTANDING', outstandingAmount: '5.0000' });
    expect(disposed).toMatchObject({ outcome: 'SETTLED', overpaidAmount: '5.0000', unresolvedOverpayment: '0.0000' });
  });

  it('compares fiscal obligation with original plus corrections and refuses a duplicate or unsupported correction', () => {
    const documents = [
      { id: 'original', role: 'ORIGINAL' as const, amount: '20.0000', taxAmount: '2.0000' },
      { id: 'credit', role: 'CREDIT' as const, amount: '5.0000', taxAmount: '0.5000', changeRef: 'change-1' },
    ];
    const matched = projectOrderChangeFinancialResult({
      projectedTotal: '15.0000',
      projectedTax: '1.5000',
      payments: [payment('15.0000')],
      fiscalDocuments: documents,
      fiscalCorrectionSupported: true,
    });
    const duplicate = projectOrderChangeFinancialResult({
      projectedTotal: '15.0000',
      projectedTax: '1.5000',
      payments: [payment('15.0000')],
      fiscalDocuments: documents,
      fiscalCorrectionSupported: true,
      requestedChangeRef: 'change-1',
    });
    const denied = projectOrderChangeFinancialResult({
      projectedTotal: '15.0000',
      projectedTax: '1.5000',
      payments: [payment('15.0000')],
      fiscalDocuments: documents,
      fiscalCorrectionSupported: false,
      arIssued: true,
      arCorrectionSupported: false,
    });

    expect(matched).toMatchObject({ outcome: 'SETTLED', fiscalObligation: '15.0000' });
    expect(matched.warnings.map((warning) => warning.code)).not.toContain('FISCAL_OBLIGATION_DIFFERS');
    expect(duplicate.outcome).toBe('DENIED');
    expect(duplicate.warnings.map((warning) => warning.code)).toContain('DUPLICATE_CORRECTION');
    expect(denied.outcome).toBe('DENIED');
    expect(denied.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['FISCAL_CORRECTION_UNSUPPORTED', 'AR_CORRECTION_UNSUPPORTED']));
  });

  it('imports no financial writer', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/services/order-change/order-change-financial-result.service.ts'), 'utf8');
    expect(source).not.toMatch(/prisma|supabase|order-financial-write|ar-invoice|tax-document/);
  });
});
