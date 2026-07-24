/**
 * B6 — BVM/operational-fact ↔ ERP-Lite GL posting trip-wire.
 *
 * Covers the reconciliation gap the frozen audit report flagged as
 * "BVM↔GL reconciliation: NOT_FOUND" (§39): before B6, every ERP-Lite
 * payment/refund dispatcher existed with zero callers, so nothing would
 * ever have caught a silent regression if a future change accidentally
 * removed a dispatch call again.
 *
 * Deliberately NOT a "did the journal balance / post successfully" check —
 * that is already covered by the engine's own validation stages and
 * `org_fin_post_exc_tr` exception rows (NON_BLOCKING failures are expected
 * and visible there). This check only verifies an ATTEMPT was made at all —
 * `org_fin_post_log_tr` has at least one row for the operational fact — for
 * tenants that actually have ERP-Lite enabled. A tenant without ERP-Lite
 * enabled correctly has zero posting-log rows for every payment/refund, so
 * this check must gate on the feature flag rather than flooding false
 * positives for the majority of tenants that don't use ERP-Lite yet.
 *
 * `org_fin_post_log_tr` has no Prisma model (the ERP-Lite posting engine
 * writes/reads it via raw SQL exclusively — see
 * `erp-lite-posting-engine.service.ts`'s `insertPostingLog`), so this module
 * queries it the same way.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { canAccess, FEATURE_FLAG_KEYS } from '@/lib/services/feature-flags.service';
import {
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
  REFUND_STATUSES,
} from '@/lib/constants/order-financial';

import { toNumber, type CheckResult } from './types';

interface PeriodWindow {
  periodFrom: Date;
  periodTo: Date;
}

const PAYMENT_EVENT_CODES = [
  'PAYMENT_RECEIVED',
  'ORDER_SETTLED_CASH',
  'ORDER_SETTLED_CARD',
  'ORDER_SETTLED_WALLET',
];

/**
 * ORDER_PAYMENT_ERP_POST_ATTEMPTED — every COMPLETED-set REAL_PAYMENT leg for
 * a tenant with ERP-Lite enabled must have at least one `org_fin_post_log_tr`
 * attempt row for its PAYMENT_RECEIVED/ORDER_SETTLED_* event. A missing
 * attempt means the wiring/verify call site regressed (the exact pre-B6 gap),
 * not a GL failure — GL failures already surface via `org_fin_post_exc_tr`.
 *
 * @param tenantOrgId active tenant
 * @param window recon window, applied to `updated_at` (covers both
 *   immediate-COMPLETED legs and legs verified later, since VERIFY also
 *   updates `updated_at`)
 */
export async function checkOrderPaymentErpPostAttempted(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const erpLiteEnabled = await canAccess(tenantOrgId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED);
  if (!erpLiteEnabled) return [];

  const payments = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        payment_nature_snapshot: 'REAL_PAYMENT',
        is_active: true,
        payment_status: { in: [...ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED] },
        updated_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: { id: true, order_id: true, amount: true },
    }),
  );
  if (payments.length === 0) return [];

  const attempts = await withTenantContext(tenantOrgId, () =>
    prisma.$queryRaw<{ source_doc_id: string }[]>`
      SELECT DISTINCT source_doc_id
      FROM public.org_fin_post_log_tr
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND source_doc_id = ANY(${payments.map((p) => p.id)}::uuid[])
        AND txn_event_code = ANY(${PAYMENT_EVENT_CODES}::text[])
    `,
  );
  const attemptedIds = new Set(attempts.map((a) => a.source_doc_id));

  const violations: CheckResult[] = [];
  for (const payment of payments) {
    if (!attemptedIds.has(payment.id)) {
      violations.push({
        checkName: RECONCILIATION_CHECK_NAMES.ORDER_PAYMENT_ERP_POST_ATTEMPTED,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        actualValue: toNumber(payment.amount),
        message: `Payment ${payment.id} (order ${payment.order_id}) is COMPLETED-set on an ERP-Lite-enabled tenant but has no org_fin_post_log_tr attempt — the wiring/verify ERP dispatch call may have regressed`,
        affectedEntityType: 'org_order_payments_dtl',
        affectedEntityId: payment.id,
      });
    }
  }
  return violations;
}

/**
 * REFUND_ERP_POST_ATTEMPTED — same trip-wire for `REFUND_ISSUED`, scoped to
 * PROCESSED refunds on an ERP-Lite-enabled tenant.
 */
export async function checkRefundErpPostAttempted(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const erpLiteEnabled = await canAccess(tenantOrgId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED);
  if (!erpLiteEnabled) return [];

  const refunds = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_refunds_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        refund_status: REFUND_STATUSES.PROCESSED,
        processed_at: { gte: window.periodFrom, lte: window.periodTo },
      },
      select: { id: true, order_id: true, refund_amount: true },
    }),
  );
  if (refunds.length === 0) return [];

  const attempts = await withTenantContext(tenantOrgId, () =>
    prisma.$queryRaw<{ source_doc_id: string }[]>`
      SELECT DISTINCT source_doc_id
      FROM public.org_fin_post_log_tr
      WHERE tenant_org_id = ${tenantOrgId}::uuid
        AND source_doc_id = ANY(${refunds.map((r) => r.id)}::uuid[])
        AND txn_event_code = 'REFUND_ISSUED'
    `,
  );
  const attemptedIds = new Set(attempts.map((a) => a.source_doc_id));

  const violations: CheckResult[] = [];
  for (const refund of refunds) {
    if (!attemptedIds.has(refund.id)) {
      violations.push({
        checkName: RECONCILIATION_CHECK_NAMES.REFUND_ERP_POST_ATTEMPTED,
        severity: RECONCILIATION_SEVERITIES.WARNING,
        passed: false,
        actualValue: toNumber(refund.refund_amount),
        message: `Refund ${refund.id} (order ${refund.order_id}) is PROCESSED on an ERP-Lite-enabled tenant but has no org_fin_post_log_tr REFUND_ISSUED attempt — the processRefund ERP dispatch call may have regressed`,
        affectedEntityType: 'org_order_refunds_dtl',
        affectedEntityId: refund.id,
      });
    }
  }
  return violations;
}
