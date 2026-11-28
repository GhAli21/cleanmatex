/** POST /api/v1/uom/convert — conversion preview ({ quantity, fromCode, toCode, productId? }). */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { loadUomResolver } from '@/lib/services/uom.service';
import { convertPreviewSchema } from '@/lib/validations/uom-schemas';
import { parseBody, uomErrorResponse } from '@/lib/api/uom-http';
import { QUANTITY_DECIMALS } from '@/lib/constants/uom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Converts one quantity with the Organization's rules. */
export async function POST(request: NextRequest) {
  const auth = await requirePermission('uom:view')(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, convertPreviewSchema);
  if ('response' in body) return body.response;
  const { quantity, fromCode, toCode, productId } = body.data;
  try {
    const uom = await loadUomResolver(auth.tenantId, productId);
    const result = uom.convert(quantity, fromCode, toCode, { productId }).toDecimalPlaces(QUANTITY_DECIMALS);
    return NextResponse.json({ success: true, data: { quantity: result.toString(), rate: uom.rate(fromCode, toCode, productId)?.toString() ?? null } });
  } catch (e) { return uomErrorResponse(e, 'convert'); }
}
