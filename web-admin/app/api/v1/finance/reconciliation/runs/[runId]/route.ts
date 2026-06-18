import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getReconRunWithIssues } from '@/lib/services/reconciliation.service';

function escapeCsvCell(value: string | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(run: Awaited<ReturnType<typeof getReconRunWithIssues>>): string {
  const headers = [
    'Severity', 'Check Name', 'Entity Type', 'Entity ID',
    'Expected', 'Actual', 'Delta', 'Message', 'Status', 'Notes',
  ];

  const rows = run.org_fin_recon_issues_dtl.map((i) => [
    escapeCsvCell(i.severity),
    escapeCsvCell(i.check_name),
    escapeCsvCell(i.affected_entity_type),
    escapeCsvCell(i.affected_entity_id),
    escapeCsvCell(i.expected_value != null ? Number(i.expected_value).toFixed(4) : null),
    escapeCsvCell(i.actual_value   != null ? Number(i.actual_value).toFixed(4)   : null),
    escapeCsvCell(i.delta          != null ? Number(i.delta).toFixed(4)          : null),
    escapeCsvCell(i.message),
    escapeCsvCell(i.status),
    escapeCsvCell(i.notes),
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await requirePermission('reconciliation:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { runId } = await params;
  const format = request.nextUrl.searchParams.get('format');

  try {
    const run = await getReconRunWithIssues(tenantId, runId);

    if (format === 'csv') {
      const csv = buildCsv(run);
      const filename = `reconciliation-${run.run_no}-issues.csv`;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: run });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reconciliation run';
    return NextResponse.json({ success: false, error: message }, { status: 404 });
  }
}
