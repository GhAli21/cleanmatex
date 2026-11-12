import 'server-only';

import {
  CREDIT_APPLICATION_STATUSES as CAS,
  ORDER_PAYMENT_LIFECYCLE_STATUSES as PAY,
  REFUND_STATUSES as RS,
  TAX_DOCUMENT_STATUSES as TDS,
  TAX_PRICING_MODES,
  type TaxPricingMode,
} from '@/lib/constants/order-financial';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import {
  ORDER_FINANCIAL_COMPARISON_TOLERANCE,
  aggregateOrderFinancials,
  round4,
  toAmount,
  type AmountLike,
} from '@/lib/services/order-financial-aggregation';
import { resolveCanonicalTotalAmount } from '@/lib/services/order-financial-write.service';
import type {
  OrderFinChecks,
  OrderFinDataSource,
  OrderFinFactInput,
  OrderFinLine,
  OrderFinSectionKey,
  OrderFinSnapshotInput,
  OrderFinSourceSet,
} from '@/lib/types/order-fin-view';
import type { OrderFinCoreRow } from './sources/core.source';
import type { OrderFinSourceData } from './sources/registry';

/*
 * Saved-order normalizer (DESIGN §1): DB rows → the normalized source set the
 * builders read. Maps fields and decides each row's state from its stored
 * status; it never computes money.
 */

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: Date | string | null | undefined): string | null =>
  v == null ? null : (v instanceof Date ? v : new Date(v)).toISOString();
const upper = (v: string | null | undefined) => v?.trim().toUpperCase() ?? '';

type State = OrderFinLine['state'];

function paymentState(status: string | null): State {
  const s = upper(status);
  if ((PAY.COMPLETED as readonly string[]).includes(s)) return 'normal';
  if ((PAY.PENDING as readonly string[]).includes(s) || (PAY.AUTHORIZED as readonly string[]).includes(s)) return 'pending';
  if (s === 'REVERSED') return 'reversed';
  return 'failed';
}

function creditState(status: string | null): State {
  const s = upper(status) || CAS.APPLIED; // a row with no status is an applied credit (legacy rows)
  if (s === CAS.APPLIED) return 'normal';
  if (s === CAS.REVERSED) return 'reversed';
  if (s === CAS.FAILED || s === CAS.CANCELLED || s === CAS.EXPIRED) return 'failed';
  return 'pending';
}

function refundState(status: string | null): State {
  const s = upper(status);
  if (s === RS.PROCESSED) return 'normal';
  if (s === RS.FAILED || s === RS.CANCELLED) return 'failed';
  return 'pending';
}

type CoreWithoutJson = Omit<OrderFinCoreRow, 'financial_calculation_snapshot'> &
  Partial<Pick<OrderFinCoreRow, 'financial_calculation_snapshot'>>;

const isMode = (v: unknown): v is TaxPricingMode =>
  (Object.values(TAX_PRICING_MODES) as unknown[]).includes(v);

/**
 * The mode the stored totals were calculated in: the order's own snapshot
 * column (calculator orders), else the mode the snapshot writer recorded
 * (`taxPricingModeAtCalculation`), else TAX_EXCLUSIVE, the platform default.
 */
export function orderTaxPricingMode(core: CoreWithoutJson): TaxPricingMode {
  if (isMode(core.tax_pricing_mode)) return core.tax_pricing_mode;
  const json = core.financial_calculation_snapshot;
  const recorded = json && typeof json === 'object' && !Array.isArray(json)
    ? (json as Record<string, unknown>).taxPricingModeAtCalculation
    : undefined;
  return isMode(recorded) ? recorded : TAX_PRICING_MODES.TAX_EXCLUSIVE;
}

/**
 * Snapshot input from the core row; null when the snapshot was never written.
 * The calculation JSON is optional (the batch header reader skips it); without
 * it an older order's tax mode falls back to TAX_EXCLUSIVE, which headers never use.
 */
