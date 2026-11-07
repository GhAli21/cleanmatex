/**
 * GET /api/v1/lookups/service-speeds
 * Active sys_service_speed_cd rows for the New Order / Edit Order speed menus
 * and the Speed Pricing editor (Line-Level P5-03b; Service Speeds PLAN §6).
 * Auth-only; each row carries `is_offered` for the session's organization (D5).
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { listActiveServiceSpeeds } from '@/lib/services/lookups';

/**
 * Lists the active speeds with this organization's offered flag.
 * @returns `{ success, data: ServiceSpeedLookupRow[] }`
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const tenantOrgId = await getTenantIdFromSession();
  if (!tenantOrgId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await listActiveServiceSpeeds(auth.supabase, tenantOrgId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: 'The service speeds could not be loaded.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data ?? [] });
}
