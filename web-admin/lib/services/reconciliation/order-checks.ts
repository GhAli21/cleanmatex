/**
 * BVM Phase 4 — Order-scoped reconciliation checks.
 *
 * Covers PRD §22.1, two groups:
 *
 * 1. Factored legacy balance checks (pre-BVM behaviour preserved 1:1):
 *    - PAYMENT_TOTAL_MATCH       (Σ completed payments = header total_paid_amount)
 *    - CREDIT_APP_BALANCE        (Σ credit applications = header total_credit_applied_amount)
 *    - OUTSTANDING_TOTAL_MATCH   (recomputed outstanding = header outstanding_amount)
 *    - REFUND_CONSISTENCY        (Σ processed refunds ≤ settled value)
 *    - GATEWAY_PENDING_INTEGRITY (no orphaned pending gateway legs after outstanding clears)
 *    - LEGACY_STATUS_LEAKAGE     (no pre-Batch-0 lowercase payment_status values)
 *    - OUTBOX_PROCESSED          (no outbox events stuck > 1 hour)
 *
 * 2. New BVM link/separation checks (require post-mig-0303/0318 backlinks):
 *    - ORDER_PAYMENT_LINK_EXISTS
 *    - ORDER_PAYMENT_AMOUNT_MATCHES_LINE
 *    - ORDER_CREDIT_APPLICATION_LINK_EXISTS
 *    - ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE
 *    - ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS
 *    - ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS
 *
 * Why one module:
 * Every check here operates on an order or its child rows (payments, credit
 * applications, refunds, discounts). Co-locating them means the orchestrator
 * (Step 2h) can fan out a single `getScopedOrders` query and pass the row set
 * to all per-order checks, while the new per-row LINK_EXISTS / AMOUNT_MATCHES
 * checks share the same recon window without re-fetching the order set.
 *
 * Window semantics:
 * Per-order legacy checks operate on the order header — the orchestrator scopes
 * the order list with `getScopedOrders(periodFrom..periodTo)`. The new LINK /
 * AMOUNT checks scope by `created_at` (payments) or `applied_at` (credit apps)
 * since those are the BVM wiring event timestamps. Pre-Phase-2 rows naturally
 * fall outside any reasonable recon window.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  CREDIT_APPLICATION_STATUSES,
  CREDIT_APPLICATION_TYPES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
  REFUND_SOURCE_TYPES,
  TAX_DOCUMENT_STATUSES,
} from '@/lib/constants/order-financial';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';
import type { Decimal } from '@prisma/client/runtime/library';

import {
  RECONCILIATION_TOLERANCE,
  toNumber,
  type CheckResult,
} from './types';

interface PeriodWindow {
  periodFrom: Date;
  periodTo: Date;
}

/**
 * Header row shape consumed by the per-order balance checks.
 *
 * Exported so the orchestrator (Step 2h) can keep the existing
 * `getScopedOrders` projection in sync without redeclaring the shape.
 */
export interface ReconciliationOrderRow {
  id: string;
  order_no: string;
  total_amount: Decimal | null;
  total_paid_amount: Decimal | null;
  total_credit_applied_amount: Decimal | null;
  outstanding_amount: Decimal | null;
  payment_status: string | null;
  payment_type_code: string | null;
  pay_on_collection_amount: Decimal | null;
  currency_ex_rate?: Decimal | null;
  base_cur_total_amount?: Decimal | null;
  base_cur_tax_amount?: Decimal | null;
  base_cur_paid_amount?: Decimal | null;
  base_cur_credit_applied_amount?: Decimal | null;
  base_cur_outstanding_amount?: Decimal | null;
  base_cur_ar_receivable_amount?: Decimal | null;
  total_tax_amount?: Decimal | null;
  ar_receivable_amount?: Decimal | null;
}

/**
 * Lowercase legacy `payment_status` values that pre-date the Batch 0
 * uppercase enum. Surfaced as WARNING — never auto-corrected by the
 * service because some legacy reports key off the original casing.
 */
const LEGACY_PAYMENT_STATUS_LOWERCASE = ['pending', 'partial', 'paid', 'overpaid'] as const;

/**
 * Set of `org_order_discounts_dtl.source_type` values that would mean a
 * stored-value redemption (credit application) was double-recorded as a
 * commercial discount on the order. Mirrors `CREDIT_APPLICATION_TYPES`
 * verbatim so the DB-stored value matches the constant exactly.
 */
const CREDIT_APPLICATION_DISCOUNT_SOURCES: ReadonlySet<string> = new Set(
  Object.values(CREDIT_APPLICATION_TYPES),
);

