/**
 * PATCH /api/v1/notifications/read-all
 * Mark all unread notifications as read for the current user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 *
 * @param request
 */
export async function PATCH(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;
  const supabase = createAdminSupabaseClient();

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('org_ntf_inbox_mst')
    .update({ is_read: true, read_at: now, updated_at: now, updated_by: userId })
    .eq('tenant_org_id', tenantId)
    .eq('recipient_user_id', userId)
    .eq('is_read', false)
    .eq('is_active', true);

  if (error) {
    logger.error('PATCH /api/v1/notifications/read-all failed', new Error(error.message), {
      tenantId, userId, feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'Failed to mark all as read' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
