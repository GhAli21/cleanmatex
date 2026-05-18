import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { getLoyaltyConfig } from '@/lib/services/loyalty.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

const schema = z.object({
  name:            z.string().min(1),
  name2:           z.string().optional(),
  minPoints:       z.number().int().min(0),
  bonusMultiplier: z.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('loyalty:manage_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const program = await getLoyaltyConfig(tenantId);
    if (!program) return NextResponse.json({ success: false, error: 'Loyalty program not configured' }, { status: 404 });

    const tier = await withTenantContext(tenantId, () =>
      prisma.org_loyalty_tiers_cf.create({
        data: {
          tenant_org_id:    tenantId,
          program_id:       program.id,
          name:             parsed.data.name,
          name2:            parsed.data.name2 ?? null,
          min_points:       parsed.data.minPoints,
          bonus_multiplier: parsed.data.bonusMultiplier ?? 1.0,
          is_active:        true,
          rec_status:       1,
        },
      })
    );
    return NextResponse.json({ success: true, data: tier }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tier creation failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
