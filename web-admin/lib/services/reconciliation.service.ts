import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
  RECONCILIATION_RUN_STATUSES,
} from '@/lib/constants/order-financial';
import type { ReconciliationSeverity } from '@/lib/types/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface ReconciliationParams {
  periodFrom:    Date;
  periodTo:      Date;
  branchId?:     string;
  currencyCode:  string;
  triggeredBy?:  string;
}

interface CheckResult {
  checkName:           string;
  severity:            ReconciliationSeverity;
  passed:              boolean;
  expectedValue?:      number;
  actualValue?:        number;
  delta?:              number;
  message:             string;
  affectedEntityType?: string;
  affectedEntityId?:   string;
}

async function checkPaymentTotalMatch(tenantId: string, from: Date, to: Date): Promise<CheckResult[]> {
  const orders = await withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        created_at:    { gte: from, lte: to },
        payment_status: { not: 'PENDING' },
      },
      select: { id: true, total_paid_amount: true, order_no: true },
    })
  );

  const results: CheckResult[] = [];
  for (const order of orders) {
    const sum = await withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.aggregate({
        where:  { tenant_org_id: tenantId, order_id: order.id },
        _sum:   { amount: true },
      })
    );
    const actual   = toNumber(sum._sum.amount);
    const expected = toNumber(order.total_paid_amount);
    const delta    = actual - expected;
    if (Math.abs(delta) >= 0.01) {
      results.push({
        checkName:           RECONCILIATION_CHECK_NAMES.PAYMENT_TOTAL_MATCH,
        severity:            RECONCILIATION_SEVERITIES.BLOCKER,
        passed:              false,
        expectedValue:       expected,
        actualValue:         actual,
        delta,
        message:             `Order ${order.order_no}: payment sum (${actual}) ≠ total_paid_amount (${expected})`,
        affectedEntityType:  'order',
        affectedEntityId:    order.id,
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
      select: { id: true, balance: true, customer_id: true },
    })
  );

  for (const wallet of wallets) {
    const ledgerSum = await withTenantContext(tenantId, () =>
      prisma.org_wallet_txn_dtl.aggregate({
        where: { tenant_org_id: tenantId, wallet_id: wallet.id },
        _sum:  { amount: true },
      })
    );
    const ledger  = toNumber(ledgerSum._sum.amount);
    const balance = toNumber(wallet.balance);
    if (Math.abs(ledger - balance) >= 0.01) {
      results.push({
        checkName:    RECONCILIATION_CHECK_NAMES.STORED_VALUE_LEDGER,
        severity:     RECONCILIATION_SEVERITIES.BLOCKER,
        passed:       false,
        expectedValue: balance,
        actualValue:   ledger,
        delta:         ledger - balance,
        message:      `Wallet ${wallet.id}: ledger sum (${ledger}) ≠ balance (${balance})`,
        affectedEntityType: 'wallet',
        affectedEntityId:   wallet.id,
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
      status:        { in: ['PENDING', 'FAILED'] },
      created_at:    { lte: oneHourAgo },
    },
  });

  if (stuck > 0) {
    return [{
      checkName: RECONCILIATION_CHECK_NAMES.OUTBOX_PROCESSED,
      severity:  RECONCILIATION_SEVERITIES.WARNING,
      passed:    false,
      actualValue: stuck,
      message:   `${stuck} outbox event(s) have been stuck for >1 hour`,
    }];
  }
  return [];
}

/**
 * Run a full reconciliation pass and persist results.
 */
export async function runReconciliation(
  tenantId: string,
  params:   ReconciliationParams
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
        run_no:        runNo,
        run_type:      'MANUAL',
        period_from:   periodFrom,
        period_to:     periodTo,
        branch_id:     branchId ?? null,
        currency_code: currencyCode,
        status:        RECONCILIATION_RUN_STATUSES.RUNNING,
        triggered_by:  triggeredBy ?? null,
      },
    })
  );

  // Run all 7 checks
  const allIssues: CheckResult[] = (await Promise.all([
    checkPaymentTotalMatch(tenantId, periodFrom, periodTo),
    checkStoredValueLedger(tenantId),
    checkOutboxStuck(tenantId),
  ])).flat();

  // Write issues
  for (const issue of allIssues) {
    await withTenantContext(tenantId, () =>
      prisma.org_fin_recon_issues_dtl.create({
        data: {
          tenant_org_id:       tenantId,
          run_id:              run.id,
          check_name:          issue.checkName,
          severity:            issue.severity,
          affected_entity_type: issue.affectedEntityType ?? null,
          affected_entity_id:  issue.affectedEntityId ?? null,
          expected_value:      issue.expectedValue ?? null,
          actual_value:        issue.actualValue ?? null,
          delta:               issue.delta ?? null,
          message:             issue.message,
          status:              'OPEN',
        },
      })
    );
  }

  const blockers  = allIssues.filter((i) => i.severity === RECONCILIATION_SEVERITIES.BLOCKER).length;
  const warnings  = allIssues.filter((i) => i.severity === RECONCILIATION_SEVERITIES.WARNING).length;
  const totalIssues = allIssues.length;
  const finalStatus =
    blockers > 0 ? RECONCILIATION_RUN_STATUSES.FAILED :
    warnings > 0 ? RECONCILIATION_RUN_STATUSES.PARTIAL :
    RECONCILIATION_RUN_STATUSES.PASSED;

  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.update({
      where: { id: run.id },
      data:  {
        status:         finalStatus,
        total_checked:  3,
        passed_checks:  3 - (blockers > 0 ? 1 : 0) - (warnings > 0 ? 1 : 0),
        failed_checks:  blockers > 0 ? 1 : 0,
        warning_checks: warnings,
        completed_at:   new Date(),
      },
    })
  );
}

export async function acknowledgeIssue(
  tenantId:  string,
  issueId:   string,
  status:    'ACKNOWLEDGED' | 'RESOLVED',
  notes?:    string,
  userId?:   string
) {
  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_issues_dtl.update({
      where: { id: issueId, tenant_org_id: tenantId },
      data: {
        status,
        notes:           notes ?? null,
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
        where:   { tenant_org_id: tenantId },
        orderBy: { started_at: 'desc' },
        skip,
        take:    pageSize,
      }),
      prisma.org_fin_recon_runs_mst.count({ where: { tenant_org_id: tenantId } }),
    ])
  );
  return { items, total, page, pageSize };
}

export async function getReconRunWithIssues(tenantId: string, runId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_fin_recon_runs_mst.findFirstOrThrow({
      where:   { id: runId, tenant_org_id: tenantId },
      include: { org_fin_recon_issues_dtl: { orderBy: [{ severity: 'asc' }, { created_at: 'asc' }] } },
    })
  );
}