function normalizeUpper(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * Run the per-order balance checks (PAYMENT_TOTAL_MATCH, CREDIT_APP_BALANCE,
 * OUTSTANDING_TOTAL_MATCH, REFUND_CONSISTENCY, GATEWAY_PENDING_INTEGRITY,
 * LEGACY_STATUS_LEAKAGE) for the given order set.
 *
 * Why this is the orchestrator's single entry point for legacy logic:
 * The pre-Phase-4 service inlined these checks in `buildOrderIssues`. The
 * orchestrator rewrite (Step 2h) replaces that with a single call here, so
 * behaviour is preserved 1:1 while the new modules can be wired separately.
 *
 * @param tenantOrgId active tenant — every query scoped via `withTenantContext`.
 * @param orders header rows produced by the orchestrator's `getScopedOrders`.
 */
export async function runOrderBalanceChecks(
  tenantOrgId: string,
  orders: ReconciliationOrderRow[],
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const order of orders) {
    const [payments, creditAgg, refundAgg] = await Promise.all([
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_payments_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, order_id: order.id, is_active: true },
          select: { amount: true, payment_status: true, gateway_code: true },
        }),
      ),
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_credit_apps_dtl.aggregate({
          where: { tenant_org_id: tenantOrgId, order_id: order.id, is_active: true },
          _sum: { applied_amount: true },
        }),
      ),
      withTenantContext(tenantOrgId, () =>
        prisma.org_order_refunds_dtl.aggregate({
          where: {
            tenant_org_id: tenantOrgId,
            order_id: order.id,
            is_active: true,
            refund_status: 'PROCESSED',
          },
          _sum: { refund_amount: true },
        }),
      ),
    ]);

    const completedPaymentTotal = payments
      .filter((row) => row.payment_status === 'COMPLETED')
      .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const pendingGatewayTotal = payments
      .filter((row) => row.gateway_code && row.payment_status !== 'COMPLETED')
      .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const expectedPaid = toNumber(order.total_paid_amount);
    const paidDelta = completedPaymentTotal - expectedPaid;

    if (Math.abs(paidDelta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.PAYMENT_TOTAL_MATCH,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedPaid,
        actualValue: completedPaymentTotal,
        delta: paidDelta,
        message: `Order ${order.order_no}: completed payment sum (${completedPaymentTotal}) does not match total_paid_amount (${expectedPaid})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    const actualCredit = toNumber(creditAgg._sum.applied_amount);
    const expectedCredit = toNumber(order.total_credit_applied_amount);
    const creditDelta = actualCredit - expectedCredit;
    if (Math.abs(creditDelta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.CREDIT_APP_BALANCE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedCredit,
        actualValue: actualCredit,
        delta: creditDelta,
        message: `Order ${order.order_no}: credit application sum (${actualCredit}) does not match total_credit_applied_amount (${expectedCredit})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    const processedRefunds = toNumber(refundAgg._sum.refund_amount);
    const grossApplied = completedPaymentTotal + actualCredit;
    const expectedOutstanding = Math.max(0, toNumber(order.total_amount) - grossApplied + processedRefunds);
    const actualOutstanding = toNumber(order.outstanding_amount);
    const outstandingDelta = expectedOutstanding - actualOutstanding;

    if (Math.abs(outstandingDelta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.OUTSTANDING_TOTAL_MATCH,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expectedOutstanding,
        actualValue: actualOutstanding,
        delta: outstandingDelta,
        message: `Order ${order.order_no}: recomputed outstanding (${expectedOutstanding}) does not match header outstanding_amount (${actualOutstanding})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    if (processedRefunds - grossApplied >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.REFUND_CONSISTENCY,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: grossApplied,
        actualValue: processedRefunds,
        delta: processedRefunds - grossApplied,
        message: `Order ${order.order_no}: processed refunds (${processedRefunds}) exceed settled value (${grossApplied})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    if (pendingGatewayTotal > 0) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.GATEWAY_PENDING_INTEGRITY,
        // Pending gateway legs on a fully-settled order need follow-up
        // (WARNING). On an outstanding order they are still legitimate
        // (INFO) — matches pre-Phase-4 service triage.
        severity: actualOutstanding <= 0
          ? RECONCILIATION_SEVERITIES.WARNING
          : RECONCILIATION_SEVERITIES.INFO,
        passed: false,
        expectedValue: 0,
        actualValue: pendingGatewayTotal,
        delta: pendingGatewayTotal,
        message: `Order ${order.order_no}: ${pendingGatewayTotal} remains in pending gateway legs and still needs external confirmation`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }

    const normalizedRaw = String(order.payment_status ?? '').trim();
    if ((LEGACY_PAYMENT_STATUS_LOWERCASE as readonly string[]).includes(normalizedRaw)) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.LEGACY_STATUS_LEAKAGE,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        message: `Order ${order.order_no}: legacy payment_status value "${normalizedRaw}" still exists on the order header`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }
  }

  return results;
}

/**
 * OUTBOX_PROCESSED — outbox events stuck for more than 1 hour in
 * `PENDING` or `FAILED` state indicate the dispatcher is unhealthy.
 *
 * Tenant-level check (not per-order). Surfaced as WARNING because the
 * recovery action is operational (restart dispatcher / inspect failures)
 * rather than a data-integrity fix.
 *
 * @param tenantOrgId active tenant — count query scoped via `withTenantContext`.
 */
export async function checkOutboxStuck(tenantOrgId: string): Promise<CheckResult[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  const stuck = await withTenantContext(tenantOrgId, () =>
    prisma.org_domain_events_outbox.count({
      where: {
        tenant_org_id: tenantOrgId,
        status: { in: ['PENDING', 'FAILED'] },
        created_at: { lte: oneHourAgo },
      },
    }),
  );

  if (stuck === 0) return [];

  return [{
    checkName: RECONCILIATION_CHECK_NAMES.OUTBOX_PROCESSED,
    severity: RECONCILIATION_SEVERITIES.WARNING,
    passed: false,
    actualValue: stuck,
    message: `${stuck} outbox event(s) have been stuck for more than one hour`,
  }];
}

/**
 * ORDER_PAYMENT_LINK_EXISTS — every COMPLETED order-payment row created in
 * the window must carry both `fin_voucher_id` and `fin_voucher_trx_line_id`
 * (mig 0303 backlinks populated by the wiring service).
 *
 * Why a BLOCKER: a NULL backlink on a completed payment in a post-Phase-2
 * window means money was recorded without a posted voucher — the GL trail
 * is broken and reconciliation cannot vouch for the period totals.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `created_at` (the wiring event time).
 */
export async function checkOrderPaymentLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orphans = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
        payment_status: 'COMPLETED',
        is_active: true,
        // Both backlink columns are required together — a row that has one
        // but not the other is still a wiring regression. Prisma `OR` over
        // the two null predicates catches both shapes in a single query.
        OR: [
          { fin_voucher_id: null },
          { fin_voucher_trx_line_id: null },
        ],
      },
      select: {
        id: true,
        order_id: true,
        amount: true,
        payment_method_code: true,
      },
    }),
  );

  return orphans.map((row) => {
    const amount = toNumber(row.amount);
    return {
      checkName: RECONCILIATION_CHECK_NAMES.ORDER_PAYMENT_LINK_EXISTS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: amount,
      message: `Order payment ${row.id} (order ${row.order_id}, method ${row.payment_method_code}, amount ${amount}) has no fin_voucher backlink — payment recorded outside a Business Voucher transaction`,
      affectedEntityType: 'order_payment',
      affectedEntityId: row.id,
    };
  });
}

/**
 * ORDER_PAYMENT_AMOUNT_MATCHES_LINE — for every order-payment row with a
 * voucher trx line backlink, the line's `amount` must equal the payment row's
 * `amount` within `RECONCILIATION_TOLERANCE`.
 *
 * Why a BLOCKER: a mismatch means the order header and the GL voucher
 * disagree on how much was paid — every downstream report would differ.
 *
 * Implementation:
 *   - One findMany for in-window payments with a non-null trx-line id.
 *   - One batched findMany for the matching trx lines (no N+1).
 *   - Index the trx lines by id for O(1) comparison.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `created_at` on the payment row.
 */
