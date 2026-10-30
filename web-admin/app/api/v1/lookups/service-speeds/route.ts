/**
 * GET /api/v1/lookups/service-speeds
 * Active sys_service_speed_cd rows for the New Order / Edit Order speed menus
 * (Line-Level P5-03b). Auth-only, read-only HQ catalog; no tenant data.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listActiveServiceSpeeds } from '@/lib/services/lookups';

/**
 * Lists the active speeds.
 * @returns `{ success, data: ServiceSpeedLookupRow[] }`
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await listActiveServiceSpeeds(supabase);
  if (!result.success) {
    return NextResponse.json({ success: false, error: 'The service speeds could not be loaded.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data ?? [] });
}
