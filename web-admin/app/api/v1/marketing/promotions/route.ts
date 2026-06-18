import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { listPromotions, createPromotion } from '@/lib/services/promotion-engine.service';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('promotions:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const page     = Number(request.nextUrl.searchParams.get('page') ?? '1');
  const pageSize = Number(request.nextUrl.searchParams.get('pageSize') ?? '20');

  try {
    const result = await listPromotions(tenantId, page, pageSize);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch promotions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const createSchema = z.object({
  name:                  z.string().min(1),
  name2:                 z.string().optional(),
  promoCode:             z.string().optional(),
  promoType:             z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_ITEM']),
  discountValue:         z.number().min(0),
  maxDiscountAmount:     z.number().min(0).optional(),
  minOrderAmount:        z.number().min(0).optional(),
  startsAt:              z.string().datetime().optional(),
  expiresAt:             z.string().datetime().optional(),
  maxUses:               z.number().int().positive().optional(),
  maxUsesPerCustomer:    z.number().int().positive().optional(),
});

/**
 *
 * @param request
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('promotions:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const promo = await createPromotion(tenantId, {
      name:                parsed.data.name,
      name2:               parsed.data.name2,
      promoCode:           parsed.data.promoCode,
      promoType:           parsed.data.promoType,
      discountValue:       parsed.data.discountValue,
      maxDiscountAmount:   parsed.data.maxDiscountAmount,
      minOrderAmount:      parsed.data.minOrderAmount,
      maxUses:             parsed.data.maxUses,
      maxUsesPerCustomer:  parsed.data.maxUsesPerCustomer,
      startsAt:  parsed.data.startsAt  ? new Date(parsed.data.startsAt)  : undefined,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      createdBy: userId,
    });
    return NextResponse.json({ success: true, data: promo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create promotion';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
