/**
 * Preparation: Update/Delete single item
 * PATCH /api/v1/preparation/[id]/items/[itemId]
 * DELETE /api/v1/preparation/[id]/items/[itemId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isPreparationEnabled } from '@/lib/config/features';
import { requireTenantAuth } from '@/lib/middleware/tenant-guard';
import { validateCSRF } from '@/lib/middleware/csrf';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Validate CSRF token
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) {
      return csrfResponse;
    }

    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    
    // Use tenant guard to ensure JWT has tenant context
    const auth = await requireTenantAuth('orders:update')(request);
    if (auth instanceof NextResponse) {
      return auth; // Unauthorized or invalid tenant
    }
    
    const { tenantId } = auth;
    const { id: orderId, itemId } = await params;
    const data = await request.json();

    // Update item - wrap with tenant context so Prisma middleware can access tenant ID
    const updated = await withTenantContext(tenantId, async () => {
      return await prisma.org_order_items_dtl.update({
      where: {
        id: itemId,
        order_id: orderId,
      },
      data: {
        product_id: data.productId ?? undefined,
        service_category_code: data.serviceCategoryCode ?? undefined,
        quantity: data.quantity ?? undefined,
        price_per_unit: data.pricePerUnit ?? undefined,
        total_price: data.totalPrice ?? undefined,
        color: data.color ?? undefined,
        brand: data.brand ?? undefined,
        has_stain: data.hasStain ?? undefined,
        stain_notes: data.stainNotes ?? undefined,
        has_damage: data.hasDamage ?? undefined,
        damage_notes: data.damageNotes ?? undefined,
        notes: data.notes ?? undefined,
      },
    });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('PATCH /api/v1/preparation/[id]/items/[itemId] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Validate CSRF token
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) {
      return csrfResponse;
    }

    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    
    // Use tenant guard to ensure JWT has tenant context
    const auth = await requireTenantAuth('orders:update')(request);
    if (auth instanceof NextResponse) {
      return auth; // Unauthorized or invalid tenant
    }
    
    const { id: orderId, itemId } = await params;
    const { tenantId } = auth;

    // Delete item - wrap with tenant context so Prisma middleware can access tenant ID
    await withTenantContext(tenantId, async () => {
      await prisma.org_order_items_dtl.delete({
      where: {
        id: itemId,
        order_id: orderId,
      },
    });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/v1/preparation/[id]/items/[itemId] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


