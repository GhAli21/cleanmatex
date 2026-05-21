import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listVoucherLines, addVoucherLine } from '@/lib/services/voucher-line.service';
import type { CreateVoucherLineInput } from '@/lib/types/voucher';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_vouchers:view');
    if (!hasPerm) return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    const { voucherId } = await params;
    const lines = await listVoucherLines(auth.tenantId, voucherId);
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
  try {
    const auth = await getAuthContext();
    const hasPerm = await hasPermissionServer('fin_voucher_lines:create');
    if (!hasPerm) return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    const { voucherId } = await params;
    const body = await request.json() as CreateVoucherLineInput;
    const result = await addVoucherLine(auth.tenantId, voucherId, body, auth.userId);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add voucher line';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
