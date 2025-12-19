/**
 * POST /api/v1/orders/[id]/issue
 * Create issue for order or item
 * PRD-010: Issue tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/services/order-service';
import { CreateIssueRequestSchema } from '@/lib/validations/workflow-schema';

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
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { tenantId, userId } = await getAuthContext();

    const body = await request.json();
    const parsed = CreateIssueRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error },
        { status: 400 }
      );
    }

    const result = await OrderService.createIssue(
      id,
      parsed.data.orderItemId || null,
      tenantId,
      parsed.data.issueCode,
      parsed.data.issueText,
      parsed.data.photoUrl,
      parsed.data.priority || 'normal',
      userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.issue });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

