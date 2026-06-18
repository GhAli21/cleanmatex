import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getBizVoucherById, updateBizVoucher } from '@/lib/services/voucher-biz.service';
import { updateBizVoucherSchema, formatApiError } from '@/lib/validators/voucher-validators';
import type { UpdateBizVoucherInput } from '@/lib/types/voucher';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;
  const { voucherId } = await params;

  try {
    const data = await getBizVoucherById(tenantId, voucherId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch voucher';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:update')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { voucherId } = await params;

  try {
    const body = await request.json();
    const validated = updateBizVoucherSchema.parse(body) as UpdateBizVoucherInput;
    await updateBizVoucher(tenantId, voucherId, validated, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, status } = formatApiError(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
