/**
 * GET  /api/v1/branches/[id] — Branch detail including pricing mode fields
 * PATCH /api/v1/branches/[id] — Update branch pricing mode overrides
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { TAX_PRICING_MODES, EXTRA_PRICE_PRICING_MODES } from '@/lib/constants/order-financial';

const VALID_TAX_MODES = new Set<string>(Object.values(TAX_PRICING_MODES));
const VALID_EXTRA_MODES = new Set<string>(Object.values(EXTRA_PRICE_PRICING_MODES));

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
      },
    });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ data: branch });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantIdFromSession();
    const body: { tax_pricing_mode?: string | null; extra_price_pricing_mode?: string | null } =
      await request.json();

    const updateData: Record<string, string | null> = {};

    if ('tax_pricing_mode' in body) {
      const mode = body.tax_pricing_mode;
      if (mode !== null && mode !== undefined && !VALID_TAX_MODES.has(mode)) {
        return NextResponse.json(
          { error: `Invalid tax_pricing_mode. Valid values: ${[...VALID_TAX_MODES].join(', ')}` },
          { status: 400 },
        );
      }
      updateData.tax_pricing_mode = mode ?? null;
    }

    if ('extra_price_pricing_mode' in body) {
      const mode = body.extra_price_pricing_mode;
      if (mode !== null && mode !== undefined && !VALID_EXTRA_MODES.has(mode)) {
        return NextResponse.json(
          {
            error: `Invalid extra_price_pricing_mode. Valid values: ${[...VALID_EXTRA_MODES].join(', ')}`,
          },
          { status: 400 },
        );
      }
      updateData.extra_price_pricing_mode = mode ?? null;
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
