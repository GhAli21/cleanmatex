import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listVoucherLines, addVoucherLine } from '@/lib/services/voucher-line.service';
import type { CreateVoucherLineInput } from '@/lib/types/voucher';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_vouchers:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;
  const { voucherId } = await params;

  try {
    const lines = await listVoucherLines(tenantId, voucherId);
    return NextResponse.json({ success: true, data: lines });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list voucher lines';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  const auth = await requirePermission('fin_voucher_lines:create')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;
  const { voucherId } = await params;

  try {
    const body = await request.json() as CreateVoucherLineInput;
    const result = await addVoucherLine(tenantId, voucherId, body, userId);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add voucher line';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
