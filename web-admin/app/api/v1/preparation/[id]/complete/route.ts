/**
 * Preparation: Complete preparation for an order
 * POST /api/v1/preparation/[id]/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completePreparation } from '@/lib/db/orders';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isPreparationEnabled } from '@/lib/config/features';
import { requireTenantAuth } from '@/lib/middleware/tenant-guard';
import { validateCSRF } from '@/lib/middleware/csrf';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    
    const { tenantId, userId } = auth;
    const { id: orderId } = await params;
    const body = await request.json();
    const { readyByOverride, internalNotes } = body || {};

    // Ensure order belongs to tenant (RLS will enforce, but verify for better error messages)
    const supabase = await createClient();
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
    await completePreparation(tenantId, orderId, userId, {
      readyByOverride: readyByOverride ? new Date(readyByOverride) : undefined,
      internalNotes,
    });

    // Per PRD-009: transition to 'sorting' after preparation
    // Wrap with tenant context so Prisma middleware can access tenant ID
    await withTenantContext(tenantId, async () => {
      await prisma.org_orders_mst.update({
        where: { id: orderId },
        data: { status: 'sorting' },
      });
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


