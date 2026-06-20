import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { toCsv } from '@/lib/utils/report-csv';
import { getB2bStatementReconReport } from '@/lib/services/reports/finance-reconciliation-report.service';

/**
 * GET /api/v1/finance/reports/reconciliation/b2b-statements
 *
 * D-09 — B2B statement payment reconciliation: header `paid_amount` vs the sum
 * of `org_b2b_statement_payments_dtl` rows per statement. Non-zero delta rows are
 * reconciliation exceptions.
 *
 * @param request `from`/`to` window on statement `created_at`; `format=csv` for CSV.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const format = searchParams.get('format');

  try {
    const report = await getB2bStatementReconReport({ tenantOrgId: tenantId, from, to });

    if (format === 'csv') {
      const csv = toCsv(
        ['Statement No', 'Status', 'Currency', 'Total', 'Header Paid', 'Detail Paid', 'Delta', 'Detail Rows', 'Reconciled'],
        report.rows.map((r) => [
          r.statementNo,
          r.statusCode ?? '',
          r.currencyCode ?? '',
          r.totalAmount,
          r.headerPaidAmount,
          r.detailPaidAmount,
          r.delta,
          r.detailRowCount,
          r.isReconciled ? 'YES' : 'NO',
        ]),
      );
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="b2b-statement-recon-rprt.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    logger.error('B2B statement reconciliation report failed', err as Error, { tenantId });
    return NextResponse.json(
      { success: false, error: 'Failed to generate B2B statement reconciliation report' },
      { status: 500 },
    );
  }
}
