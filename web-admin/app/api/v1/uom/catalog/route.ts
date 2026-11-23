/** GET /api/v1/uom/catalog — system units the Organization can still add. */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listAddableSystemUnits } from '@/lib/services/uom.service';
import { uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lists addable system units. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ success: true, data: await listAddableSystemUnits(auth.tenantId) });
  } catch (e) { return uomErrorResponse(e, 'catalog'); }
}