export async function checkOrderPaymentAmountMatchesLine(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const payments = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
        fin_voucher_trx_line_id: { not: null },
      },
      select: {
        id: true,
        order_id: true,
        amount: true,
        fin_voucher_trx_line_id: true,
      },
    }),
  );

  if (payments.length === 0) return [];

  const lineIds = payments
    .map((p) => p.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);

  const lines = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        id: { in: lineIds },
      },
      select: { id: true, amount: true },
    }),
  );

  const lineAmountById = new Map(lines.map((l) => [l.id, toNumber(l.amount)]));
  const results: CheckResult[] = [];

  for (const payment of payments) {
    const lineId = payment.fin_voucher_trx_line_id;
    if (!lineId) continue;
    const lineAmount = lineAmountById.get(lineId);
    // If the line is missing entirely the LINK_EXISTS check (above) will not
    // fire (because the backlink column was populated); flag a BLOCKER here
    // so the caller still notices the dangling FK target.
    if (lineAmount == null) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PAYMENT_AMOUNT_MATCHES_LINE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: toNumber(payment.amount),
        message: `Order payment ${payment.id} (order ${payment.order_id}) references voucher trx line ${lineId} that does not exist`,
        affectedEntityType: 'order_payment',
        affectedEntityId: payment.id,
      });
      continue;
    }
    const paymentAmount = toNumber(payment.amount);
    const delta = paymentAmount - lineAmount;
    if (Math.abs(delta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PAYMENT_AMOUNT_MATCHES_LINE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: lineAmount,
        actualValue: paymentAmount,
        delta,
        message: `Order payment ${payment.id} (order ${payment.order_id}) amount ${paymentAmount} does not match voucher trx line ${lineId} amount ${lineAmount}`,
        affectedEntityType: 'order_payment',
        affectedEntityId: payment.id,
      });
    }
  }

  return results;
}

/**
 * ORDER_CREDIT_APPLICATION_LINK_EXISTS — every active credit-application row
 * applied in the window must carry both `fin_voucher_id` and
 * `fin_voucher_trx_line_id` (mig 0318 backlinks).
 *
 * Why a BLOCKER: see ORDER_PAYMENT_LINK_EXISTS — same rationale for stored-
 * value redemptions.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `applied_at` on the credit-application row.
 */
export async function checkOrderCreditApplicationLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orphans = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_credit_apps_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        applied_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
        OR: [
          { fin_voucher_id: null },
          { fin_voucher_trx_line_id: null },
        ],
      },
      select: {
        id: true,
        order_id: true,
        credit_type: true,
        applied_amount: true,
      },
    }),
  );

  return orphans.map((row) => {
    const amount = toNumber(row.applied_amount);
    return {
      checkName: RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_LINK_EXISTS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: amount,
      message: `Credit application ${row.id} (order ${row.order_id}, type ${row.credit_type}, amount ${amount}) has no fin_voucher backlink — applied outside a Business Voucher transaction`,
      affectedEntityType: 'order_credit_application',
      affectedEntityId: row.id,
    };
  });
}

/**
 * ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE — for every credit-application
 * row with a voucher trx line backlink, the line's `amount` must equal
 * `applied_amount` within `RECONCILIATION_TOLERANCE`.
 *
 * See ORDER_PAYMENT_AMOUNT_MATCHES_LINE for rationale and N+1 prevention.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `applied_at` on the credit-application row.
 */
export async function checkOrderCreditApplicationAmountMatchesLine(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const apps = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_credit_apps_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        applied_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
        fin_voucher_trx_line_id: { not: null },
      },
      select: {
        id: true,
        order_id: true,
        credit_type: true,
        applied_amount: true,
        fin_voucher_trx_line_id: true,
      },
    }),
  );

  if (apps.length === 0) return [];

  const lineIds = apps
    .map((a) => a.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);

  const lines = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_voucher_trx_lines_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        id: { in: lineIds },
      },
      select: { id: true, amount: true },
    }),
  );

  const lineAmountById = new Map(lines.map((l) => [l.id, toNumber(l.amount)]));
  const results: CheckResult[] = [];

  for (const app of apps) {
    const lineId = app.fin_voucher_trx_line_id;
    if (!lineId) continue;
    const lineAmount = lineAmountById.get(lineId);
    if (lineAmount == null) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: toNumber(app.applied_amount),
        message: `Credit application ${app.id} (order ${app.order_id}) references voucher trx line ${lineId} that does not exist`,
        affectedEntityType: 'order_credit_application',
        affectedEntityId: app.id,
      });
      continue;
    }
    const appAmount = toNumber(app.applied_amount);
    const delta = appAmount - lineAmount;
    if (Math.abs(delta) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: lineAmount,
        actualValue: appAmount,
        delta,
        message: `Credit application ${app.id} (order ${app.order_id}, type ${app.credit_type}) amount ${appAmount} does not match voucher trx line ${lineId} amount ${lineAmount}`,
        affectedEntityType: 'order_credit_application',
        affectedEntityId: app.id,
      });
    }
  }

  return results;
}

/**
 * ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS — a stored-value redemption must
 * never also appear as a row in `org_order_payments_dtl`. We enforce this by
 * cross-checking the `fin_voucher_trx_line_id` backlink: if a voucher line is
 * referenced by both a credit-application row and a payment row, one of the
 * two is wired incorrectly.
 *
 * Why a BLOCKER: this is a separation-of-concerns invariant baked into Batch 0
 * (REAL_PAYMENT vs CREDIT_APPLICATION nature). A breach implies stored-value
 * is being counted twice — once on the payments side and once on the credit
 * applications side — corrupting `total_paid_amount` and outstanding totals.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `applied_at` on the credit-application row.
 */
