/**
 * GET  /api/v1/uom/conversions — tenant-wide pairs (?product_id= for one product's pairs)
 * POST /api/v1/uom/conversions — new pair
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createConversion, listConversions } from '@/lib/services/uom.service';
import { conversionSchema } from '@/lib/validations/uom-schemas';
import { parseBody, uomErrorResponse } from '@/lib/api/uom-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lists conversions. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('uom:view')(request);
  if (auth instanceof NextResponse) return auth;
  const productId = z.string().uuid().nullable().safeParse(new URL(request.url).searchParams.get('product_id'));
  if (!productId.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION' } }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await listConversions(auth.tenantId, { productId: productId.data }) });
  } catch (e) { return uomErrorResponse(e, 'list-conversions'); }
}

/** Creates a conversion. */
export async function POST(request: NextRequest) {
  const auth = await requirePermission('uom:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, conversionSchema);
  if ('response' in body) return body.response;
  try {
    return NextResponse.json({ success: true, data: await createConversion(auth.tenantId, auth.userId, body.data) }, { status: 201 });
  } catch (e) { return uomErrorResponse(e, 'create-conversion'); }
}
