import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { listReconRuns, runReconciliation } from '@/lib/services/reconciliation.service';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('reconciliation:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const page     = Number(request.nextUrl.searchParams.get('page') ?? '1');
  const pageSize = Number(request.nextUrl.searchParams.get('pageSize') ?? '20');

  try {
    const result = await listReconRuns(tenantId, page, pageSize);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reconciliation runs';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const schema = z.object({
  periodFrom:   z.string().datetime(),
  periodTo:     z.string().datetime(),
  branchId:     z.string().uuid().optional(),
  currencyCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('reconciliation:run')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const run = await runReconciliation(tenantId, {
      periodFrom:   new Date(parsed.data.periodFrom),
      periodTo:     new Date(parsed.data.periodTo),
      branchId:     parsed.data.branchId,
      currencyCode: parsed.data.currencyCode,
      triggeredBy:  userId,
    });
    return NextResponse.json({ success: true, data: run }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reconciliation run failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
