import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { updateVoucherLine, deleteDraftVoucherLine } from '@/lib/services/voucher-line.service';
import { updateVoucherLineSchema, formatApiError } from '@/lib/validators/voucher-validators';
import type { UpdateVoucherLineInput } from '@/lib/types/voucher';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string; lineId: string }> }
) {
  const auth = await requirePermission('fin_voucher_lines:update')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { lineId } = await params;

  try {
    const body = await request.json();
    const validated = updateVoucherLineSchema.parse(body) as UpdateVoucherLineInput;
    await updateVoucherLine(tenantId, lineId, validated, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, status } = formatApiError(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string; lineId: string }> }
) {
  const auth = await requirePermission('fin_voucher_lines:delete_draft')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;
  const { lineId } = await params;

  try {
    await deleteDraftVoucherLine(tenantId, lineId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete voucher line';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
