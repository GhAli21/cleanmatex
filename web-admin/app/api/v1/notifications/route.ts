/**
 * GET /api/v1/notifications
 * Paginated notification inbox for the current user.
 * Filters strictly by tenant_org_id + recipient_user_id — no cross-tenant leakage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const PAGE_SIZE_MAX = 50;

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:read')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;
  const { searchParams } = request.nextUrl;

  const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1', 10));
  const limit    = Math.min(PAGE_SIZE_MAX, parseInt(searchParams.get('limit') ?? '20', 10));
  const isRead   = searchParams.get('is_read');       // 'true' | 'false' | null = all
  const category = searchParams.get('category_code'); // filter by category tab

  const supabase = createAdminSupabaseClient();
  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  let query = supabase
    .from('org_ntf_inbox_mst')
    .select('*', { count: 'exact' })
    .eq('tenant_org_id', tenantId)
    .eq('recipient_user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (isRead === 'true')  query = query.eq('is_read', true);
  if (isRead === 'false') query = query.eq('is_read', false);
  if (category)          query = query.eq('category_code', category);

  const { data, count, error } = await query;

  if (error) {
    logger.error('GET /api/v1/notifications failed', new Error(error.message), {
      tenantId, userId, feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  });
}
