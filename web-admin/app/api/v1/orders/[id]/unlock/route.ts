/**
 * Order Unlock API
 * POST /api/v1/orders/[id]/unlock - Release edit lock
 */

import { NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import { unlockOrder } from '@/lib/services/order-lock.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const tenantId = await getTenantIdFromSession();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID required' },
        { status: 401 }
      );
    }

    // Get user from session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body for force flag (admin override)
    let force = false;
    try {
      const body = await request.json();
      force = body.force === true;
    } catch {
      // No body is fine, force defaults to false
    }

    // Release lock
    await unlockOrder({
      orderId,
      tenantId,
      userId: user.id,
      force,
    });

    return NextResponse.json({
      success: true,
      message: 'Order unlocked successfully',
    });
  } catch (error) {
    console.error('Error unlocking order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlock order',
      },
      { status: 500 }
    );
  }
}