export function normalizeSnapshot(
  core: CoreWithoutJson,
  currencyDecimals: number | null,
): OrderFinSnapshotInput | null {
  if (core.financial_engine_version == null) return null;
  return {
    orderId: core.id,
    orderNo: core.order_no ?? null,
    orderStatus: core.status ?? null,
    currencyCode: core.currency_code ?? null,
    currencyDecimals,
    snapshotStatus: core.financial_snapshot_status ?? null,
    paymentStatus: core.payment_status ?? null,
    settlementType: core.payment_type_code ?? null,
    mismatchCount: core.financial_mismatch_warning_count ?? 0,
    itemsBase: num(core.items_base_amount),
    // Needs the item rows; `normalizeOrderFinSources` fills it when they were loaded.
    extrasIncluded: null,
    speedPremiumIncluded: null,
    charges: num(core.total_charges_amount),
    discount: num(core.total_discount_amount),
    tax: num(core.total_tax_amount),
    rounding: num(core.rounding_adjustment_amount),
    taxPricingMode: orderTaxPricingMode(core),
    total: num(core.total_amount),
    paid: num(core.total_paid_amount),
    credits: num(core.total_credit_applied_amount),
    refunded: num(core.refunded_amount),
    netCollected: num(core.net_collected_amount),
    outstanding: num(core.outstanding_amount),
    overpaid: num(core.overpaid_amount),
    changeReturned: num(core.change_returned_amount),
    receivable: num(core.ar_receivable_amount),
    baseCurrency: core.base_cur_currency_code
      ? { code: core.base_cur_currency_code, total: numOrNull(core.base_cur_total_amount), exchangeRate: numOrNull(core.currency_ex_rate) }
      : null,
    engineVersion: core.financial_engine_version ?? null,
    calculationHash: core.financial_calculation_hash ?? null,
    traceId: core.financial_calculation_trace_id ?? null,
  };
}

function taxDocumentState(status: string | null): State {
  const s = upper(status);
  if (s === TDS.CANCELLED) return 'voided';
  if (s === TDS.SUPERSEDED) return 'reversed';
  if (s === TDS.DRAFT) return 'pending';
  return 'normal';
}

function voucherState(status: string | null): State {
  const s = upper(status);
  if (s === VOUCHER_STATUS.CANCELLED) return 'voided';
  if (s === VOUCHER_STATUS.REVERSED) return 'reversed';
  if (s === VOUCHER_STATUS.DRAFT) return 'pending';
  return 'normal';
}

/** `org_order_adjustments_dtl.status` CHECK values. */
function adjustmentState(status: string | null): State {
  const s = upper(status);
  if (s === 'APPROVED' || s === 'POSTED') return 'normal';
  if (s === 'VOIDED') return 'voided';
  if (s === 'REJECTED') return 'failed';
  return 'pending';
}

