/**
 * Preparation: Complete preparation for an order
 * POST /api/v1/preparation/[id]/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completePreparation } from '@/lib/db/orders';
import { prisma } from '@/lib/db/prisma';
import { isPreparationEnabled } from '@/lib/config/features';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId } = params;
    const body = await request.json();
    const { readyByOverride, internalNotes } = body || {};

    const supabase = createClient();
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

    // Ensure order belongs to tenant
    const { data: order, error: fetchError } = await supabase
      .from('org_orders_mst')
      .select('id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Complete preparation using domain logic
    await completePreparation(tenantId, orderId, user.id, {
      readyByOverride: readyByOverride ? new Date(readyByOverride) : undefined,
      internalNotes,
    });

    // Per PRD-009: transition to 'sorting' after preparation
    await prisma.org_orders_mst.update({
      where: { id: orderId, tenant_org_id: tenantId },
      data: { status: 'sorting' },
    });

    return NextResponse.json({ success: true, data: { orderId, status: 'sorting', preparation_status: 'completed' } });
  } catch (error) {
    console.error('POST /api/v1/preparation/[id]/complete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


