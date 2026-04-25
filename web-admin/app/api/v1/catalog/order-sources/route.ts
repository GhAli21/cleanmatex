import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { requirePermission } from '@/lib/middleware/require-permission';

const putSchema = z.object({
  entries: z.array(
    z.object({
      order_source_code: z.string().min(1).max(64),
      is_allowed: z.boolean(),
    }),
  ),
});

/**
 * GET /api/v1/catalog/order-sources
 * Active global sources plus per-tenant allow flags (empty CF table = all allowed).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('config:preferences_manage')(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { tenantId } = auth;

  return withTenantContext(tenantId, async () => {
    const sources = await prisma.sys_order_sources_cd.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { order_source_code: 'asc' }],
    });
    const cf = await prisma.org_tenant_order_sources_cf.findMany({
      where: { tenant_org_id: tenantId },
    });
    const hasCf = cf.length > 0;

    return NextResponse.json({
      success: true,
      data: {
        tenantHasExplicitAllowList: hasCf,
        sources: sources.map((s) => ({
          order_source_code: s.order_source_code,
          name: s.name,
          name2: s.name2,
          requires_remote_intake_confirm: s.requires_remote_intake_confirm,
          is_allowed: hasCf
            ? (cf.find((r) => r.order_source_code === s.order_source_code)?.is_allowed ?? false)
            : true,
        })),
      },
    });
  });
}

/**
 * PUT /api/v1/catalog/order-sources
 * Replaces tenant org_tenant_order_sources_cf rows with the submitted snapshot (may be empty to clear).
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePermission('config:preferences_manage')(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { tenantId } = auth;

  const json = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withTenantContext(tenantId, async () => {
    await prisma.org_tenant_order_sources_cf.deleteMany({
      where: { tenant_org_id: tenantId },
    });
    if (parsed.data.entries.length > 0) {
      await prisma.org_tenant_order_sources_cf.createMany({
        data: parsed.data.entries.map((e) => ({
          tenant_org_id: tenantId,
          order_source_code: e.order_source_code,
          is_allowed: e.is_allowed,
        })),
      });
    }
    return NextResponse.json({ success: true });
  });
}
