import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_RUN_STATUSES,
  type ReconciliationCheckName,
} from '@/lib/constants/order-financial';

import {
  persistReconciliationIssues,
  summarizeIssues,
  type CheckResult,
} from './reconciliation/types';
import {
  checkInvoicePaymentLink,
  checkRefundLink,
} from './reconciliation/ar-checks';
import {
  checkAdvanceLedgerLink,
  checkCreditNoteLedgerLink,
  checkGiftCardLedgerLink,
  checkLoyaltyLedgerLink,
  checkWalletBalanceMatchesLedger,
  checkWalletLedgerLink,
} from './reconciliation/stored-value-checks';
import {
  checkOrderCreditApplicationAmountMatchesLine,
  checkOrderCreditApplicationLink,
  checkOrderCreditApplicationNotInDiscounts,
  checkOrderCreditApplicationNotInPayments,
  checkOrderPaymentAmountMatchesLine,
  checkOrderPaymentLink,
  checkOutboxStuck,
  runOrderBalanceChecks,
  type ReconciliationOrderRow,
} from './reconciliation/order-checks';
import { runOrderSnapshotChecks } from './reconciliation/order-snapshot-checks';
import {
  checkCashMovementAmountEqualsRetained,
  checkCashMovementLink,
  getPostedVouchersInWindow,
  runVoucherIntegrityChecks,
} from './reconciliation/voucher-checks';

export interface ReconciliationParams {
  periodFrom: Date;
  periodTo: Date;
  branchId?: string;
  currencyCode: string;
  triggeredBy?: string;
}

/**
 * Closed list of check identifiers the orchestrator executes on every run.
 *
 * Why this list (and not Object.values(RECONCILIATION_CHECK_NAMES)):
 * `RECONCILIATION_CHECK_NAMES` is a superset that also covers checks that
 * exist as constants but are not yet implemented (TAX_CALCULATION,
 * DISCOUNT_VALIDATION). Counting the implemented set keeps
 * `org_fin_recon_runs_mst.total_checked` accurate so the UI can render the
 * "X of Y passed" badge without lying. Update this list when a new check is
 * wired below.
 */
const EXECUTED_CHECK_NAMES: readonly ReconciliationCheckName[] = [
  // ── Order balance (legacy + factored into order-checks.ts) ────────────
  RECONCILIATION_CHECK_NAMES.PAYMENT_TOTAL_MATCH,
  RECONCILIATION_CHECK_NAMES.CREDIT_APP_BALANCE,
  RECONCILIATION_CHECK_NAMES.OUTSTANDING_TOTAL_MATCH,
  RECONCILIATION_CHECK_NAMES.REFUND_CONSISTENCY,
  RECONCILIATION_CHECK_NAMES.GATEWAY_PENDING_INTEGRITY,
  RECONCILIATION_CHECK_NAMES.LEGACY_STATUS_LEAKAGE,
  RECONCILIATION_CHECK_NAMES.OUTBOX_PROCESSED,
  // ── Order ↔ voucher link checks (PRD §22.1) ───────────────────────────
  RECONCILIATION_CHECK_NAMES.ORDER_PAYMENT_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.ORDER_PAYMENT_AMOUNT_MATCHES_LINE,
  RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE,
  RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS,
  RECONCILIATION_CHECK_NAMES.ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS,
  // ── Order snapshot / charge integrity (PRD §22.1) ─────────────────────
  RECONCILIATION_CHECK_NAMES.ORDER_CHARGES_MATCH_SNAPSHOT,
  RECONCILIATION_CHECK_NAMES.ORDER_PIECES_MATCH_CHARGES,
  RECONCILIATION_CHECK_NAMES.ORDER_PREFERENCES_MATCH_CHARGES,
  RECONCILIATION_CHECK_NAMES.PIECE_EXTRA_PRICE_INCLUDED_ONCE,
  RECONCILIATION_CHECK_NAMES.PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE,
  // ── Voucher integrity (PRD §22.1) ─────────────────────────────────────
  RECONCILIATION_CHECK_NAMES.VOUCHER_TOTAL_EQUALS_LINES,
  RECONCILIATION_CHECK_NAMES.NO_DUPLICATE_OPERATIONAL_EFFECT,
  RECONCILIATION_CHECK_NAMES.GATEWAY_STATE_VALID,
  // ── Stored-value ledger backlinks (PRD §22.1) ─────────────────────────
  RECONCILIATION_CHECK_NAMES.STORED_VALUE_LEDGER,
  RECONCILIATION_CHECK_NAMES.WALLET_LEDGER_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.ADVANCE_LEDGER_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.GIFT_CARD_LEDGER_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.CREDIT_NOTE_LEDGER_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.LOYALTY_LEDGER_LINK_EXISTS,
  // ── Cash drawer integrity (PRD §22.1) ─────────────────────────────────
  RECONCILIATION_CHECK_NAMES.CASH_MOVEMENT_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT,
  // ── AR link checks (PRD §22.1) ────────────────────────────────────────
  RECONCILIATION_CHECK_NAMES.INVOICE_PAYMENT_LINK_EXISTS,
  RECONCILIATION_CHECK_NAMES.REFUND_LINK_EXISTS,
];

