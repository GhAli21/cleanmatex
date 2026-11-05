import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { taxProfileRoundingColumns, taxProfileRoundingSchema } from '@/lib/validations/tax-profile-rounding-schema';

const schema = z.object({
  name:              z.string().min(1).optional(),
  name2:             z.string().optional(),
  taxRate:           z.number().min(0).max(100).optional(),
  isActive:          z.boolean().optional(),
}).merge(taxProfileRoundingSchema);

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('tax:manage_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { profileId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const updated = await withTenantContext(tenantId, () =>
      prisma.org_tax_profiles_cf.update({
        where: { id: profileId, tenant_org_id: tenantId },
        data: {
          ...(parsed.data.name             != null && { name:               parsed.data.name }),
          ...(parsed.data.name2            != null && { name2:              parsed.data.name2 }),
          // The column is `rate` (there was never a `tax_rate` / `secondary_tax_rate`: those writes failed).
          ...(parsed.data.taxRate          != null && { rate:               parsed.data.taxRate }),
          ...(parsed.data.isActive         != null && { is_active:          parsed.data.isActive }),
          ...taxProfileRoundingColumns(parsed.data),
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
