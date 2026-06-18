/**
 * PATCH /api/v1/notifications/[id]/read
 * Mark a single notification as read.
 * Validates tenant_org_id + recipient_user_id ownership before updating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('notifications:manage')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('org_ntf_inbox_mst')
    .update({ is_read: true, read_at: now, updated_at: now, updated_by: userId })
    .eq('id', id)
    .eq('tenant_org_id', tenantId)     // tenant isolation guard
    .eq('recipient_user_id', userId)   // ownership guard — users can only mark their own
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('PATCH /api/v1/notifications/[id]/read failed', new Error(error.message), {
      tenantId, userId, notificationId: id, feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'Failed to mark as read' }, { status: 500 });
  }

  if (!data) {
    // Row not found or belongs to different tenant/user
    return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