/** Total executed checks per run — published as `total_checked` on the run row. */
const RECONCILIATION_TOTAL_CHECKS = EXECUTED_CHECK_NAMES.length;

/**
 * Fetch orders in the recon window with the projection consumed by every
 * order-scoped check module (`runOrderBalanceChecks`, `runOrderSnapshotChecks`).
 *
 * Why a centralised projection: the shape is shared with
 * `ReconciliationOrderRow` (exported by `order-checks.ts`) so the type
 * contract between orchestrator and check modules cannot drift silently.
 */
async function getScopedOrders(
  tenantId: string,
  params: Pick<ReconciliationParams, 'periodFrom' | 'periodTo' | 'branchId' | 'currencyCode'>,
): Promise<ReconciliationOrderRow[]> {
  return withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        created_at: { gte: params.periodFrom, lte: params.periodTo },
        ...(params.branchId ? { branch_id: params.branchId } : {}),
        ...(params.currencyCode ? { currency_code: params.currencyCode } : {}),
      },
      select: {
        id: true,
        order_no: true,
        total_amount: true,
        total_paid_amount: true,
        total_credit_applied_amount: true,
        outstanding_amount: true,
        payment_status: true,
        payment_type_code: true,
        pay_on_collection_amount: true,
      },
    }),
  );
}

/**
 * Live order-scoped reconciliation. Used by the canonical order finance API
 * surfaces without persisting a tenant-level reconciliation run.
 *
 * Only runs the per-order balance checks today (PRD §22.1 link/snapshot
 * checks are tenant-window-scoped). The output shape is kept identical to
 * the pre-Phase-4 service so existing callers do not break.
 */
export async function getOrderFinancialReconciliation(
  tenantId: string,
  orderId: string,
) {
  const order = await withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findFirstOrThrow({
      where: { tenant_org_id: tenantId, id: orderId },
      select: {
        id: true,
        order_no: true,
        total_amount: true,
        total_paid_amount: true,
        total_credit_applied_amount: true,
        outstanding_amount: true,
        payment_status: true,
        payment_type_code: true,
        pay_on_collection_amount: true,
      },
    }),
  );
  const issues = await runOrderBalanceChecks(tenantId, [order]);
  // The 6 per-order balance checks are the only ones meaningful at single-
  // order granularity — total_checked reflects that.
  const summary = summarizeIssues(issues, 6);

  return {
    orderId: order.id,
    orderNo: order.order_no,
    paymentStatus: order.payment_status,
    issues,
    summary,
  };
}

/**
 * Run the tenant-level reconciliation pass and persist its issues.
 *
 * Pipeline:
 *   1. Create the run row with `status = RUNNING`.
 *   2. Fetch the window's order set (single query) and window helpers fetch
 *      vouchers/cash-movements lazily.
 *   3. Fan out every PRD §22.1 check module in parallel via `Promise.all`.
 *   4. Bulk-insert all issues with `persistReconciliationIssues` so a partial
 *      failure cannot leave a half-written run (BVM R7 fix).
 *   5. Summarise via `summarizeIssues` using the dynamic `RECONCILIATION_TOTAL_CHECKS`.
 *   6. Update the run row with final status + counts.
 */
