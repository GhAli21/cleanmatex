import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getLoyaltyConfig } from '@/lib/services/loyalty.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('loyalty:view_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const config = await getLoyaltyConfig(tenantId);
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch loyalty config';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const updateSchema = z.object({
  earnRate:        z.number().min(0).optional(),
  redeemRate:      z.number().min(0).optional(),
  minRedeemPoints: z.number().int().min(0).optional(),
  maxRedeemPercent:z.number().min(0).max(100).optional(),
  expiryDays:      z.number().int().min(0).optional(),
});

/**
 *
 * @param request
 */
export async function PATCH(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('loyalty:manage_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const existing = await getLoyaltyConfig(tenantId);
    if (!existing) return NextResponse.json({ success: false, error: 'Loyalty config not found' }, { status: 404 });

    const updated = await withTenantContext(tenantId, () =>
      prisma.org_loyalty_programs_cf.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.earnRate        != null && { earn_rate:          parsed.data.earnRate }),
          ...(parsed.data.redeemRate      != null && { redeem_rate:        parsed.data.redeemRate }),
          ...(parsed.data.minRedeemPoints != null && { min_redeem_points:  parsed.data.minRedeemPoints }),
          ...(parsed.data.maxRedeemPercent!= null && { max_redeem_percent: parsed.data.maxRedeemPercent }),
          ...(parsed.data.expiryDays      != null && { expiry_days:        parsed.data.expiryDays }),
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
