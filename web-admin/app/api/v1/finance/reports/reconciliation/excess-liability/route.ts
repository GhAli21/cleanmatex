import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';
import { toCsv } from '@/lib/utils/report-csv';
import { getExcessLiabilityReport } from '@/lib/services/reports/finance-reconciliation-report.service';

/**
 * GET /api/v1/finance/reports/reconciliation/excess-liability
 *
 * D-09 — unallocated excess / customer stored-value liability snapshot
 * (wallet + advance + active credit-note balances > 0). Point-in-time; the
 * `from`/`to`/`branchId` params are accepted for a uniform report API but not
 * applied (a liability is outstanding regardless of when it arose).
 *
 * @param request `format=csv` returns CSV; otherwise JSON `{ success, data }`.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('finance_reports:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { searchParams } = request.nextUrl;
  const format = searchParams.get('format');

  try {
    const report = await getExcessLiabilityReport({ tenantOrgId: tenantId });

    if (format === 'csv') {
      const csv = toCsv(
        ['Customer', 'Customer ID', 'Source', 'Currency', 'Outstanding Amount', 'Last Activity'],
        report.rows.map((r) => [
          r.customerName ?? '',
          r.customerId,
          r.source,
          r.currencyCode ?? '',
          r.outstandingAmount,
          r.lastActivityAt ?? '',
        ]),
      );
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="excess-liability-rprt.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    logger.error('Excess liability report failed', err as Error, { tenantId });
    return NextResponse.json(
      { success: false, error: 'Failed to generate excess liability report' },
      { status: 500 },
    );
  }
}
