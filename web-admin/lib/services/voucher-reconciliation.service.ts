import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

import {
  summarizeIssues,
  type CheckResult,
} from './reconciliation/types';
import {
  runVoucherIntegrityChecks,
  type VoucherHeader,
} from './reconciliation/voucher-checks';

/**
 * Voucher-scoped reconciliation service (PRD §23.1 + §24.3).
 *
 * Why a separate service:
 * The tenant-level orchestrator (`runReconciliation`) persists a run and
 * fans out every PRD §22.1 check across the whole window. The voucher-scoped
 * service answers "is this single voucher self-consistent?" — same checks,
 * single voucher, no persistence. It powers the
 * `GET /api/v1/finance/vouchers/[voucherId]/reconciliation` endpoint added
 * in Step 3a.
 *
 * Why no DB writes:
 * Voucher-scoped reconciliation is an on-demand operator action — the
 * operator inspects the result, decides whether to open a ticket, and the
 * tenant-level run is the persistent audit trail. Persisting on every
 * single-voucher fetch would clutter the run log with noise.
 */

const VOUCHER_CHECK_COUNT = 3; // VOUCHER_TOTAL_EQUALS_LINES, NO_DUPLICATE_OPERATIONAL_EFFECT, GATEWAY_STATE_VALID

/**
 *
 */
export interface VoucherReconciliationResult {
  voucherId: string;
  voucherNo: string;
  voucherStatus: string;
  issues: CheckResult[];
  summary: ReturnType<typeof summarizeIssues>;
}

/**
 * Run voucher-level integrity checks for a single voucher.
 *
 * @param tenantOrgId active tenant — every query scoped via `withTenantContext`.
 * @param voucherId target voucher id; must belong to `tenantOrgId` (DB-side
 *   RLS enforces this even if the caller has a wrong id).
 * @returns voucher header summary plus the flat issue list. The caller (API
 *   route) shapes the JSON response.
 *
 * Throws if the voucher does not exist for the tenant — caller should map to
 * a 404 response.
 */
export async function reconcileVoucher(
  tenantOrgId: string,
  voucherId: string,
): Promise<VoucherReconciliationResult> {
  const header = await withTenantContext(tenantOrgId, () =>
    prisma.org_fin_vouchers_mst.findFirstOrThrow({
      where: { tenant_org_id: tenantOrgId, id: voucherId },
      select: {
        id: true,
        voucher_no: true,
        total_amount: true,
        voucher_status: true,
      },
    }),
  );

  const vouchers: VoucherHeader[] = [
    {
      id: header.id,
      voucher_no: header.voucher_no,
      total_amount: header.total_amount,
      voucher_status: header.voucher_status,
    },
  ];

  const issues = await runVoucherIntegrityChecks(tenantOrgId, vouchers);
  const summary = summarizeIssues(issues, VOUCHER_CHECK_COUNT);

  return {
    voucherId: header.id,
    voucherNo: header.voucher_no,
    voucherStatus: header.voucher_status,
    issues,
    summary,
  };
}