export async function runReconciliation(
  tenantId: string,
  params: ReconciliationParams,
) {
  const { periodFrom, periodTo, branchId, currencyCode, triggeredBy } = params;

  const count = await withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.count({ where: { tenant_org_id: tenantId } }),
  );
  const runNo = `RECON-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

  const run = await withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.create({
      data: {
        tenant_org_id: tenantId,
        run_no: runNo,
        run_type: 'MANUAL',
        period_from: periodFrom,
        period_to: periodTo,
        branch_id: branchId ?? null,
        currency_code: currencyCode,
        status: RECONCILIATION_RUN_STATUSES.RUNNING,
        triggered_by: triggeredBy ?? null,
      },
    }),
  );

  const orders = await getScopedOrders(tenantId, { periodFrom, periodTo, branchId, currencyCode });
  const window = { periodFrom, periodTo };

  // Voucher integrity needs the in-window voucher header set up front so the
  // VOUCHER_TOTAL_EQUALS_LINES, NO_DUPLICATE_OPERATIONAL_EFFECT, and
  // GATEWAY_STATE_VALID checks share one fetch.
  const vouchers = await getPostedVouchersInWindow(tenantId, window);

  // Fan-out: every check module returns CheckResult[]; the orchestrator
  // simply concatenates them. `Promise.all` keeps the wall-clock close to
  // the slowest check rather than the sum.
  const allIssues: CheckResult[] = (
    await Promise.all([
      // Order balance + outbox
      runOrderBalanceChecks(tenantId, orders),
      checkOutboxStuck(tenantId),
      // Order ↔ voucher link
      checkOrderPaymentLink(tenantId, window),
      checkOrderPaymentAmountMatchesLine(tenantId, window),
      checkOrderCreditApplicationLink(tenantId, window),
      checkOrderCreditApplicationAmountMatchesLine(tenantId, window),
      checkOrderCreditApplicationNotInPayments(tenantId, window),
      checkOrderCreditApplicationNotInDiscounts(tenantId, window),
      // Order snapshot
      runOrderSnapshotChecks(tenantId, orders),
      // Voucher integrity
      runVoucherIntegrityChecks(tenantId, vouchers),
      // Stored-value ledger
      checkWalletBalanceMatchesLedger(tenantId),
      checkWalletLedgerLink(tenantId, window),
      checkAdvanceLedgerLink(tenantId, window),
      checkGiftCardLedgerLink(tenantId, window),
      checkCreditNoteLedgerLink(tenantId, window),
      checkLoyaltyLedgerLink(tenantId, window),
      // Cash drawer
      checkCashMovementLink(tenantId, window),
      checkCashMovementAmountEqualsRetained(tenantId, window),
      // AR
      checkInvoicePaymentLink(tenantId, window),
      checkRefundLink(tenantId, window),
    ])
  ).flat();

  // Bulk insert — single round-trip, atomic w.r.t. the caller's tenant
  // context. Replaces the pre-Phase-4 per-row loop (R7 fix).
  await withTenantContext(tenantId, () =>
    persistReconciliationIssues(prisma, tenantId, run.id, allIssues),
  );

  const summary = summarizeIssues(allIssues, RECONCILIATION_TOTAL_CHECKS);

  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.update({
      where: { id: run.id },
      data: {
        status: summary.finalStatus,
        total_checked: RECONCILIATION_TOTAL_CHECKS,
        passed_checks: summary.passedChecks,
        failed_checks: summary.failedChecks,
        warning_checks: summary.warningChecks,
        completed_at: new Date(),
      },
    }),
  );
}

/**
 * Mark a reconciliation issue as acknowledged or resolved.
 *
 * @see app/api/v1/finance/reconciliation/issues/[issueId]/route.ts for the
 *      PATCH route (permission code: `reconciliation:acknowledge_issues`,
 *      seeded by mig 0294; BVM R1 fix).
 */
export async function acknowledgeIssue(
  tenantId: string,
  issueId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
  notes?: string,
  userId?: string,
) {
  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_issues_dtl.update({
      where: { id: issueId, tenant_org_id: tenantId },
      data: {
        status,
        notes: notes ?? null,
        ...(status === 'ACKNOWLEDGED'
          ? { acknowledged_by: userId ?? null, acknowledged_at: new Date() }
          : { resolved_by: userId ?? null, resolved_at: new Date() }),
      },
    }),
  );
}

export async function listReconRuns(tenantId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await withTenantContext(tenantId, () =>
    Promise.all([
      prisma.org_fin_recon_runs_mst.findMany({
        where: { tenant_org_id: tenantId },
        orderBy: { started_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.org_fin_recon_runs_mst.count({ where: { tenant_org_id: tenantId } }),
    ]),
  );
  return { items, total, page, pageSize };
}

export async function getReconRunWithIssues(tenantId: string, runId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.findFirstOrThrow({
      where: { id: runId, tenant_org_id: tenantId },
      include: {
        org_fin_recon_issues_dtl: {
          orderBy: [{ severity: 'asc' }, { created_at: 'asc' }],
        },
      },
    }),
  );
}

/** Re-export so tests and callers can pin the run's expected check count. */
export { RECONCILIATION_TOTAL_CHECKS };
