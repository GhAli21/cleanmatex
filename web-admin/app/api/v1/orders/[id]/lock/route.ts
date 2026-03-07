/**
 * Order Lock API
 * POST /api/v1/orders/[id]/lock - Acquire edit lock
 */

import { NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import { lockOrderForEdit } from '@/lib/services/order-lock.service';

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

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : undefined;

    // Acquire lock
    const lock = await lockOrderForEdit({
      orderId,
      tenantId,
      userId: user.id,
      userName: user.email || 'Unknown',
      sessionId: undefined, // Could be extracted from session if needed
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: lock,
    });
  } catch (error) {
    console.error('Error locking order:', error);

    // Check if it's a lock conflict
    const errorMessage = error instanceof Error ? error.message : 'Failed to lock order';
    const isLockConflict = errorMessage.toLowerCase().includes('locked by');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: isLockConflict ? 423 : 500 }
    );
  }
}
