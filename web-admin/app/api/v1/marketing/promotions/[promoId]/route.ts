import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { togglePromotionActive } from '@/lib/services/promotion-engine.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const auth = await requirePermission('promotions:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { promoId } = await params;

  try {
    const promo = await withTenantContext(tenantId, () =>
      prisma.org_promotions_mst.findFirst({
        where: { id: promoId, tenant_org_id: tenantId, rec_status: 1 },
      })
    );
    if (!promo) return NextResponse.json({ success: false, error: 'Promotion not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: promo });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch promotion';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const patchSchema = z.object({
  isActive:              z.boolean().optional(),
  name:                  z.string().min(1).optional(),
  name2:                 z.string().optional(),
  expiresAt:             z.string().datetime().optional(),
  usageLimit:            z.number().int().positive().optional(),
  usageLimitPerCustomer: z.number().int().positive().optional(),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('promotions:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { promoId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    if (parsed.data.isActive !== undefined) {
      const updated = await togglePromotionActive(tenantId, promoId, parsed.data.isActive);
      return NextResponse.json({ success: true, data: updated });
    }

    const updated = await withTenantContext(tenantId, () =>
      prisma.org_promotions_mst.update({
        where: { id: promoId, tenant_org_id: tenantId },
        data: {
          ...(parsed.data.name               && { name:                    parsed.data.name }),
          ...(parsed.data.name2              && { name2:                   parsed.data.name2 }),
          ...(parsed.data.expiresAt          && { expires_at:              new Date(parsed.data.expiresAt) }),
          ...(parsed.data.usageLimit         && { usage_limit:             parsed.data.usageLimit }),
          ...(parsed.data.usageLimitPerCustomer && { usage_limit_per_customer: parsed.data.usageLimitPerCustomer }),
          updated_at: new Date(),
        },
      })
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ promoId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('promotions:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { promoId } = await params;

  try {
    await withTenantContext(tenantId, () =>
      prisma.org_promotions_mst.update({
        where: { id: promoId, tenant_org_id: tenantId },
        data:  { rec_status: 0, is_active: false, updated_at: new Date() },
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
