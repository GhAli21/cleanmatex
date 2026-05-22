import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { runArDunningAction } from '@/lib/services/ar-dunning-ops.service';
import { runArDunningSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

export async function POST(request: NextRequest) {
  const auth = await requirePermission('ar_dunning:run')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = runArDunningSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await runArDunningAction(parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return jsonApiError(error, 'Failed to run AR dunning action');
  }
}
