/**
 * GET /api/v1/notifications/unread-count
 * Returns the number of unread notifications for the current user.
 * Used by the notification bell badge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:read')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;
  const supabase = createAdminSupabaseClient();

  const { count, error } = await supabase
    .from('org_ntf_inbox_mst')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantId)
    .eq('recipient_user_id', userId)
    .eq('is_read', false)
    .eq('is_active', true);

  if (error) {
    logger.error('GET /api/v1/notifications/unread-count failed', new Error(error.message), {
      tenantId, userId, feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'Failed to fetch unread count' }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: count ?? 0 });
}
