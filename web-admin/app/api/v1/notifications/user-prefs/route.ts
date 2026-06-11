/**
 * GET  /api/v1/notifications/user-prefs  — fetch current user's preferences
 * PUT  /api/v1/notifications/user-prefs  — update a preference
 * Requires notifications:manage permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('org_ntf_user_prefs_dtl')
    .select('id, channel_code, event_code, is_enabled, marketing_consent, consent_given_at')
    .eq('tenant_org_id', tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('channel_code');

  if (error) {
    logger.error('GET /api/v1/notifications/user-prefs failed', new Error(error.message), { tenantId, userId, feature: 'notifications' });
    return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;

  const body = await request.json() as {
    channel_code: string;
    event_code?: string | null;
    is_enabled?: boolean;
    marketing_consent?: boolean;
  };

  if (!body.channel_code) {
    return NextResponse.json({ success: false, error: 'channel_code is required' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('org_ntf_user_prefs_dtl')
    .upsert(
      {
        tenant_org_id:    tenantId,
        user_id:          userId,
        channel_code:     body.channel_code,
        event_code:       body.event_code ?? null,
        ...(body.is_enabled !== undefined       && { is_enabled: body.is_enabled }),
        ...(body.marketing_consent !== undefined && {
          marketing_consent: body.marketing_consent,
          consent_given_at:  body.marketing_consent ? new Date().toISOString() : null,
          consent_withdrawn_at: body.marketing_consent ? null : new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
        rec_status: 1,
        is_active:  true,
        created_by: userId,
      },
      { onConflict: 'tenant_org_id,user_id,channel_code,event_code,branch_id' }
    )
    .select()
    .single();

  if (error) {
    logger.error('PUT /api/v1/notifications/user-prefs failed', new Error(error.message), { tenantId, userId, feature: 'notifications' });
    return NextResponse.json({ success: false, error: 'Failed to update preference' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
