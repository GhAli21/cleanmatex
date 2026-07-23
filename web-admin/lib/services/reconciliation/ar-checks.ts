/**
 * BVM Phase 4 — AR (Accounts Receivable) reconciliation checks.
 *
 * Covers PRD §22.1:
 *   - INVOICE_PAYMENT_LINK_EXISTS  (every applied invoice payment row points
 *     to the AR voucher that issued it)
 *   - REFUND_LINK_EXISTS           (every processed customer refund has a
 *     posted REFUND_VOUCHER for the same order)
 *
 * Why these live together:
 * Both checks validate that post-Phase-2 AR side effects flow through the
 * Business Voucher Module. They share a window-scoped query shape and write
 * BLOCKER issues against the AR entities (`invoice_payment_allocation`,
 * `order_refund`). Unlike the stored-value ledger checks, the link target
 * column names differ between tables — `org_invoice_payments_dtl.voucher_id`
 * (set by the wiring service on the allocation row itself) vs the indirect
 * `org_fin_vouchers_mst.order_id` lookup used by REFUND_LINK_EXISTS, because
 * `org_order_refunds_dtl` does not (yet) carry a `fin_voucher_id` backlink.
 *
 * Window semantics:
 * Each check is scoped by `periodFrom..periodTo` against the event timestamp
 * column on the source table — `applied_at` for invoice payments,
 * `processed_at` for refunds. Pre-Phase-2 rows are out of scope by design.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
  REFUND_METHODS,
} from '@/lib/constants/order-financial';
import { VOUCHER_STATUS, VOUCHER_TYPE } from '@/lib/constants/voucher';

import { toNumber, type CheckResult } from './types';

interface PeriodWindow {
  periodFrom: Date;
  periodTo: Date;
}

/**
 * INVOICE_PAYMENT_LINK_EXISTS — every APPLIED invoice-payment allocation row
 * created in the recon window must reference the AR voucher that posted it
 * (`org_invoice_payments_dtl.voucher_id IS NOT NULL`).
 *
 * Why this is a BLOCKER:
 * Post-Phase-2 the AR payment-allocation orchestrator always writes the
 * `voucher_id` on the allocation row inside the same transaction that issues
 * the voucher. A NULL backlink on a row created in the window indicates either
 * a legacy direct-insert path (pre-BVM) or a wiring regression — in both cases
 * the GL voucher trail is broken and reconciliation cannot continue.
 *
 * Scope filter:
 *   - `applied_at` in [periodFrom, periodTo]      → window scope
 *   - `allocation_outcome = 'APPLIED'`             → only real settlement events;
 *                                                   reversed allocations leave
 *                                                   `reversed_at` set and have
 *                                                   different linkage semantics
 *   - `reversed_at IS NULL`                        → not subsequently reversed
 *   - `is_active = true`                           → soft-deletes excluded
 *   - `voucher_id IS NULL`                         → the actual violation
 *
 * @param tenantOrgId active tenant — every query scoped via `withTenantContext`
 *   so RLS enforces tenant isolation as defense in depth.
 * @param window reconciliation period applied to `applied_at`.
 */
export async function checkInvoicePaymentLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const orphans = await withTenantContext(tenantOrgId, () =>
    prisma.org_invoice_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        applied_at: { gte: window.periodFrom, lte: window.periodTo },
        allocation_outcome: 'APPLIED',
        reversed_at: null,
        is_active: true,
        voucher_id: null,
      },
      select: {
        id: true,
        invoice_id: true,
        allocation_no: true,
        allocated_amount: true,
      },
    }),
  );

  return orphans.map((row) => {
    const amount = toNumber(row.allocated_amount);
    return {
      checkName: RECONCILIATION_CHECK_NAMES.INVOICE_PAYMENT_LINK_EXISTS,
      severity: RECONCILIATION_SEVERITIES.BLOCKER,
      passed: false,
      actualValue: amount,
      message: `Invoice payment allocation ${row.id} (invoice ${row.invoice_id}, allocation #${row.allocation_no}, amount ${amount}) has no fin_voucher backlink — created outside a Business Voucher transaction`,
      affectedEntityType: 'invoice_payment_allocation',
      affectedEntityId: row.id,
    };
  });
}

/**
 * REFUND_LINK_EXISTS — every PROCESSED customer refund in the window must
 * have at least one POSTED `REFUND_VOUCHER`; for CASH-method refunds that
 * ran through B9 execution, a linked cash-drawer CASH_OUT movement is
 * additionally required.
 *
 * Two verification modes, distinguished by the B9 backlink columns
 * (migration 0418 — `fin_voucher_id`/`fin_voucher_trx_line_id`/
 * `cash_drawer_movement_id` on `org_order_refunds_dtl`):
 *
 *  - **Unambiguous mode** (`fin_voucher_id` set — B9 execution ran, flag ON):
 *    verify that exact voucher id is POSTED, and for `refund_method_code =
 *    CASH` that `cash_drawer_movement_id` is also set (the wiring handler
 *    always populates it in the same transaction — a NULL here means the
 *    wiring silently failed to run, a genuine defect).
 *  - **Reverse-pointer fallback mode** (`fin_voucher_id` NULL — record-only
 *    refund, either B9's flag is OFF or the refund predates B9): the original
 *    Phase-2 check — any POSTED `REFUND_VOUCHER` for the same `order_id` — is
 *    kept for backward compatibility with legacy/flag-off rows, which can
 *    never populate the dedicated backlink. WALLET/CREDIT_NOTE refunds never
 *    create a REFUND_VOUCHER at all (they redeem stored-value ledgers
 *    directly) and are excluded from both modes.
 *
 * Why this is still a BLOCKER:
 * A PROCESSED refund row with no matching posted refund voucher (or, for
 * CASH, no linked drawer movement) means money has been returned to the
 * customer without a full audit trail; the AR reconciliation pipeline cannot
 * vouch for the period totals.
 *
 * Scope filter:
 *   - `processed_at` in [periodFrom, periodTo]      → window scope
 *   - `refund_status = 'PROCESSED'`                 → settled refunds only
 *                                                    (PENDING/FAILED leave the
 *                                                    invariant pending)
 *   - `is_active = true`                            → soft-deletes excluded
 *   - `refund_method_code IN (CASH, ORIGINAL_METHOD)` → WALLET/CREDIT_NOTE
 *                                                    never create a voucher
 *
 * @param tenantOrgId active tenant — every query scoped via `withTenantContext`
 *   so RLS enforces tenant isolation as defense in depth.
 * @param window reconciliation period applied to `processed_at`.
 */
