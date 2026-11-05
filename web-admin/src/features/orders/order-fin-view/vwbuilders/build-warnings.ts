/**
 * View warnings (BF-14). One rule source with reconciliation: every "expected"
 * figure comes from the shared aggregation functions, computed on the server
 * into `set.checks`; this module only compares them with the stored snapshot,
 * using the shared tolerance. Pure. Rules and codes carried over from the
 * legacy summary mapper, plus the §6.6 line-consistency rule.
 */
import { MONEY_COMPARISON_TOLERANCE as TOL } from '@/lib/constants/financial-tolerances';
import {
  CREDIT_APPLICATION_TYPES,
  ORDER_FINANCIAL_WARNING_CODES as CODES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES as PAY,
  SETTLEMENT_TYPE_CODES,
} from '@/lib/constants/order-financial';
import type {
  FinancialWarning,
  OrderFinSectionKey,
  OrderFinSnapshotInput,
  OrderFinSourceSet,
} from '@/lib/types/order-fin-view';

/** A warning plus the section that should carry its inline marker. */
export interface PlacedWarning { warning: FinancialWarning; section?: OrderFinSectionKey }

const differs = (a: number, b: number) => Math.abs(a - b) > TOL;
const upper = (v: string | null | undefined) => v?.trim().toUpperCase() ?? '';

export function buildOrderFinWarnings(set: OrderFinSourceSet & { snapshot: OrderFinSnapshotInput }): PlacedWarning[] {
  const s = set.snapshot;
  const c = set.checks ?? {};
  const out: PlacedWarning[] = [];
  const add = (code: string, severity: FinancialWarning['severity'], messageKey: string,
    section?: OrderFinSectionKey, messageParams?: FinancialWarning['messageParams']) =>
    out.push({ warning: { code, severity, messageKey, ...(messageParams ? { messageParams } : {}) }, section });

  if (c.expectedOutstanding !== undefined && differs(s.outstanding, c.expectedOutstanding)) {
    add(CODES.OUTSTANDING_MISMATCH, 'warning', 'balanceMismatch', 'payments', {
      total: s.total, paid: s.paid, credits: s.credits, expected: c.expectedOutstanding, stored: s.outstanding,
    });
  }

  const payments = set.facts.payments ?? [];
  const inStatuses = (list: readonly string[]) => payments.filter((p) => list.includes(upper(p.statusCode))).length;
  const pending = inStatuses(PAY.PENDING);
  if (pending > 0 && s.paid > 0) add(CODES.PENDING_PAYMENT_COUNTED_AS_PAID, 'info', 'pendingPaymentsNote', 'payments', { count: pending });
  const authorized = inStatuses(PAY.AUTHORIZED);
  if (authorized > 0 && s.paid > 0) add(CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID, 'info', 'pendingPaymentsNote', 'payments', { count: authorized });

  const giftCardApplied = (set.facts.credits ?? []).some(
    (f) => f.state === 'normal' && upper(f.methodCode) === CREDIT_APPLICATION_TYPES.GIFT_CARD,
  );
  if (giftCardApplied && c.expectedCredits !== undefined && differs(c.expectedCredits, s.credits)) {
    add(CODES.GIFT_CARD_DOUBLE_COUNTED, 'warning', 'giftCardNotInCredits', 'credits');
  }

  const invoices = (set.facts.receivable ?? []).filter((f) => f.state !== 'voided');
  if (invoices.length > 0) {
    if (c.invoiceOutstanding !== undefined && differs(c.invoiceOutstanding, s.outstanding)) {
      add(CODES.AR_RECEIVABLE_MISMATCH, 'warning', 'arReceivableMismatch', 'receivable', {
        invoiceOutstanding: c.invoiceOutstanding, orderOutstanding: s.outstanding,
      });
    }
    if (s.settlementType === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION) {
      add('POC_WITH_AR_INVOICE', 'error', 'payOnCollectionWithArInvoice', 'receivable');
    }
    if (s.settlementType !== SETTLEMENT_TYPE_CODES.CREDIT_INVOICE && s.total > 0 && s.paid >= s.total) {
      add('PAID_WITH_AR_INVOICE', 'warning', 'paidOrderWithArInvoice', 'receivable');
    }
  } else if (set.facts.receivable && s.settlementType === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE && s.outstanding > TOL) {
    // Only when the receivable source was loaded: absence of facts must not read as "no invoice".
    add(CODES.LEGACY_FIELD_USED_IN_SUMMARY, 'warning', 'creditInvoiceMissingAr', 'receivable');
  }

  // The stored parts no longer give the stored total: the statement would not add up on screen.
  if (c.expectedTotal !== undefined && differs(s.total, c.expectedTotal)) {
    add(CODES.ORDER_TOTAL_COMPONENT_MISMATCH, 'warning', 'totalComponentsMismatch', undefined, {
      expected: c.expectedTotal, stored: s.total,
    });
  }

  for (const section of c.lineMismatches ?? []) {
    add(CODES.SECTION_LINES_MISMATCH, 'warning', 'sectionLinesMismatch', section, { section });
  }
  return out;
}
