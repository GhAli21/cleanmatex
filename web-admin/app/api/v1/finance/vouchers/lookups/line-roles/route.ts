import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { prisma } from '@/lib/db/prisma';
import { CASHIER_ALLOWED_LINE_ROLES } from '@/lib/constants/voucher';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('fin_vouchers:view')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rows = await prisma.$queryRaw<Array<{
      code: string; name: string; name2: string | null; line_type: string | null; direction: string | null;
    }>>`
      SELECT code, name, name2, line_type, direction
      FROM sys_fin_vch_line_role_cd
      WHERE is_active = true
      ORDER BY rec_order ASC NULLS LAST
    `;

    const allowed = (auth as { userRole?: string }).userRole === 'cashier'
      ? rows.filter(r => (CASHIER_ALLOWED_LINE_ROLES as readonly string[]).includes(r.code))
      : rows;

    return NextResponse.json({ success: true, data: allowed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch line roles';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
