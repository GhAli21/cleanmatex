import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { applyArCredit } from '@/lib/services/ar-credit.service';
import { applyArCreditSchema } from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError } from '@/app/api/v1/ar/_shared';

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission('ar_credits:apply')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = applyArCreditSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await applyArCredit(parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return jsonApiError(error, 'Failed to apply AR credit');
  }
}
