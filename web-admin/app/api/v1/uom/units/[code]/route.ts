/** PATCH /api/v1/uom/units/[code] — edit presentation fields or switch a unit on/off. */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { updateUnit } from '@/lib/services/uom.service';
import { updateUnitSchema, uomCodeSchema } from '@/lib/validations/uom-schemas';
import { parseBody, uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Updates one unit. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const code = uomCodeSchema.safeParse((await params).code);
  if (!code.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION' } }, { status: 400 });
  const body = await parseBody(request, updateUnitSchema);
  if ('response' in body) return body.response;
  try {
    return NextResponse.json({ success: true, data: await updateUnit(auth.tenantId, auth.userId, code.data, body.data) });
  } catch (e) { return uomErrorResponse(e, 'update-unit'); }
}
