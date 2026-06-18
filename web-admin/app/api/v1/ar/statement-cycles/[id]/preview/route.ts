import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { previewArStatementCycle } from '@/lib/services/ar-statement-cycle.service';
import { previewArStatementCycleSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 *
 * @param request
 * @param context
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('ar_stmt_cycles:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = previewArStatementCycleSchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const { id } = await context.params;
    const data = await previewArStatementCycle(id, parsed.data, {
      tenantId: auth.tenantId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to preview AR statement cycle');
  }
}
