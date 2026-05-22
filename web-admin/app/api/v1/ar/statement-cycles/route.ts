import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  createArStatementCycle,
  listArStatementCycles,
} from '@/lib/services/ar-statement-cycle.service';
import {
  arStatementCyclesQuerySchema,
  createArStatementCycleSchema,
} from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('ar_stmt_cycles:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arStatementCyclesQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const data = await listArStatementCycles(parsed.data, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return jsonApiError(error, 'Failed to list AR statement cycles');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('ar_stmt_cycles:manage')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createArStatementCycleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await createArStatementCycle(parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return jsonApiError(error, 'Failed to create AR statement cycle');
  }
}
