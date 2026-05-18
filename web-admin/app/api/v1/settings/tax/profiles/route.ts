import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const profiles = await withTenantContext(tenantId, () =>
      prisma.org_tax_profiles_cf.findMany({
        where:   { tenant_org_id: tenantId, rec_status: 1 },
        orderBy: { created_at: 'asc' },
      })
    );
    return NextResponse.json({ success: true, data: profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tax profiles';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const createSchema = z.object({
  name:          z.string().min(1),
  name2:         z.string().optional(),
  taxType:       z.enum(['VAT', 'GST', 'CUSTOM']),
  rate:          z.number().min(0).max(100),
  isCompound:    z.boolean().optional(),
  appliesTo:     z.array(z.string()).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo:   z.string().datetime().optional(),
  isDefault:     z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('tax:manage_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const body   = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const profile = await withTenantContext(tenantId, () =>
      prisma.org_tax_profiles_cf.create({
        data: {
          tenant_org_id:  tenantId,
          name:           parsed.data.name,
          name2:          parsed.data.name2 ?? null,
          tax_type:       parsed.data.taxType,
          rate:           parsed.data.rate,
          is_compound:    parsed.data.isCompound ?? false,
          applies_to:     parsed.data.appliesTo ?? [],
          effective_from: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date(),
          effective_to:   parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          is_default:     parsed.data.isDefault ?? false,
          is_active:      true,
          rec_status:     1,
        },
      })
    );
    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create tax profile';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
