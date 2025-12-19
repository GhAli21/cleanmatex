/**
 * Preparation: Update/Delete single item
 * PATCH /api/v1/preparation/[id]/items/[itemId]
 * DELETE /api/v1/preparation/[id]/items/[itemId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { isPreparationEnabled } from '@/lib/config/features';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId, itemId } = await params;
    const data = await request.json();

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID not found' }, { status: 400 });
    }

    // Update item with tenant scoping
    const updated = await prisma.org_order_items_dtl.update({
      where: {
        id: itemId,
        order_id: orderId,
        tenant_org_id: tenantId,
      } as any,
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId, itemId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID not found' }, { status: 400 });
    }

    await prisma.org_order_items_dtl.delete({
      where: {
        id: itemId,
        order_id: orderId,
        tenant_org_id: tenantId,
      } as any,
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


