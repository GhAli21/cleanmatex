/**
 * Projected financial result for a future Preview or Apply.
 * Outstanding comes from the existing D005 aggregation. This function does not
 * write a payment, refund, voucher, invoice, or tax document.
 * Fiscal comparison uses the original document plus later credit and debit
 * documents. A single delta document is not treated as the new obligation.
 */

import {
  aggregateOrderFinancials,
  hasAmbiguousHistoricalPaymentRow,
  round4,
  type AggregationCreditRow,
  type AggregationPaymentRow,
} from '@/lib/services/order-financial-aggregation';

export type OrderChangeFinancialOutcome = 'SETTLED' | 'OUTSTANDING' | 'OVERPAYMENT' | 'DENIED';

export interface OrderChangeFiscalDocument {
  id: string;
  role: 'ORIGINAL' | 'CREDIT' | 'DEBIT';
  amount: string;
  taxAmount: string;
  /** Set when this document already corrects one Change. A second correction for that Change is refused. */
  changeRef?: string | null;
}

export interface OrderChangeFinancialResultInput {
  projectedTotal: string;
  projectedTax: string;
  payments: readonly AggregationPaymentRow[];
  credits?: readonly AggregationCreditRow[];
  refunds?: readonly Array<{ refund_status: string | null; refund_amount: string; reopens_due_amount: string }>;
  /** Amounts already applied to a prior overpayment. They do not alter payment rows. */
  appliedDispositions?: readonly string[];
  fiscalDocuments?: readonly OrderChangeFiscalDocument[];
  requestedChangeRef?: string;
  fiscalCorrectionSupported?: boolean;
  arIssued?: boolean;
  arCorrectionSupported?: boolean;
}

export interface OrderChangeFinancialWarning {
  severity: 'BLOCKING' | 'ADVISORY';
  code:
    | 'AMBIGUOUS_PAYMENT'
    | 'OVERPAYMENT_FOLLOW_UP'
    | 'OUTSTANDING_FOLLOW_UP'
    | 'DISPOSITION_EXCEEDS_OVERPAYMENT'
    | 'FISCAL_OBLIGATION_DIFFERS'
    | 'TAX_COMPOSITION_DIFFERS'
    | 'FISCAL_CORRECTION_UNSUPPORTED'
    | 'AR_CORRECTION_UNSUPPORTED'
    | 'AR_CORRECTION_OWNED_BY_AR'
    | 'DUPLICATE_CORRECTION';
}

export interface OrderChangeFinancialResult {
  outcome: OrderChangeFinancialOutcome;
  outstandingAmount: string;
  overpaidAmount: string;
  unresolvedOverpayment: string;
  effectivePayments: string;
  effectiveCredits: string;
  fiscalObligation: string;
  settlementMutated: false;
  warnings: OrderChangeFinancialWarning[];
}

function money(value: number): string {
  return round4(value).toFixed(4);
}

function signedFiscal(documents: readonly OrderChangeFiscalDocument[], field: 'amount' | 'taxAmount'): number {
  return round4(documents.reduce((sum, document) => {
    const amount = Number(document[field]);
    if (document.role === 'CREDIT') return sum - amount;
    return sum + amount;
  }, 0));
}

/**
 * Classifies the projected order total against immutable settlement and fiscal facts.
 * The payment and credit arrays are not copied or rewritten.
 */
export function projectOrderChangeFinancialResult(input: OrderChangeFinancialResultInput): OrderChangeFinancialResult {
  const aggregated = aggregateOrderFinancials({
    totalAmount: Number(input.projectedTotal),
    payments: [...input.payments],
    credits: [...(input.credits ?? [])],
    refunds: (input.refunds ?? []).map((refund) => ({
      refund_status: refund.refund_status,
      refund_amount: refund.refund_amount,
      reopens_due_amount: refund.reopens_due_amount,
    })),
  });
  const collected = round4(
    aggregated.effectivePayments
      + aggregated.effectiveCredits
      - aggregated.refundReopens
      - aggregated.creditReversalReopens,
  );
  const overpaid = Math.max(0, round4(collected - Number(input.projectedTotal)));
  const disposed = round4((input.appliedDispositions ?? []).reduce((sum, amount) => sum + Number(amount), 0));
  const unresolved = Math.max(0, round4(overpaid - disposed));
  const documents = input.fiscalDocuments ?? [];
  const fiscalObligation = documents.length === 0 ? Number(input.projectedTotal) : signedFiscal(documents, 'amount');
  const fiscalTax = documents.length === 0 ? Number(input.projectedTax) : signedFiscal(documents, 'taxAmount');
  const warnings: OrderChangeFinancialWarning[] = [];

  if (hasAmbiguousHistoricalPaymentRow([...input.payments])) warnings.push({ severity: 'BLOCKING', code: 'AMBIGUOUS_PAYMENT' });
  if (disposed > overpaid) warnings.push({ severity: 'BLOCKING', code: 'DISPOSITION_EXCEEDS_OVERPAYMENT' });
  if (documents.length > 0 && round4(fiscalObligation) !== round4(Number(input.projectedTotal))) {
    warnings.push({ severity: 'ADVISORY', code: 'FISCAL_OBLIGATION_DIFFERS' });
  }
  if (documents.length > 0 && round4(fiscalTax) !== round4(Number(input.projectedTax))) {
    warnings.push({ severity: 'ADVISORY', code: 'TAX_COMPOSITION_DIFFERS' });
  }
  if (documents.length > 0 && input.fiscalCorrectionSupported === false) {
    warnings.push({ severity: 'BLOCKING', code: 'FISCAL_CORRECTION_UNSUPPORTED' });
  }
  if (input.requestedChangeRef && documents.some((document) => document.changeRef === input.requestedChangeRef)) {
    warnings.push({ severity: 'BLOCKING', code: 'DUPLICATE_CORRECTION' });
  }
  if (input.arIssued && input.arCorrectionSupported === false) warnings.push({ severity: 'BLOCKING', code: 'AR_CORRECTION_UNSUPPORTED' });
  if (input.arIssued && input.arCorrectionSupported === true) warnings.push({ severity: 'ADVISORY', code: 'AR_CORRECTION_OWNED_BY_AR' });
  if (unresolved > 0) warnings.push({ severity: 'ADVISORY', code: 'OVERPAYMENT_FOLLOW_UP' });
  if (aggregated.outstanding > 0) warnings.push({ severity: 'ADVISORY', code: 'OUTSTANDING_FOLLOW_UP' });

  const denied = warnings.some((warning) => warning.severity === 'BLOCKING');
  const outcome: OrderChangeFinancialOutcome = denied
    ? 'DENIED'
    : unresolved > 0
      ? 'OVERPAYMENT'
      : aggregated.outstanding > 0
        ? 'OUTSTANDING'
        : 'SETTLED';

  return {
    outcome,
    outstandingAmount: money(aggregated.outstanding),
    overpaidAmount: money(overpaid),
    unresolvedOverpayment: money(unresolved),
    effectivePayments: money(aggregated.effectivePayments),
    effectiveCredits: money(aggregated.effectiveCredits),
    fiscalObligation: money(fiscalObligation),
    settlementMutated: false,
    warnings,
  };
}
