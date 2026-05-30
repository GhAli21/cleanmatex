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

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  CREDIT_APPLICATION_TYPES,
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
} from '@/lib/constants/order-financial';
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
  total: Decimal | null;
  total_paid_amount: Decimal | null;
  total_credit_applied_amount: Decimal | null;
  outstanding_amount: Decimal | null;
  payment_status: string | null;
  payment_type_code: string | null;
  pay_on_collection_amount: Decimal | null;
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
    const expectedOutstanding = Math.max(0, toNumber(order.total) - grossApplied + processedRefunds);
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
