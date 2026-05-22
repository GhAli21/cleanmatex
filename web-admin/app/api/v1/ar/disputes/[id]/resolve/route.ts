import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { resolveArDispute } from '@/lib/services/ar-dispute.service';
import { resolveArDisputeSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('ar_disputes:resolve')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = resolveArDisputeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const { id } = await context.params;
    const data = await resolveArDispute(id, parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return jsonApiError(error, 'Failed to resolve AR dispute');
  }
}