export async function checkOrderCreditApplicationNotInPayments(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const apps = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_credit_apps_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        applied_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
        fin_voucher_trx_line_id: { not: null },
      },
      select: {
        id: true,
        order_id: true,
        credit_type: true,
        applied_amount: true,
        fin_voucher_trx_line_id: true,
      },
    }),
  );

  if (apps.length === 0) return [];

  const lineIds = apps
    .map((a) => a.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);

  // Any order_payments row that references one of these credit-app trx lines
  // is a Batch-0 separation breach.
  const collidingPayments = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        fin_voucher_trx_line_id: { in: lineIds },
      },
      select: { id: true, order_id: true, fin_voucher_trx_line_id: true },
    }),
  );

  if (collidingPayments.length === 0) return [];

  const paymentByLine = new Map(
    collidingPayments
      .filter((p) => p.fin_voucher_trx_line_id != null)
      .map((p) => [p.fin_voucher_trx_line_id as string, p]),
  );

  const results: CheckResult[] = [];
  for (const app of apps) {
    const lineId = app.fin_voucher_trx_line_id;
    if (!lineId) continue;
    const colliding = paymentByLine.get(lineId);
    if (!colliding) continue;
    results.push({
      checkName: RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: toNumber(app.applied_amount),
      message: `Credit application ${app.id} (order ${app.order_id}, type ${app.credit_type}) shares voucher trx line ${lineId} with order payment ${colliding.id} — stored-value redemption is being counted in REAL_PAYMENT totals`,
      affectedEntityType: 'order_credit_application',
      affectedEntityId: app.id,
    });
  }
  return results;
}

/**
 * ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS — a stored-value redemption must
 * never also be recorded as a commercial discount on the same order.
 *
 * Enforcement: for any order with at least one active credit application in
 * the window, flag any `org_order_discounts_dtl` row whose `source_type` is
 * one of the `CREDIT_APPLICATION_TYPES` values (WALLET, GIFT_CARD,
 * CUSTOMER_CREDIT, CUSTOMER_ADVANCE, LOYALTY_CREDIT) and is not voided.
 *
 * Why a BLOCKER: a stored-value redemption recorded as a discount would
 * deflate the order total (discounted) AND credit the stored-value balance —
 * double-counting in the customer's favour.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`.
 * @param window applied against `applied_at` on the credit-application row.
 */
export async function checkOrderCreditApplicationNotInDiscounts(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orderIds = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_credit_apps_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        applied_at: { gte: window.periodFrom, lte: window.periodTo },
        is_active: true,
      },
      select: { order_id: true },
      distinct: ['order_id'],
    }),
  );

  if (orderIds.length === 0) return [];

  const orderIdList = orderIds.map((o) => o.order_id);

  const leaks = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_discounts_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        order_id: { in: orderIdList },
        is_voided: false,
        source_type: { in: Array.from(CREDIT_APPLICATION_DISCOUNT_SOURCES) },
      },
      select: {
        id: true,
        order_id: true,
        source_type: true,
        discount_amount: true,
      },
    }),
  );

  return leaks.map((row) => {
    const amount = toNumber(row.discount_amount);
    return {
      checkName: RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: amount,
      message: `Order ${row.order_id}: discount row ${row.id} has source_type ${row.source_type} (stored-value) and amount ${amount} — stored-value redemption is being recorded as a commercial discount`,
      affectedEntityType: 'order_discount',
      affectedEntityId: row.id,
    };
  });
}

/**
 * PAYMENT_TARGET_VS_ORDER_TOTALS — validates the corrected Phase 3 invariant:
 * `org_order_payments_dtl` is ORDER-only, and voucher-line role/target is the
 * source of truth for that discrimination.
 *
 * Enforced in three ways:
 *  1. Every ORDER_PAYMENT voucher line targeted at ORDER must create exactly
 *     one org_order_payments_dtl row.
 *  2. An org_order_payments_dtl row must never point back to an INVOICE_PAYMENT
 *     line or to a voucher line targeted anywhere other than ORDER/{order_id}.
 *  3. For every affected order, the sum of completed payment rows whose linked
 *     voucher line is ORDER_PAYMENT + target ORDER/{order_id} must equal the
 *     header `total_paid_amount`.
 * @param tenantOrgId
 * @param window
 */
