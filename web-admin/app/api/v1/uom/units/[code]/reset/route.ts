/** POST /api/v1/uom/units/[code]/reset — "Reset to system" for a customized seeded unit. */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { resetUnit } from '@/lib/services/uom.service';
import { uomCodeSchema } from '@/lib/validations/uom-schemas';
import { uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resets one unit. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const code = uomCodeSchema.safeParse((await params).code);
  if (!code.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION' } }, { status: 400 });
  try {
    await resetUnit(auth.tenantId, auth.userId, code.data);
    return NextResponse.json({ success: true });
  } catch (e) { return uomErrorResponse(e, 'reset-unit'); }
}