/** Fact rows per loaded source (value and settlement sections). */
export function normalizeFacts(data: OrderFinSourceData): Partial<Record<OrderFinDataSource, OrderFinFactInput[]>> {
  const facts: Partial<Record<OrderFinDataSource, OrderFinFactInput[]>> = {};
  if (data.items) {
    facts.items = data.items.map((r) => ({
      id: r.id,
      label: { name: r.product_name ?? null, name2: r.product_name2 ?? null },
      amount: num(r.total_price),
      state: 'normal',
      methodCode: r.service_category_code,
      ...(r.taxParts?.length
        ? { taxParts: r.taxParts.map((p) => ({ taxCode: p.taxCode, ratePercent: p.ratePercent, amount: p.taxAmount })) }
        : {}),
    }));
  }
  if (data.charges) {
    facts.charges = data.charges.map((r) => ({
      id: r.id,
      label: { name: r.label ?? null, name2: r.label2 ?? null },
      amount: num(r.amount),
      state: r.is_voided ? 'voided' : 'normal',
      methodCode: r.charge_type,
      dateIso: iso(r.voided_at),
    }));
  }
  if (data.discounts) {
    facts.discounts = data.discounts.map((r) => ({
      id: r.id,
      label: { name: r.source_name ?? null, name2: r.source_name2 ?? null },
      amount: num(r.discount_amount),
      state: 'normal',
      methodCode: r.source_type,
    }));
  }
  if (data.taxes) {
    facts.taxes = data.taxes.map((r) => ({
      id: r.id,
      label: { name: r.label ?? null, name2: null },
      amount: num(r.tax_amount),
      state: 'normal',
      methodCode: r.tax_type,
    }));
  }
  if (data.payments) {
    facts.payments = data.payments.map((r) => ({
      id: r.id,
      label: { name: r.payment_method_name_snapshot ?? null, name2: null },
      amount: num(r.amount),
      state: paymentState(r.payment_status),
      statusCode: r.payment_status,
      methodCode: r.payment_method_code,
      dateIso: iso(r.paid_at ?? r.created_at),
      ref: r.card_last4 ? `••${r.card_last4}` : null,
    }));
  }
  if (data.credits) {
    facts.credits = data.credits.map((r) => ({
      id: r.id,
      amount: num(r.applied_amount),
      state: creditState(r.application_status),
      statusCode: r.application_status,
      methodCode: r.credit_type,
      dateIso: iso(r.applied_at),
      ref: r.reference_no,
    }));
  }
  if (data.refunds) {
    facts.refunds = data.refunds.map((r) => ({
      id: r.id,
      amount: num(r.refund_amount),
      state: refundState(r.refund_status),
      statusCode: r.refund_status,
      methodCode: r.refund_method_code,
      dateIso: iso(r.created_at),
      ref: r.refund_no,
    }));
  }
  if (data.overpayment) {
    facts.overpayment = data.overpayment.map((r) => ({
      id: r.id,
      amount: num(r.amount),
      state: 'normal',
      methodCode: r.resolution_code,
      dateIso: iso(r.created_at),
    }));
  }
  if (data.receivable) {
    const byId = new Map(data.receivable.invoices.map((i) => [i.id, i]));
    // The order's own share of each invoice, not the whole invoice (BF-07).
    facts.receivable = data.receivable.links.map((l) => {
      const inv = byId.get(l.invoice_id);
      return {
        id: l.id,
        amount: num(l.outstanding_amount),
        state: inv?.voided_at ? 'voided' : 'normal',
        statusCode: inv?.status ?? null,
        dateIso: iso(inv?.due_date),
        ref: inv?.invoice_no ?? null,
      };
    });
  }
  // Records: document totals, voucher face values and change deltas are informational (§6.6).
  if (data.taxDocuments) {
    facts.taxDocuments = data.taxDocuments.map((r) => ({
      id: r.id,
      amount: num(r.total_amount),
      role: 'informational',
      state: taxDocumentState(r.status),
      statusCode: r.status,
      methodCode: r.document_type,
      dateIso: iso(r.issued_at ?? r.created_at),
      ref: r.document_no,
    }));
  }
  if (data.vouchers) {
    facts.vouchers = data.vouchers.map((r) => ({
      id: r.id,
      amount: num(r.total_amount),
      role: 'informational',
      state: voucherState(r.voucher_status),
      statusCode: r.voucher_status,
      methodCode: r.voucher_type ?? r.voucher_category,
      dateIso: iso(r.issued_at ?? r.created_at),
      ref: r.voucher_no,
    }));
  }
  if (data.loyalty) {
    // Points as stored (signed), never money.
    facts.loyalty = data.loyalty.map((r) => ({
      id: r.id,
      amount: r.points,
      unit: 'points',
      state: 'normal',
      methodCode: r.txn_type,
      dateIso: iso(r.created_at),
    }));
  }
  if (data.adjustments) {
    facts.adjustments = data.adjustments.map((r) => ({
      id: r.id,
      amount: num(r.amount),
      state: adjustmentState(r.status),
      statusCode: r.status,
      methodCode: r.adjustment_type,
      dateIso: iso(r.created_at),
    }));
  }
  if (data.orderChanges) {
    // History only: the delta is never a second current total.
    facts.orderChanges = data.orderChanges.map((r) => ({
      id: r.id,
      label: { name: r.actor_name ?? null, name2: null },
      amount: num(r.commercial_delta),
      role: 'informational',
      state: 'normal',
      statusCode: r.financial_outcome,
      dateIso: iso(r.applied_at),
      ref: `#${r.change_no}`,
    }));
  }
  if (data.receipts) {
    facts.receipts = data.receipts.map((r) => ({
      id: r.id,
      amount: null,
      role: 'informational',
      state: upper(r.delivery_status_code) === 'FAILED' ? 'failed' : 'normal',
      statusCode: r.delivery_status_code,
      methodCode: r.delivery_channel_code,
      dateIso: iso(r.sent_at ?? r.created_at),
      ref: r.receipt_type_code,
    }));
  }
  return facts;
}