export async function checkPaymentTargetVsOrderTotals(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const [windowLines, windowPayments] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      prisma.org_fin_voucher_trx_lines_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          created_at: { gte: window.periodFrom, lte: window.periodTo },
          is_active: true,
          reversed_line_id: null,
          line_role: { in: [LINE_ROLE.ORDER_PAYMENT, LINE_ROLE.INVOICE_PAYMENT] },
        },
        select: {
          id: true,
          line_role: true,
          target_type: true,
          target_id: true,
        },
      }),
    ),
    withTenantContext(tenantOrgId, () =>
      prisma.org_order_payments_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          created_at: { gte: window.periodFrom, lte: window.periodTo },
          is_active: true,
        },
        select: {
          id: true,
          order_id: true,
          amount: true,
          payment_status: true,
          fin_voucher_trx_line_id: true,
        },
      }),
    ),
  ]);

  const results: CheckResult[] = [];
  const paymentByLineId = new Map(
    windowPayments
      .filter((row) => row.fin_voucher_trx_line_id != null)
      .map((row) => [row.fin_voucher_trx_line_id as string, row]),
  );

  for (const line of windowLines) {
    if (line.line_role !== LINE_ROLE.ORDER_PAYMENT || line.target_type !== TARGET_TYPE.ORDER) {
      continue;
    }

    const payment = paymentByLineId.get(line.id);
    if (payment) continue;

    results.push({
      checkName: RECONCILIATION_CHECK_NAMES.PAYMENT_TARGET_VS_ORDER_TOTALS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      message: `Voucher line ${line.id} is ORDER_PAYMENT targeted to order ${line.target_id} but no org_order_payments_dtl row was created`,
      affectedEntityType: 'voucher_trx_line',
      affectedEntityId: line.id,
    });
  }

  const paymentLineIds = windowPayments
    .map((row) => row.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);
  const paymentLines = paymentLineIds.length === 0
    ? []
    : await withTenantContext(tenantOrgId, () =>
      prisma.org_fin_voucher_trx_lines_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: paymentLineIds },
        },
        select: {
          id: true,
          line_role: true,
          target_type: true,
          target_id: true,
        },
      }),
    );
  const lineById = new Map(paymentLines.map((line) => [line.id, line]));

  for (const payment of windowPayments) {
    const lineId = payment.fin_voucher_trx_line_id;
    if (!lineId) continue;

    const line = lineById.get(lineId);
    if (
      line
      && line.line_role === LINE_ROLE.ORDER_PAYMENT
      && line.target_type === TARGET_TYPE.ORDER
      && line.target_id === payment.order_id
    ) {
      continue;
    }

    const lineRole = line?.line_role ?? 'MISSING';
    const targetType = line?.target_type ?? 'MISSING';
    const targetId = line?.target_id ?? 'MISSING';
    results.push({
      checkName: RECONCILIATION_CHECK_NAMES.PAYMENT_TARGET_VS_ORDER_TOTALS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: toNumber(payment.amount),
      message: `Order payment ${payment.id} (order ${payment.order_id}) links to voucher line ${lineId} with role ${lineRole} and target ${targetType}/${targetId}; expected ORDER_PAYMENT + ORDER/${payment.order_id}`,
      affectedEntityType: 'order_payment',
      affectedEntityId: payment.id,
    });
  }

  const touchedOrderIds = Array.from(new Set([
    ...windowPayments.map((row) => row.order_id),
    ...windowLines
      .filter((line) => line.line_role === LINE_ROLE.ORDER_PAYMENT && line.target_type === TARGET_TYPE.ORDER)
      .map((line) => line.target_id)
      .filter((id): id is string => id != null),
  ]));

  if (touchedOrderIds.length === 0) return results;

  const [allOrderPayments, orderHeaders] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      prisma.org_order_payments_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          order_id: { in: touchedOrderIds },
          is_active: true,
        },
        select: {
          id: true,
          order_id: true,
          amount: true,
          payment_status: true,
          fin_voucher_trx_line_id: true,
        },
      }),
    ),
    withTenantContext(tenantOrgId, () =>
      prisma.org_orders_mst.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: touchedOrderIds },
        },
        select: {
          id: true,
          order_no: true,
          total_paid_amount: true,
        },
      }),
    ),
  ]);

  const allLineIds = allOrderPayments
    .map((row) => row.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);
  const allLines = allLineIds.length === 0
    ? []
    : await withTenantContext(tenantOrgId, () =>
      prisma.org_fin_voucher_trx_lines_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: allLineIds },
        },
        select: {
          id: true,
          line_role: true,
          target_type: true,
          target_id: true,
        },
      }),
    );
  const allLinesById = new Map(allLines.map((line) => [line.id, line]));
  const headerByOrderId = new Map(orderHeaders.map((row) => [row.id, row]));
  const qualifiedPaidByOrderId = new Map<string, number>();

  for (const payment of allOrderPayments) {
    const status = normalizeUpper(payment.payment_status);
    if (!(ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED as readonly string[]).includes(status)) {
      continue;
    }

    const line = payment.fin_voucher_trx_line_id
      ? allLinesById.get(payment.fin_voucher_trx_line_id)
      : null;
    if (
      payment.fin_voucher_trx_line_id
      && (!line
        || line.line_role !== LINE_ROLE.ORDER_PAYMENT
        || line.target_type !== TARGET_TYPE.ORDER
        || line.target_id !== payment.order_id)
    ) {
      continue;
    }

    const current = qualifiedPaidByOrderId.get(payment.order_id) ?? 0;
    qualifiedPaidByOrderId.set(payment.order_id, current + toNumber(payment.amount));
  }

  for (const orderId of touchedOrderIds) {
    const header = headerByOrderId.get(orderId);
    if (!header) continue;

    const actual = qualifiedPaidByOrderId.get(orderId) ?? 0;
    const expected = toNumber(header.total_paid_amount);
    const delta = actual - expected;
    if (Math.abs(delta) < RECONCILIATION_TOLERANCE) continue;

    results.push({
      checkName: RECONCILIATION_CHECK_NAMES.PAYMENT_TARGET_VS_ORDER_TOTALS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      expectedValue: expected,
      actualValue: actual,
      delta,
      message: `Order ${header.order_no}: completed ORDER_PAYMENT voucher-linked payments sum (${actual}) does not match total_paid_amount (${expected})`,
      affectedEntityType: 'order',
      affectedEntityId: orderId,
    });
  }

  return results;
}

/**
 * CREDIT_APP_LIFECYCLE_CONSISTENCY — validates the Phase 3 credit lifecycle
 * buckets against voucher-line wiring and order-header snapshot totals.
 *
 * Enforced in three ways:
 *  1. Every ORDER_CREDIT_APPLICATION voucher line targeted at ORDER must
 *     create an org_order_credit_apps_dtl row.
 *  2. An org_order_credit_apps_dtl row must point back to an
 *     ORDER_CREDIT_APPLICATION voucher line targeted at ORDER/{order_id}.
 *  3. For every affected order, status-bucket sums must match the header:
 *       APPLIED                        -> total_credit_applied_amount
 *       PENDING/RESERVED/PROCESSING    -> pending_credit_application_amount
 *       FAILED/CANCELLED/EXPIRED       -> failed_credit_application_amount
 * @param tenantOrgId
 * @param window
 */
