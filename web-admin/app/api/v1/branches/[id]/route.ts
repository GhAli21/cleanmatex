/**
 * GET  /api/v1/branches/[id] — Branch detail including pricing mode fields and the business-day timezone
 * PATCH /api/v1/branches/[id] — Update the branch timezone. The pricing-mode overrides are managed by HQ (L18):
 *   sending them answers 403 FIELD_MANAGED_BY_HQ.
 *
 * The branch timezone (`timezone_code`, NULL = inherit the organization timezone) decides the branch
 * business date and when a POS session rolls over, so changing it needs `settings:update`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { requirePermission } from '@/lib/middleware/require-permission';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { FIELD_MANAGED_BY_HQ, HQ_MANAGED_PRICING_FIELDS } from '@/lib/constants/order-financial';

/**
 *
 * @param _request
 * @param root0
 * @param root0.params
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantIdFromSession();

    const branch = await prisma.org_branches_mst.findFirst({
      where: { id, tenant_org_id: tenantId, is_active: true },
      select: {
        id: true,
        name: true,
        name2: true,
        is_main: true,
        tax_pricing_mode: true,
        extra_price_pricing_mode: true,
        timezone_code: true,
      },
    });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // What the branch actually uses when it has no timezone of its own.
    const tenant = await prisma.org_tenants_mst.findFirst({
      where: { id: tenantId },
      select: { timezone: true },
    });

    return NextResponse.json({ data: { ...branch, tenant_timezone: tenant?.timezone ?? null } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 });
  }
}

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantIdFromSession();
    const body: {
      tax_pricing_mode?: string | null;
      extra_price_pricing_mode?: string | null;
      timezone_code?: string | null;
    } = await request.json();

    // L18: HQ is the only writer of the branch pricing overrides; refuse before anything is written.
    const managed = HQ_MANAGED_PRICING_FIELDS.branch.filter((field) => field in body);
    if (managed.length > 0) {
      return NextResponse.json(
        { error: 'This setting is managed by platform administration.', code: FIELD_MANAGED_BY_HQ, fields: managed },
        { status: 403 },
      );
    }

    const updateData: Record<string, string | null> = {};

    if ('timezone_code' in body) {
      const auth = await requirePermission(SETTINGS_PERMISSIONS.UPDATE)(request);
      if (auth instanceof NextResponse) return auth;

      const zone = body.timezone_code;
      if (zone !== null && zone !== undefined) {
        const known = await prisma.sys_timezone_cd.findFirst({
          where: { code: zone, is_active: true },
          select: { code: true },
        });
        if (!known) {
          return NextResponse.json({ error: 'Invalid timezone_code. Choose a catalogued timezone.' }, { status: 400 });
        }
      }
      updateData.timezone_code = zone ?? null;
    }

    const branch = await prisma.org_branches_mst.updateMany({
      where: { id, tenant_org_id: tenantId },
      data: { ...updateData, updated_at: new Date() },
    });

    if (branch.count === 0) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Branch settings updated' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update branch settings' }, { status: 500 });
  }
}
