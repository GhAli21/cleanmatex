import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { validatePromoCode } from '@/lib/services/promotion-engine.service';

const schema = z.object({
  code:        z.string().min(1),
  customerId:  z.string().uuid().optional(),
  orderAmount: z.number().min(0).optional(),
});

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('promotions:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const result = await validatePromoCode(
      tenantId,
      parsed.data.code,
      parsed.data.customerId,
      parsed.data.orderAmount ?? 0
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
