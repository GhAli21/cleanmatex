import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listBizVouchers, createBizVoucher } from '@/lib/services/voucher-biz.service';
import {
  createBizVoucherSchema,
  listVoucherFiltersSchema,
  formatApiError,
} from '@/lib/validators/voucher-validators';
import type { VoucherListFilters, CreateBizVoucherInput } from '@/lib/types/voucher';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('fin_vouchers:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const sp = request.nextUrl.searchParams;
  const rawFilters = {
    voucher_type:   sp.get('voucher_type')   || undefined,
    voucher_status: sp.get('voucher_status') || undefined,
    direction:      sp.get('direction')      || undefined,
    party_type:     sp.get('party_type')     || undefined,
    branch_id:      sp.get('branch_id')      || undefined,
    date_from:      sp.get('date_from')      || undefined,
    date_to:        sp.get('date_to')        || undefined,
    search:         sp.get('search')         || undefined,
  };
  const page     = parseInt(sp.get('page')     ?? '1')  || 1;
  const pageSize = parseInt(sp.get('pageSize') ?? '20') || 20;

  try {
    const filters = (listVoucherFiltersSchema.parse(rawFilters) ?? {}) as VoucherListFilters;
    const result = await listBizVouchers(tenantId, filters, page, pageSize);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list vouchers';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('fin_vouchers:create')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  try {
    const body = await request.json();
    const validated = createBizVoucherSchema.parse(body) as CreateBizVoucherInput;
    const result = await createBizVoucher(tenantId, validated, userId);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    const { message, status } = formatApiError(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