export async function checkCreditAppLifecycleConsistency(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const [windowLines, windowApps] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      prisma.org_fin_voucher_trx_lines_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          created_at: { gte: window.periodFrom, lte: window.periodTo },
          is_active: true,
          reversed_line_id: null,
          line_role: LINE_ROLE.ORDER_CREDIT_APPLICATION,
        },
        select: {
          id: true,
          line_role: true,
          target_type: true,
          target_id: true,
        },
      }),
    ),
    withTenantContext(tenantOrgId, () =>
      prisma.org_order_credit_apps_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          applied_at: { gte: window.periodFrom, lte: window.periodTo },
        },
        select: {
          id: true,
          order_id: true,
          applied_amount: true,
          application_status: true,
          fin_voucher_trx_line_id: true,
        },
      }),
    ),
  ]);

  const results: CheckResult[] = [];
  const appByLineId = new Map(
    windowApps
      .filter((row) => row.fin_voucher_trx_line_id != null)
      .map((row) => [row.fin_voucher_trx_line_id as string, row]),
  );

  for (const line of windowLines) {
    if (line.target_type !== TARGET_TYPE.ORDER) continue;

    const app = appByLineId.get(line.id);
    if (app) continue;

    results.push({
      checkName: RECONCILIATION_CHECK_NAMES.CREDIT_APP_LIFECYCLE_CONSISTENCY,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      message: `Voucher line ${line.id} is ORDER_CREDIT_APPLICATION targeted to order ${line.target_id} but no org_order_credit_apps_dtl row was created`,
      affectedEntityType: 'voucher_trx_line',
      affectedEntityId: line.id,
    });
  }

  const appLineIds = windowApps
    .map((row) => row.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);
  const appLines = appLineIds.length === 0
    ? []
    : await withTenantContext(tenantOrgId, () =>
      prisma.org_fin_voucher_trx_lines_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: appLineIds },
        },
        select: {
          id: true,
          line_role: true,
          target_type: true,
          target_id: true,
        },
      }),
    );
  const lineById = new Map(appLines.map((line) => [line.id, line]));

  for (const app of windowApps) {
    const lineId = app.fin_voucher_trx_line_id;
    if (!lineId) continue;

    const line = lineById.get(lineId);
    if (
      line
      && line.line_role === LINE_ROLE.ORDER_CREDIT_APPLICATION
      && line.target_type === TARGET_TYPE.ORDER
      && line.target_id === app.order_id
    ) {
      continue;
    }

    const lineRole = line?.line_role ?? 'MISSING';
    const targetType = line?.target_type ?? 'MISSING';
    const targetId = line?.target_id ?? 'MISSING';
    results.push({
      checkName: RECONCILIATION_CHECK_NAMES.CREDIT_APP_LIFECYCLE_CONSISTENCY,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: toNumber(app.applied_amount),
      message: `Credit application ${app.id} (order ${app.order_id}) links to voucher line ${lineId} with role ${lineRole} and target ${targetType}/${targetId}; expected ORDER_CREDIT_APPLICATION + ORDER/${app.order_id}`,
      affectedEntityType: 'order_credit_application',
      affectedEntityId: app.id,
    });
  }

  const touchedOrderIds = Array.from(new Set([
    ...windowApps.map((row) => row.order_id),
    ...windowLines
      .filter((line) => line.target_type === TARGET_TYPE.ORDER)
      .map((line) => line.target_id)
      .filter((id): id is string => id != null),
  ]));

  if (touchedOrderIds.length === 0) return results;

  const [allApps, orderHeaders] = await Promise.all([
    withTenantContext(tenantOrgId, () =>
      prisma.org_order_credit_apps_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          order_id: { in: touchedOrderIds },
        },
        select: {
          id: true,
          order_id: true,
          applied_amount: true,
          application_status: true,
          fin_voucher_trx_line_id: true,
        },
      }),
    ),
    withTenantContext(tenantOrgId, () =>
      prisma.org_orders_mst.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: touchedOrderIds },
        },
        select: {
          id: true,
          order_no: true,
          total_credit_applied_amount: true,
          pending_credit_application_amount: true,
          failed_credit_application_amount: true,
        },
      }),
    ),
  ]);

  const allAppLineIds = allApps
    .map((row) => row.fin_voucher_trx_line_id)
    .filter((id): id is string => id != null);
  const allLines = allAppLineIds.length === 0
    ? []
    : await withTenantContext(tenantOrgId, () =>
      prisma.org_fin_voucher_trx_lines_dtl.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: allAppLineIds },
        },
        select: {
          id: true,
          line_role: true,
          target_type: true,
          target_id: true,
        },
      }),
    );
  const allLinesById = new Map(allLines.map((line) => [line.id, line]));
  const headerByOrderId = new Map(orderHeaders.map((row) => [row.id, row]));
  const totalsByOrderId = new Map<string, { applied: number; pending: number; failed: number }>();
  const pendingStatuses = new Set<string>([
    CREDIT_APPLICATION_STATUSES.PENDING,
    CREDIT_APPLICATION_STATUSES.RESERVED,
    CREDIT_APPLICATION_STATUSES.PROCESSING,
  ]);
  const failedStatuses = new Set<string>([
    CREDIT_APPLICATION_STATUSES.FAILED,
    CREDIT_APPLICATION_STATUSES.CANCELLED,
    CREDIT_APPLICATION_STATUSES.EXPIRED,
  ]);

  for (const app of allApps) {
    const line = app.fin_voucher_trx_line_id
      ? allLinesById.get(app.fin_voucher_trx_line_id)
      : null;
    if (
      app.fin_voucher_trx_line_id
      && (!line
        || line.line_role !== LINE_ROLE.ORDER_CREDIT_APPLICATION
        || line.target_type !== TARGET_TYPE.ORDER
        || line.target_id !== app.order_id)
    ) {
      continue;
    }

    const status = normalizeUpper(app.application_status) || CREDIT_APPLICATION_STATUSES.APPLIED;
    const current = totalsByOrderId.get(app.order_id) ?? { applied: 0, pending: 0, failed: 0 };
    const amount = toNumber(app.applied_amount);

    if (status === CREDIT_APPLICATION_STATUSES.APPLIED) {
      current.applied += amount;
    } else if (pendingStatuses.has(status)) {
      current.pending += amount;
    } else if (failedStatuses.has(status)) {
      current.failed += amount;
    }

    totalsByOrderId.set(app.order_id, current);
  }

  for (const orderId of touchedOrderIds) {
    const header = headerByOrderId.get(orderId);
    if (!header) continue;

    const totals = totalsByOrderId.get(orderId) ?? { applied: 0, pending: 0, failed: 0 };
    const comparisons = [
      {
        label: 'total_credit_applied_amount',
        expected: toNumber(header.total_credit_applied_amount),
        actual: totals.applied,
      },
      {
        label: 'pending_credit_application_amount',
        expected: toNumber(header.pending_credit_application_amount),
        actual: totals.pending,
      },
      {
        label: 'failed_credit_application_amount',
        expected: toNumber(header.failed_credit_application_amount),
        actual: totals.failed,
      },
    ];

    for (const comparison of comparisons) {
      const delta = comparison.actual - comparison.expected;
      if (Math.abs(delta) < RECONCILIATION_TOLERANCE) continue;

      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.CREDIT_APP_LIFECYCLE_CONSISTENCY,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: comparison.expected,
        actualValue: comparison.actual,
        delta,
        message: `Order ${header.order_no}: ${comparison.label} (${comparison.expected}) does not match lifecycle-derived credit sum (${comparison.actual})`,
        affectedEntityType: 'order',
        affectedEntityId: orderId,
      });
    }
  }

  return results;
}

/**
 * ADR-039 requires a stored historical exchange rate for base-currency
 * snapshots. Missing or zero rates make every base_cur_* projection unusable.
 * @param tenantOrgId
 * @param window
 */
export async function checkBaseCurrencyRatePresent(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orders = await withTenantContext(tenantOrgId, () =>
    prisma.org_orders_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: {
        id: true,
        order_no: true,
        currency_ex_rate: true,
      },
    }),
  );

  return orders
    .filter((order) => toNumber(order.currency_ex_rate) <= 0)
    .map((order) => ({
      checkName: RECONCILIATION_CHECK_NAMES.BASE_CURRENCY_RATE_PRESENT,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      expectedValue: 0,
      actualValue: toNumber(order.currency_ex_rate),
      delta: null,
      message: `Order ${order.order_no}: currency_ex_rate is missing or invalid for base-currency projection`,
      affectedEntityType: 'order',
      affectedEntityId: order.id,
    }));
}

