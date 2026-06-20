import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { toCsv } from '@/lib/utils/report-csv';
import { getCashDrawerReconReport } from '@/lib/services/reports/finance-reconciliation-report.service';

/**
 * GET /api/v1/finance/reports/reconciliation/cash-drawer
 *
 * D-09 — cash drawer movement reconciliation: per session, recomputed expected
 * (opening float + Σ IN − Σ OUT) vs header expected, close difference, and count
 * of movements missing a BVM voucher backlink.
 *
 * @param request `from`/`to` window on `opened_at`, optional `branchId`;
 *   `format=csv` for CSV.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const branchId = searchParams.get('branchId') ?? undefined;
  const format = searchParams.get('format');

  try {
    const report = await getCashDrawerReconReport({ tenantOrgId: tenantId, from, to, branchId });

    if (format === 'csv') {
      const csv = toCsv(
        ['Session No', 'Status', 'Currency', 'Opening Float', 'Net Movement', 'Computed Expected', 'Header Expected', 'Expected Delta', 'Counted', 'Difference', 'Unlinked Movements', 'Reconciled'],
        report.rows.map((r) => [
          r.sessionNo,
          r.status,
          r.currencyCode ?? '',
          r.openingFloatAmount,
          r.netMovementAmount,
          r.computedExpectedAmount,
          r.headerExpectedAmount,
          r.expectedDelta,
          r.countedCashAmount ?? '',
          r.differenceAmount ?? '',
          r.unlinkedMovementCount,
          r.isReconciled ? 'YES' : 'NO',
        ]),
      );
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="cash-drawer-recon-rprt.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    logger.error('Cash drawer reconciliation report failed', err as Error, { tenantId });
    return NextResponse.json(
      { success: false, error: 'Failed to generate cash drawer reconciliation report' },
      { status: 500 },
    );
  }
}
