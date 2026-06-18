import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { CASHIER_ALLOWED_VOUCHER_TYPES } from '@/lib/constants/voucher';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('fin_vouchers:view')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rows = await prisma.$queryRaw<Array<{
      code: string; name: string; name2: string | null; direction_hint: string | null;
    }>>`
      SELECT code, name, name2, direction_hint
      FROM sys_fin_vch_type_cd
      WHERE is_active = true
      ORDER BY rec_order ASC NULLS LAST
    `;

    // Cashier role sees only allowed voucher types
    const allowed = (auth as { userRole?: string }).userRole === 'cashier'
      ? rows.filter(r => (CASHIER_ALLOWED_VOUCHER_TYPES as readonly string[]).includes(r.code))
      : rows;

    return NextResponse.json({ success: true, data: allowed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch voucher types';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