/**
 * Compares base_cur_* reporting snapshots to transaction-currency amounts
 * projected with the stored order-level historical exchange rate.
 * @param tenantOrgId
 * @param window
 */
export async function checkBaseVsOrderAmountConsistency(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orders = await withTenantContext(tenantOrgId, () =>
    prisma.org_orders_mst.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        created_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: {
        id: true,
        order_no: true,
        currency_ex_rate: true,
        total_amount: true,
        total_tax_amount: true,
        total_paid_amount: true,
        total_credit_applied_amount: true,
        outstanding_amount: true,
        ar_receivable_amount: true,
        base_cur_total_amount: true,
        base_cur_tax_amount: true,
        base_cur_paid_amount: true,
        base_cur_credit_applied_amount: true,
        base_cur_outstanding_amount: true,
        base_cur_ar_receivable_amount: true,
      },
    }),
  );
  const results: CheckResult[] = [];

  for (const order of orders) {
    const rate = toNumber(order.currency_ex_rate);
    if (rate <= 0) continue;

    const comparisons = [
      ['base_cur_total_amount', toNumber(order.total_amount) * rate, toNumber(order.base_cur_total_amount)],
      ['base_cur_tax_amount', toNumber(order.total_tax_amount) * rate, toNumber(order.base_cur_tax_amount)],
      ['base_cur_paid_amount', toNumber(order.total_paid_amount) * rate, toNumber(order.base_cur_paid_amount)],
      [
        'base_cur_credit_applied_amount',
        toNumber(order.total_credit_applied_amount) * rate,
        toNumber(order.base_cur_credit_applied_amount),
      ],
      [
        'base_cur_outstanding_amount',
        toNumber(order.outstanding_amount) * rate,
        toNumber(order.base_cur_outstanding_amount),
      ],
      [
        'base_cur_ar_receivable_amount',
        toNumber(order.ar_receivable_amount) * rate,
        toNumber(order.base_cur_ar_receivable_amount),
      ],
    ] as const;

    for (const [label, expectedRaw, actual] of comparisons) {
      const expected = Math.round((expectedRaw + Number.EPSILON) * 10000) / 10000;
      const delta = actual - expected;
      if (Math.abs(delta) < RECONCILIATION_TOLERANCE) continue;

      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.BASE_VS_ORDER_AMOUNT_CONSISTENCY,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: expected,
        actualValue: actual,
        delta,
        message: `Order ${order.order_no}: ${label} (${actual}) does not match transaction amount projected at currency_ex_rate ${rate} (${expected})`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }
  }

  return results;
}

/**
 * ADR-017 — Pricing mode consistency check.
 *
 * Reads the `taxPricingModeAtCalculation` field from the stored
 * `financial_calculation_snapshot` and compares it to the current effective
 * branch/tenant config. A mismatch means the snapshot was calculated under
 * a different mode than what the branch is now configured for and the order
 * needs a re-snapshot.
 * @param tenantId
 * @param window
 */
export async function checkPricingModeConsistency(
  tenantId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orders = await withTenantContext(
    tenantId,
    () =>
      prisma.org_orders_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          created_at: { gte: window.periodFrom, lte: window.periodTo },
          financial_calculation_snapshot: { not: Prisma.AnyNull },
        },
        select: {
          id: true,
          order_no: true,
          branch_id: true,
          financial_calculation_snapshot: true,
        },
      }),
  );

  const results: CheckResult[] = [];

  for (const order of orders) {
    const snapshot = order.financial_calculation_snapshot as Record<string, unknown> | null;
    if (!snapshot || typeof snapshot !== 'object') continue;

    const recordedMode = snapshot['taxPricingModeAtCalculation'] as string | undefined;
    if (!recordedMode) continue;

    const branch = order.branch_id
      ? await prisma.org_branches_mst.findFirst({
          where: { id: order.branch_id, tenant_org_id: tenantId },
          select: { tax_pricing_mode: true },
        })
      : null;

    const currentMode =
      (branch?.tax_pricing_mode ?? null) ||
      (await prisma.org_tenants_mst.findFirst({
        where: { id: tenantId },
        select: { tax_pricing_mode: true },
      }).then((t) => t?.tax_pricing_mode ?? 'TAX_EXCLUSIVE'));

    if (recordedMode !== currentMode) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.PRICING_MODE_CONSISTENCY,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        message: `Order ${order.order_no}: snapshot tax_pricing_mode '${recordedMode}' differs from current branch/tenant config '${currentMode}' — recalculation required`,
        affectedEntityType: 'order',
        affectedEntityId: order.id,
      });
    }
  }

  return results;
}

/**
 * ADR-030 — Refund source lineage classification check.
 *
 * Flags any active, processed refund that still carries MANUAL_EXCEPTION
 * as its refund_source_type. These rows require finance lead review and
 * explicit reclassification via the `refunds:mark_manual_exception` permission.
 * @param tenantId
 * @param window
 */
export async function checkRefundSourceLineageClassification(
  tenantId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const validTypes = new Set<string>(Object.values(REFUND_SOURCE_TYPES));

  const refunds = await withTenantContext(
    tenantId,
    () =>
      prisma.org_order_refunds_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          is_active: true,
          refund_status: 'PROCESSED',
          created_at: { gte: window.periodFrom, lte: window.periodTo },
        },
        select: {
          id: true,
          order_id: true,
          refund_source_type: true,
          refund_amount: true,
        },
      }),
  );

  const results: CheckResult[] = [];

  for (const refund of refunds) {
    const sourceType = (refund.refund_source_type ?? '').toUpperCase();

    if (!validTypes.has(sourceType) || sourceType === REFUND_SOURCE_TYPES.MANUAL_EXCEPTION) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.REFUND_SOURCE_LINEAGE_CLASSIFICATION,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        message: `Refund ${refund.id} on order ${refund.order_id} has refund_source_type '${refund.refund_source_type ?? 'NULL'}' — manual finance review required`,
        affectedEntityType: 'refund',
        affectedEntityId: refund.id,
      });
    }
  }

  return results;
}

