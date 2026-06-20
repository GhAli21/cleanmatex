import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { toCsv } from '@/lib/utils/report-csv';
import { getOverpaymentDispositionReconReport } from '@/lib/services/reports/finance-reconciliation-report.service';

/**
 * GET /api/v1/finance/reports/reconciliation/overpayment-disposition
 *
 * D-09 — overpayment disposition reconciliation: `org_fin_overpay_disp_dtl`
 * grouped by resolution code + currency, split into posted (voucher-line linked)
 * vs orphan (no voucher line = exception).
 *
 * @param request `from`/`to` window on `created_at`, optional `branchId`;
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
    const report = await getOverpaymentDispositionReconReport({
      tenantOrgId: tenantId,
      from,
      to,
      branchId,
    });

    if (format === 'csv') {
      const csv = toCsv(
        ['Resolution Code', 'Currency', 'Count', 'Total Amount', 'Posted Count', 'Posted Amount', 'Orphan Count', 'Orphan Amount'],
        report.rows.map((r) => [
          r.resolutionCode,
          r.currencyCode ?? '',
          r.count,
          r.totalAmount,
          r.postedCount,
          r.postedAmount,
          r.orphanCount,
          r.orphanAmount,
        ]),
      );
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="overpayment-disposition-recon-rprt.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    logger.error('Overpayment disposition reconciliation report failed', err as Error, { tenantId });
    return NextResponse.json(
      { success: false, error: 'Failed to generate overpayment disposition reconciliation report' },
      { status: 500 },
    );
  }
}
