/**
 * PATCH  /api/v1/uom/conversions/[id] — change rates, on/off or notes of a pair (the pair itself is immutable)
 * DELETE /api/v1/uom/conversions/[id] — remove an Organization's own pair
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { deleteConversion, updateConversion } from '@/lib/services/uom.service';
import { updateConversionSchema } from '@/lib/validations/uom-schemas';
import { parseBody, uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Updates one conversion. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION' } }, { status: 400 });
  const body = await parseBody(request, updateConversionSchema);
  if ('response' in body) return body.response;
  try {
    return NextResponse.json({ success: true, data: await updateConversion(auth.tenantId, auth.userId, id.data, body.data) });
  } catch (e) { return uomErrorResponse(e, 'update-conversion'); }
}

/** Deletes one conversion. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION' } }, { status: 400 });
  try {
    await deleteConversion(auth.tenantId, id.data);
    return NextResponse.json({ success: true });
  } catch (e) { return uomErrorResponse(e, 'delete-conversion'); }
}
