import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getLoyaltyConfig } from '@/lib/services/loyalty.service';
import { LOYALTY_ROUNDING_RULES } from '@/lib/constants/order-financial';
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
  // B21 — must be > 0, not just >= 0: a 0 redeem rate divides by zero at
  // redemption (mirrors the new chk_loyalty_redeem_rate_positive DB CHECK).
  redeemRate:      z.number().positive().optional(),
  minRedeemPoints: z.number().int().min(0).optional(),
  maxRedeemPercent:z.number().min(0).max(100).optional(),
  expiryDays:      z.number().int().min(0).optional(),
  roundingRule:    z.enum([
    LOYALTY_ROUNDING_RULES.HALF_UP,
    LOYALTY_ROUNDING_RULES.HALF_DOWN,
    LOYALTY_ROUNDING_RULES.FLOOR,
    LOYALTY_ROUNDING_RULES.CEIL,
  ]).optional(),
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

    // B21 — the field names below were previously earn_rate/redeem_rate/
    // max_redeem_percent/expiry_days, none of which exist on the Prisma
    // model (real columns: earn_rate_per_unit/redeem_rate_per_point/
    // max_redeem_pct_of_order/points_expiry_days) — this route would have
    // thrown "Unknown argument" on its very first real call. Confirmed dead
    // (the live UI writes through saveLoyaltyConfigAction, not this REST
    // route); fixed while in the file rather than left broken.
    const updated = await withTenantContext(tenantId, () =>
      prisma.org_loyalty_programs_cf.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.earnRate         != null && { earn_rate_per_unit:      parsed.data.earnRate }),
          ...(parsed.data.redeemRate       != null && { redeem_rate_per_point:   parsed.data.redeemRate }),
          ...(parsed.data.minRedeemPoints  != null && { min_redeem_points:       parsed.data.minRedeemPoints }),
          ...(parsed.data.maxRedeemPercent != null && { max_redeem_pct_of_order: parsed.data.maxRedeemPercent }),
          ...(parsed.data.expiryDays       != null && { points_expiry_days:      parsed.data.expiryDays }),
          ...(parsed.data.roundingRule     != null && { rounding_rule:           parsed.data.roundingRule }),
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
