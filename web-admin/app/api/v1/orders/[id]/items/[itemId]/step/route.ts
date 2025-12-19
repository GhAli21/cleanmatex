/**
 * POST /api/v1/orders/[id]/items/[itemId]/step
 * Record processing step for an item
 * PRD-010: 5-step processing tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ItemProcessingService } from '@/lib/services/item-processing-service';
import { RecordStepRequestSchema } from '@/lib/validations/workflow-schema';

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  return {
    tenantId: tenants[0].tenant_id as string,
    userId: user.id as string,
    userName: user.user_metadata?.full_name || user.email || 'User',
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const { tenantId, userId, userName } = await getAuthContext();

    const body = await request.json();
    const parsed = RecordStepRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error },
        { status: 400 }
      );
    }

    const result = await ItemProcessingService.recordProcessingStep({
      orderId: id,
      orderItemId: itemId,
      tenantId,
      stepCode: parsed.data.stepCode,
      stepSeq: parsed.data.stepSeq,
      notes: parsed.data.notes,
      userId,
      userName,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

