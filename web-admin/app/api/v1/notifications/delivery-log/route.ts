/**
 * GET /api/v1/notifications/delivery-log
 * Returns paginated outbox dispatch history for the current tenant.
 * Requires notifications:view_log permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE_MAX = 50;

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:view_log')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId } = authCheck;
  const { searchParams } = request.nextUrl;

  const page       = Math.max(1, parseInt(searchParams.get('page')    ?? '1',  10));
  const limit      = Math.min(PAGE_SIZE_MAX, parseInt(searchParams.get('limit') ?? '20', 10));
  const channelFilter = searchParams.get('channel_code');
  const statusFilter  = searchParams.get('status');

  const supabase = createAdminSupabaseClient();
  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  let query = supabase
    .from('org_ntf_outbox_dtl')
    .select(
      'id, channel_code, recipient_address, recipient_user_id, event_code, status, skip_reason, error_message, retry_count, scheduled_at, sent_at, created_at',
      { count: 'exact' }
    )
    .eq('tenant_org_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (channelFilter) query = query.eq('channel_code', channelFilter);
  if (statusFilter)  query = query.eq('status', statusFilter);

  const { data, count, error } = await query;

  if (error) {
    logger.error('GET /api/v1/notifications/delivery-log failed', new Error(error.message), {
      tenantId, feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'Failed to fetch delivery log' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  });
}
