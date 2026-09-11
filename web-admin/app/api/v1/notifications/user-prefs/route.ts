/**
 * GET  /api/v1/notifications/user-prefs  — fetch current user's preferences
 * PUT  /api/v1/notifications/user-prefs  — update a preference
 * Requires notifications:manage permission.
 *
 * PUT updates the existing coarse row (NULL event/branch) instead of upserting.
 * ON CONFLICT cannot match NULL unique keys, so upsert inserted duplicates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { collapseUserPrefRows, pickLatestUserPrefRow } from '@lib/notifications/user-prefs';
import { notificationSettingsService } from '@/lib/notifications/settings-service';
import { logger } from '@/lib/utils/logger';

const putPrefSchema = z.object({
  channel_code: z.string().min(1),
  event_code: z.string().nullable().optional(),
  is_enabled: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
});

/**
 * GET /api/v1/notifications/user-prefs
 *
 * Returns the current user's active prefs, one row per channel/event/branch scope.
 * Tenant resolved server-side from the authenticated session.
 *
 * @param request Incoming request (auth + tenant from session)
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('org_ntf_user_prefs_dtl')
    .select('id, user_id, channel_code, event_code, branch_id, is_enabled, marketing_consent, consent_given_at, updated_at, created_at')
    .eq('tenant_org_id', tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('channel_code');

  if (error) {
    logger.error('GET /api/v1/notifications/user-prefs failed', new Error(error.message), { tenantId, userId, feature: 'notifications' });
    return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: collapseUserPrefRows(data ?? []) });
}

/**
 * PUT /api/v1/notifications/user-prefs
 *
 * Updates the matching preference row, or inserts one when none exists.
 * Tenant resolved server-side from the authenticated session.
 *
 * @param request JSON body with channel_code and optional is_enabled / marketing_consent
 */
export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission('notifications:manage')(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const { tenantId, userId } = authCheck;

  const parsed = putPrefSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'channel_code is required' }, { status: 400 });
  }

  const body = parsed.data;
  const eventCode = body.event_code ?? null;
  const now = new Date().toISOString();
  const supabase = createAdminSupabaseClient();

  let findQuery = supabase
    .from('org_ntf_user_prefs_dtl')
    .select('id, channel_code, event_code, branch_id, updated_at, created_at')
    .eq('tenant_org_id', tenantId)
    .eq('user_id', userId)
    .eq('channel_code', body.channel_code)
    .eq('is_active', true)
    .is('branch_id', null);

  findQuery = eventCode === null
    ? findQuery.is('event_code', null)
    : findQuery.eq('event_code', eventCode);

  const { data: existingRows, error: findError } = await findQuery;

  if (findError) {
    logger.error('PUT /api/v1/notifications/user-prefs lookup failed', new Error(findError.message), { tenantId, userId, feature: 'notifications' });
    return NextResponse.json({ success: false, error: 'Failed to update preference' }, { status: 500 });
  }

  const patch = {
    ...(body.is_enabled !== undefined && { is_enabled: body.is_enabled }),
    ...(body.marketing_consent !== undefined && {
      marketing_consent: body.marketing_consent,
      consent_given_at: body.marketing_consent ? now : null,
      consent_withdrawn_at: body.marketing_consent ? null : now,
    }),
    updated_at: now,
    rec_status: 1,
    is_active: true,
  };

  const existing = pickLatestUserPrefRow(existingRows ?? []);
  const write = existing?.id
    ? supabase
        .from('org_ntf_user_prefs_dtl')
        .update(patch)
        .eq('id', existing.id)
        .eq('tenant_org_id', tenantId)
        .select()
        .single()
    : supabase
        .from('org_ntf_user_prefs_dtl')
        .insert({
          tenant_org_id: tenantId,
          user_id: userId,
          branch_id: null,
          channel_code: body.channel_code,
          event_code: eventCode,
          ...patch,
          created_by: userId,
        })
        .select()
        .single();

  const { data, error } = await write;

  if (error) {
    logger.error('PUT /api/v1/notifications/user-prefs failed', new Error(error.message), { tenantId, userId, feature: 'notifications' });
    return NextResponse.json({ success: false, error: 'Failed to update preference' }, { status: 500 });
  }

  notificationSettingsService.invalidateUserPrefs(tenantId, userId);

  return NextResponse.json({ success: true, data });
}
