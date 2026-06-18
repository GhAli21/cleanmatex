import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

const schema = z.object({
  isEnabled:       z.boolean().optional(),
  requiresCashDrawer: z.boolean().optional(),
  requiresTerminal:z.boolean().optional(),
  minOrderAmount:  z.number().min(0).optional(),
  maxOrderAmount:  z.number().min(0).optional(),
  displayName:     z.string().optional(),
  displayName2:    z.string().optional(),
  recOrder:        z.number().int().min(0).optional(),
});

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ methodId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('payment_config:manage')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { methodId } = await params;
  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid request', details: parsed.error.issues }, { status: 400 });

  try {
    const updated = await withTenantContext(tenantId, () =>
      prisma.org_payment_methods_cf.update({
        where: { id: methodId, tenant_org_id: tenantId },
        data: {
          ...(parsed.data.isEnabled          != null && { is_enabled:           parsed.data.isEnabled }),
          ...(parsed.data.requiresCashDrawer != null && { requires_cash_drawer: parsed.data.requiresCashDrawer }),
          ...(parsed.data.requiresTerminal   != null && { requires_terminal:    parsed.data.requiresTerminal }),
          ...(parsed.data.minOrderAmount     != null && { min_order_amount:     parsed.data.minOrderAmount }),
          ...(parsed.data.maxOrderAmount     != null && { max_order_amount:     parsed.data.maxOrderAmount }),
          ...(parsed.data.displayName                && { display_name:         parsed.data.displayName }),
          ...(parsed.data.displayName2               && { display_name2:        parsed.data.displayName2 }),
          ...(parsed.data.recOrder           != null && { rec_order:            parsed.data.recOrder }),
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
