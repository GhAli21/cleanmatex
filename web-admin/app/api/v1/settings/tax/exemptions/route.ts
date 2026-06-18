import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('tax:view_config')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const customerId = request.nextUrl.searchParams.get('customerId') ?? undefined;

  try {
    const exemptions = await withTenantContext(tenantId, () =>
      prisma.org_tax_exemptions_cf.findMany({
        where: {
          tenant_org_id: tenantId,
          is_active:     true,
          rec_status:    1,
          ...(customerId ? { customer_id: customerId } : {}),
        },
        orderBy: { created_at: 'desc' },
      })
    );
    return NextResponse.json({ success: true, data: exemptions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch exemptions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const createSchema = z.object({
  customerId:    z.string().uuid().optional(),
  serviceType:   z.string().optional(),
  exemptionType: z.string().min(1),
  certificateNo: z.string().optional(),
  validFrom:     z.string().datetime(),
  validTo:       z.string().datetime().optional(),
});

/**
 *
 * @param request
 */
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
    const exemption = await withTenantContext(tenantId, () =>
      prisma.org_tax_exemptions_cf.create({
        data: {
          tenant_org_id:  tenantId,
          customer_id:    parsed.data.customerId ?? null,
          service_type:   parsed.data.serviceType ?? null,
          exemption_type: parsed.data.exemptionType,
          certificate_no: parsed.data.certificateNo ?? null,
          valid_from:     new Date(parsed.data.validFrom),
          valid_to:       parsed.data.validTo ? new Date(parsed.data.validTo) : null,
          is_active:      true,
          rec_status:     1,
        },
      })
    );
    return NextResponse.json({ success: true, data: exemption }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create exemption';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
