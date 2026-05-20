import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_RUN_STATUSES,
  RECONCILIATION_SEVERITIES,
} from '@/lib/constants/order-financial';
import type { ReconciliationSeverity } from '@/lib/types/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface ReconciliationParams {
  periodFrom: Date;
  periodTo: Date;
  branchId?: string;
  currencyCode: string;
  triggeredBy?: string;
}

interface ReconciliationOrderRow {
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

interface CheckResult {
  checkName: string;
  severity: ReconciliationSeverity;
  passed: boolean;
  expectedValue?: number;
  actualValue?: number;
  delta?: number;
  message: string;
  affectedEntityType?: string;
  affectedEntityId?: string;
}

interface ReconciliationIssueSummary {
  issueCount: number;
  blockerCount: number;
  warningCount: number;
}

async function getScopedOrders(
  tenantId: string,
  params: Pick<ReconciliationParams, 'periodFrom' | 'periodTo' | 'branchId' | 'currencyCode'>
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
        total: true,
        total_paid_amount: true,
        total_credit_applied_amount: true,
        outstanding_amount: true,
        payment_status: true,
        payment_type_code: true,
        pay_on_collection_amount: true,
      },
    })
  );
}

async function getOrderById(
  tenantId: string,
  orderId: string
): Promise<ReconciliationOrderRow> {
  return withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findFirstOrThrow({
      where: {
        tenant_org_id: tenantId,
        id: orderId,
      },
      select: {
        id: true,
        order_no: true,
        total: true,
        total_paid_amount: true,
        total_credit_applied_amount: true,
        outstanding_amount: true,
        payment_status: true,
        payment_type_code: true,
        pay_on_collection_amount: true,
      },
    })
  );
}