export async function checkRefundLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  const refunds = await withTenantContext(tenantOrgId, () =>
    prisma.org_order_refunds_dtl.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        processed_at: { gte: window.periodFrom, lte: window.periodTo },
        refund_status: 'PROCESSED',
        is_active: true,
        refund_method_code: { in: [REFUND_METHODS.CASH, REFUND_METHODS.ORIGINAL_METHOD] },
      },
      select: {
        id: true,
        order_id: true,
        refund_amount: true,
        refund_no: true,
        refund_method_code: true,
        fin_voucher_id: true,
        cash_drawer_movement_id: true,
      },
    }),
  );

  if (refunds.length === 0) return [];

  const b9Refunds = refunds.filter((r) => r.fin_voucher_id != null);
  const legacyRefunds = refunds.filter((r) => r.fin_voucher_id == null);

  const results: CheckResult[] = [];

  // ── Unambiguous mode (B9 backlinks present) ──────────────────────────────
  if (b9Refunds.length > 0) {
    const voucherIds = Array.from(new Set(b9Refunds.map((r) => r.fin_voucher_id!)));
    const postedVouchers = await withTenantContext(tenantOrgId, () =>
      prisma.org_fin_vouchers_mst.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          id: { in: voucherIds },
          voucher_type: VOUCHER_TYPE.REFUND,
          voucher_status: VOUCHER_STATUS.POSTED,
        },
        select: { id: true },
      }),
    );
    const postedVoucherIds = new Set(postedVouchers.map((v) => v.id));

    for (const row of b9Refunds) {
      const amount = toNumber(row.refund_amount);
      const refundLabel = row.refund_no ?? row.id;
      if (!postedVoucherIds.has(row.fin_voucher_id!)) {
        results.push({
          checkName: RECONCILIATION_CHECK_NAMES.REFUND_LINK_EXISTS,
          severity: RECONCILIATION_SEVERITIES.BLOCKER,
          passed: false,
          actualValue: amount,
          message: `Refund ${refundLabel} (order ${row.order_id}, amount ${amount}) references fin_voucher_id ${row.fin_voucher_id} which is not a POSTED REFUND_VOUCHER`,
          affectedEntityType: 'order_refund',
          affectedEntityId: row.id,
        });
        continue;
      }
      if (row.refund_method_code === REFUND_METHODS.CASH && !row.cash_drawer_movement_id) {
        results.push({
          checkName: RECONCILIATION_CHECK_NAMES.REFUND_LINK_EXISTS,
          severity: RECONCILIATION_SEVERITIES.BLOCKER,
          passed: false,
          actualValue: amount,
          message: `CASH refund ${refundLabel} (order ${row.order_id}, amount ${amount}) has a POSTED REFUND_VOUCHER but no linked cash-drawer movement — B9 wiring did not complete`,
          affectedEntityType: 'order_refund',
          affectedEntityId: row.id,
        });
      }
    }
  }

  // ── Reverse-pointer fallback mode (legacy / flag-off refunds) ────────────
  if (legacyRefunds.length > 0) {
    const orderIds = Array.from(new Set(legacyRefunds.map((r) => r.order_id)));
    const refundVouchers = await withTenantContext(tenantOrgId, () =>
      prisma.org_fin_vouchers_mst.findMany({
        where: {
          tenant_org_id: tenantOrgId,
          voucher_type: VOUCHER_TYPE.REFUND,
          voucher_status: VOUCHER_STATUS.POSTED,
          order_id: { in: orderIds },
        },
        select: { order_id: true },
      }),
    );
    const ordersWithRefundVoucher = new Set(
      refundVouchers.map((v) => v.order_id).filter((id): id is string => id != null),
    );

    for (const row of legacyRefunds) {
      if (ordersWithRefundVoucher.has(row.order_id)) continue;
      const amount = toNumber(row.refund_amount);
      const refundLabel = row.refund_no ?? row.id;
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.REFUND_LINK_EXISTS,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        actualValue: amount,
        message: `Refund ${refundLabel} (order ${row.order_id}, amount ${amount}) has no posted REFUND_VOUCHER for the same order — refund settled outside a Business Voucher transaction`,
        affectedEntityType: 'order_refund',
        affectedEntityId: row.id,
      });
    }
  }

  return results;
}
