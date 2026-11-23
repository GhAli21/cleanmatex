/**
 * GET  /api/v1/uom/units  — the Organization's units (?active_only=false includes switched-off)
 * POST /api/v1/uom/units  — new custom unit, or { kind:'system', codes } to add system units
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { addSystemUnits, createCustomUnit, listUnits } from '@/lib/services/uom.service';
import { createUnitSchema } from '@/lib/validations/uom-schemas';
import { parseBody, uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lists units. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('uom:view')(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const activeOnly = new URL(request.url).searchParams.get('active_only') !== 'false';
    return NextResponse.json({ success: true, data: await listUnits(auth.tenantId, { activeOnly }) });
  } catch (e) { return uomErrorResponse(e, 'list-units'); }
}

/** Creates a custom unit or adds system units. */
export async function POST(request: NextRequest) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, createUnitSchema);
  if ('response' in body) return body.response;
  try {
    if (body.data.kind === 'system') {
      return NextResponse.json({ success: true, data: { added: await addSystemUnits(auth.tenantId, body.data) } }, { status: 201 });
    }
    return NextResponse.json({ success: true, data: await createCustomUnit(auth.tenantId, auth.userId, body.data) }, { status: 201 });
  } catch (e) { return uomErrorResponse(e, 'create-unit'); }
}