async function buildOrderIssues(
  tenantId: string,
  orders: ReconciliationOrderRow[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const order of orders) {
    const [payments, creditAgg, refundAgg] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_order_payments_dtl.findMany({
          where: { tenant_org_id: tenantId, order_id: order.id, is_active: true },
          select: { amount: true, payment_status: true, gateway_code: true },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_order_credit_apps_dtl.aggregate({
          where: { tenant_org_id: tenantId, order_id: order.id, is_active: true },
          _sum: { applied_amount: true },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_order_refunds_dtl.aggregate({
          where: {
            tenant_org_id: tenantId,
            order_id: order.id,
            is_active: true,
            refund_status: 'PROCESSED',
          },
          _sum: { refund_amount: true },
        })
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

    if (Math.abs(paidDelta) >= 0.01) {
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
    if (Math.abs(creditDelta) >= 0.01) {
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

    if (Math.abs(outstandingDelta) >= 0.01) {
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

    if (processedRefunds - grossApplied >= 0.01) {
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
        severity: actualOutstanding <= 0 ? RECONCILIATION_SEVERITIES.WARNING : RECONCILIATION_SEVERITIES.INFO,
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
    const isLegacyLowercase = ['pending', 'partial', 'paid', 'overpaid'].includes(normalizedRaw);
    if (isLegacyLowercase) {
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

async function checkStoredValueLedger(tenantId: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const wallets = await withTenantContext(tenantId, () =>
    prisma.org_customer_wallets_mst.findMany({
      where: { tenant_org_id: tenantId, is_active: true },
      select: { id: true, balance: true },
    })
  );

  for (const wallet of wallets) {
    const ledgerSum = await withTenantContext(tenantId, () =>
      prisma.org_wallet_txn_dtl.aggregate({
        where: { tenant_org_id: tenantId, wallet_id: wallet.id },
        _sum: { amount: true },
      })
    );
    const ledger = toNumber(ledgerSum._sum.amount);
    const balance = toNumber(wallet.balance);
    if (Math.abs(ledger - balance) >= 0.01) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.STORED_VALUE_LEDGER,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: balance,
        actualValue: ledger,
        delta: ledger - balance,
        message: `Wallet ${wallet.id}: ledger sum (${ledger}) does not match balance (${balance})`,
        affectedEntityType: 'wallet',
        affectedEntityId: wallet.id,
      });
    }
  }

  return results;
}

async function checkOutboxStuck(tenantId: string): Promise<CheckResult[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  const stuck = await prisma.org_domain_events_outbox.count({
    where: {
      tenant_org_id: tenantId,
      status: { in: ['PENDING', 'FAILED'] },
      created_at: { lte: oneHourAgo },
    },
  });

  if (stuck > 0) {
    return [{
      checkName: RECONCILIATION_CHECK_NAMES.OUTBOX_PROCESSED,
      severity: RECONCILIATION_SEVERITIES.WARNING,
      passed: false,
      actualValue: stuck,
      message: `${stuck} outbox event(s) have been stuck for more than one hour`,
    }];
  }

  return [];
}

function summarizeIssues(
  issues: CheckResult[],
  totalChecks: number
): ReconciliationIssueSummary & {
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  finalStatus: string;
} {
  const blockerChecks = new Set(
    issues
      .filter((issue) => issue.severity === RECONCILIATION_SEVERITIES.BLOCKER)
      .map((issue) => issue.checkName)
  );
  const warningChecks = new Set(
    issues
      .filter((issue) => issue.severity === RECONCILIATION_SEVERITIES.WARNING)
      .map((issue) => issue.checkName)
      .filter((name) => !blockerChecks.has(name))
  );

  const failedChecks = blockerChecks.size;
  const warningCheckCount = warningChecks.size;
  const passedChecks = Math.max(0, totalChecks - failedChecks - warningCheckCount);

  const finalStatus =
    failedChecks > 0 ? RECONCILIATION_RUN_STATUSES.FAILED
    : warningCheckCount > 0 ? RECONCILIATION_RUN_STATUSES.PARTIAL
    : RECONCILIATION_RUN_STATUSES.PASSED;

  return {
    issueCount: issues.length,
    blockerCount: issues.filter((issue) => issue.severity === RECONCILIATION_SEVERITIES.BLOCKER).length,
    warningCount: issues.filter((issue) => issue.severity === RECONCILIATION_SEVERITIES.WARNING).length,
    passedChecks,
    failedChecks,
    warningChecks: warningCheckCount,
    finalStatus,
  };
}

/**
 * Live order-scoped reconciliation. Used by the canonical order finance API
 * surfaces without persisting a tenant-level reconciliation run.
 */
export async function getOrderFinancialReconciliation(
  tenantId: string,
  orderId: string
) {
  const order = await getOrderById(tenantId, orderId);
  const issues = await buildOrderIssues(tenantId, [order]);
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
 */
export async function runReconciliation(
  tenantId: string,
  params: ReconciliationParams
) {
  const { periodFrom, periodTo, branchId, currencyCode, triggeredBy } = params;

  const count = await withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.count({ where: { tenant_org_id: tenantId } })
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
    })
  );

  const orders = await getScopedOrders(tenantId, { periodFrom, periodTo, branchId, currencyCode });
  const allIssues = (
    await Promise.all([
      buildOrderIssues(tenantId, orders),
      checkStoredValueLedger(tenantId),
      checkOutboxStuck(tenantId),
    ])
  ).flat();

  for (const issue of allIssues) {
    await withTenantContext(tenantId, () =>
      prisma.org_fin_recon_issues_dtl.create({
        data: {
          tenant_org_id: tenantId,
          run_id: run.id,
          check_name: issue.checkName,
          severity: issue.severity,
          affected_entity_type: issue.affectedEntityType ?? null,
          affected_entity_id: issue.affectedEntityId ?? null,
          expected_value: issue.expectedValue ?? null,
          actual_value: issue.actualValue ?? null,
          delta: issue.delta ?? null,
          message: issue.message,
          status: 'OPEN',
        },
      })
    );
  }

  const summary = summarizeIssues(allIssues, 8);

  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.update({
      where: { id: run.id },
      data: {
        status: summary.finalStatus,
        total_checked: 8,
        passed_checks: summary.passedChecks,
        failed_checks: summary.failedChecks,
        warning_checks: summary.warningChecks,
        completed_at: new Date(),
      },
    })
  );
}

export async function acknowledgeIssue(
  tenantId: string,
  issueId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
  notes?: string,
  userId?: string
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
    })
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
    ])
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
    })
  );
}