/**
 * The facts through the shared aggregation functions (BF-14), so view warnings
 * and reconciliation use one rule source. Each check runs only when its
 * sources were loaded.
 */
export function computeOrderFinChecks(core: OrderFinCoreRow, data: OrderFinSourceData): OrderFinChecks {
  const checks: OrderFinChecks = {};
  // The snapshot writer's own total formula on the stored parts (one rule source). Skipped when the
  // writer itself fell back to the header total, which has no parts to add up.
  const canonical = resolveCanonicalTotalAmount({
    itemsBaseAmount: toAmount(core.items_base_amount),
    totalChargesAmount: toAmount(core.total_charges_amount),
    totalDiscountAmount: toAmount(core.total_discount_amount),
    totalTaxAmount: toAmount(core.total_tax_amount),
    roundingAdjustmentAmount: toAmount(core.rounding_adjustment_amount),
    headerTotalAmount: toAmount(core.total_amount),
    taxPricingMode: orderTaxPricingMode(core),
  });
  if (!canonical.usedHeaderTotalFallback) checks.expectedTotal = canonical.totalAmount;
  if (data.payments && data.credits && data.refunds) {
    const agg = aggregateOrderFinancials({
      totalAmount: toAmount(core.total_amount),
      payments: data.payments,
      // Same row set as reconciliation's runOrderBalanceChecks (is_active only).
      credits: data.credits.filter((c) => c.is_active),
      refunds: data.refunds,
    });
    checks.expectedOutstanding = agg.outstanding;
    checks.expectedCredits = agg.effectiveCredits;
  }
  if (data.receivable) {
    const live = new Set(data.receivable.invoices.filter((i) => !i.voided_at).map((i) => i.id));
    checks.invoiceOutstanding = round4(
      data.receivable.links.filter((l) => live.has(l.invoice_id)).reduce((sum, l) => sum + toAmount(l.outstanding_amount), 0),
    );
  }
  // §6.6 line consistency. Charges are left out: legacy orders exclude item-level PREFERENCE rows
  // from total_charges_amount (sumMoneyAddendCharges), so a plain sum would warn falsely.
  const mismatches: OrderFinSectionKey[] = [];
  const check = (key: OrderFinSectionKey, rows: AmountLike[] | undefined, stored: AmountLike) => {
    if (rows && Math.abs(round4(rows.reduce<number>((s, v) => s + toAmount(v), 0)) - toAmount(stored)) > ORDER_FINANCIAL_COMPARISON_TOLERANCE) {
      mismatches.push(key);
    }
  };
  check('items', data.items?.map((r) => r.total_price), core.items_base_amount);
  check('discounts', data.discounts?.map((r) => r.discount_amount), core.total_discount_amount);
  check('taxes', data.taxes?.map((r) => r.tax_amount), core.total_tax_amount);
  if (mismatches.length) checks.lineMismatches = mismatches;
  return checks;
}

/**
 * A part inside the item prices: on calculator orders each item's
 * `service_pref_charge` is exactly the calculator's `includedModifierAmount`
 * and `speed_premium_amount` its speed premium (gross = base + premium +
 * included extras, `lib/commercial/line-pricing.ts`). Older orders mix item-
 * and piece-level extras and SEPARATE extras across columns, so they get no
 * figure rather than a wrong one.
 */
function includedPart(
  core: OrderFinCoreRow,
  data: OrderFinSourceData,
  column: 'service_pref_charge' | 'speed_premium_amount',
): number | null {
  if (core.commercial_calc_version == null || !data.items) return null;
  return round4(data.items.reduce((sum, i) => sum + toAmount(i[column]), 0));
}

/** The whole saved-order source set. */
export function normalizeOrderFinSources(
  core: OrderFinCoreRow,
  data: OrderFinSourceData,
  errors: OrderFinSourceSet['errors'],
  currencyDecimals: number | null,
): OrderFinSourceSet {
  const snapshot = normalizeSnapshot(core, currencyDecimals);
  if (snapshot) {
    snapshot.extrasIncluded = includedPart(core, data, 'service_pref_charge');
    snapshot.speedPremiumIncluded = includedPart(core, data, 'speed_premium_amount');
  }
  return {
    sourceKind: 'saved',
    snapshot,
    facts: normalizeFacts(data),
    errors,
    checks: computeOrderFinChecks(core, data),
  };
}