/**
 * ADR-030 — Refund reopen-due bound check.
 *
 * Verifies that reopens_due_amount <= refund_amount on every active refund row.
 * The DB-level CHECK constraint enforces this at write time; this reconciliation
 * check catches any rows that bypassed the constraint (e.g. direct SQL updates).
 * @param tenantId
 * @param window
 */
export async function checkRefundReopensDueBound(
  tenantId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const refunds = await withTenantContext(
    tenantId,
    () =>
      prisma.org_order_refunds_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          is_active: true,
          created_at: { gte: window.periodFrom, lte: window.periodTo },
        },
        select: {
          id: true,
          order_id: true,
          refund_amount: true,
          reopens_due_amount: true,
        },
      }),
  );

  const results: CheckResult[] = [];

  for (const refund of refunds) {
    const refundAmt = toNumber(refund.refund_amount);
    const reopensAmt = toNumber(refund.reopens_due_amount);

    if (reopensAmt > refundAmt + RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.REFUND_REOPENS_DUE_BOUND,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: refundAmt,
        actualValue: reopensAmt,
        delta: reopensAmt - refundAmt,
        message: `Refund ${refund.id} on order ${refund.order_id}: reopens_due_amount (${reopensAmt}) exceeds refund_amount (${refundAmt})`,
        affectedEntityType: 'refund',
        affectedEntityId: refund.id,
      });
    }
  }

  return results;
}

// ─── Phase 7 — Tax-document reconciliation checks ────────────────────────────

/**
 * RECON_TAX_DOC_SEQUENCE_GAPS — warns if there are gaps in the fiscal
 * sequence for any (tenant, document_type, fiscal_year) combination in the
 * reconciliation window.
 *
 * A gap means a sequence number between 1 and last_sequence has no matching
 * ISSUED document row (SUPERSEDED documents still hold their sequence number
 * so they don't count as gaps).
 * @param tenantId
 * @param window
 */
export async function checkTaxDocSequenceGaps(
  tenantId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const fiscalYear = window.periodFrom.getFullYear();

  const [counters, issuedDocs] = await Promise.all([
    prisma.org_tax_doc_seq_counters.findMany({
      where: { tenant_org_id: tenantId, fiscal_year: fiscalYear },
      select: { document_type: true, last_sequence: true },
    }),
    withTenantContext(
      tenantId,
      () =>
        prisma.org_tax_documents_mst.findMany({
          where: {
            tenant_org_id: tenantId,
            fiscal_year: fiscalYear,
            status: { in: [TAX_DOCUMENT_STATUSES.ISSUED, TAX_DOCUMENT_STATUSES.SUPERSEDED] },
            sequence_number: { gt: 0 },
          },
          select: { document_type: true, sequence_number: true },
        }),
    ),
  ]);

  const results: CheckResult[] = [];

  for (const counter of counters) {
    if (counter.last_sequence === 0) continue;

    const usedSequences = new Set(
      issuedDocs
        .filter((d) => d.document_type === counter.document_type)
        .map((d) => d.sequence_number),
    );

    const gapCount = Array.from({ length: counter.last_sequence }, (_, i) => i + 1)
      .filter((seq) => !usedSequences.has(seq)).length;

    if (gapCount > 0) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.RECON_TAX_DOC_SEQUENCE_GAPS,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        expectedValue: counter.last_sequence,
        actualValue: usedSequences.size,
        delta: gapCount,
        message: `Tax document sequence gaps: ${gapCount} gap(s) in ${counter.document_type} fiscal ${fiscalYear} (last_sequence=${counter.last_sequence}, issued=${usedSequences.size})`,
        affectedEntityType: 'tax_document_sequence',
        affectedEntityId: `${tenantId}:${counter.document_type}:${fiscalYear}`,
      });
    }
  }

  return results;
}

/**
 * RECON_TAX_DOC_IMMUTABILITY — detects ISSUED documents that were updated
 * after issuance (updated_at > issued_at). This should never occur if the
 * DB trigger is in place; this check is the application-layer safety net.
 * @param tenantId
 * @param window
 */
export async function checkTaxDocImmutability(
  tenantId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const docs = await withTenantContext(
    tenantId,
    () =>
      prisma.org_tax_documents_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          status: TAX_DOCUMENT_STATUSES.ISSUED,
          issued_at: { gte: window.periodFrom, lte: window.periodTo },
        },
        select: { id: true, issued_at: true, updated_at: true, document_no: true },
      }),
  );

  const results: CheckResult[] = [];

  for (const doc of docs) {
    if (doc.updated_at && doc.issued_at && doc.updated_at > doc.issued_at) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.RECON_TAX_DOC_IMMUTABILITY,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        message: `ISSUED tax document ${doc.document_no ?? doc.id} was updated after issuance (updated_at=${doc.updated_at.toISOString()}, issued_at=${doc.issued_at.toISOString()})`,
        affectedEntityType: 'tax_document',
        affectedEntityId: doc.id,
      });
    }
  }

  return results;
}

/**
 * RECON_TAX_DOC_VS_ORDER_TOTALS — verifies that the total_amount on each
 * ISSUED tax document matches the order's total_amount at the time of
 * reconciliation.
 *
 * Note: a mismatch is expected for SUPERSEDED documents (the correction chain
 * takes care of the delta), so those are excluded.
 * @param tenantId
 * @param window
 */
export async function checkTaxDocVsOrderTotals(
  tenantId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const docs = await withTenantContext(
    tenantId,
    () =>
      prisma.org_tax_documents_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          status: TAX_DOCUMENT_STATUSES.ISSUED,
          issued_at: { gte: window.periodFrom, lte: window.periodTo },
        },
        select: {
          id: true,
          document_no: true,
          order_id: true,
          total_amount: true,
          org_orders_mst: {
            select: { total_amount: true },
          },
        },
      }),
  );

  const results: CheckResult[] = [];

  for (const doc of docs) {
    const docTotal = toNumber(doc.total_amount);
    const orderTotal = toNumber(doc.org_orders_mst?.total_amount ?? 0);

    if (Math.abs(docTotal - orderTotal) > RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.RECON_TAX_DOC_VS_ORDER_TOTALS,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        expectedValue: orderTotal,
        actualValue: docTotal,
        delta: docTotal - orderTotal,
        message: `Tax document ${doc.document_no ?? doc.id} total (${docTotal}) differs from order ${doc.order_id} total (${orderTotal})`,
        affectedEntityType: 'tax_document',
        affectedEntityId: doc.id,
      });
    }
  }

  return results;
}
