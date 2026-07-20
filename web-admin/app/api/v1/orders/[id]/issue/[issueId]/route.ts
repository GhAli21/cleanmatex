/**
 * PATCH /api/v1/orders/[id]/issue/[issueId]
 * Resolve an issue (auth-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderService } from '@/lib/services/order-service';
import { ResolveIssueRequestSchema } from '@/lib/validations/workflow-schema';
import { ORDER_ISSUE_ERROR } from '@/lib/constants/order-issues';

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

/**
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    const { id: orderId, issueId } = await params;
    const { tenantId, userId } = await getAuthContext();

    const body = await request.json();
    const parsed = ResolveIssueRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await OrderService.resolveIssue(
      issueId,
      tenantId,
      parsed.data.solvedNotes,
      userId,
      orderId
    );

    if (!result.success) {
      const status =
        result.errorCode === ORDER_ISSUE_ERROR.ALREADY_SOLVED
          ? 409
          : result.errorCode === ORDER_ISSUE_ERROR.NOT_FOUND
            ? 404
            : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          data: result.issue,
        },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: result.issue });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
