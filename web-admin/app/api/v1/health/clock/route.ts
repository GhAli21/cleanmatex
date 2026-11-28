/**
 * GET /api/v1/health/clock
 * Clock health for the signed-in user's organization (read-only, S7 §7.7): runtime tz database,
 * app vs DB clock skew, tzdb agreement vectors and the `fn_cmx_dt_health` findings
 * (zone catalog, fake clock outside test). Needs the setup-health view permission.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { SETUP_HEALTH_PERMISSIONS } from '@/lib/constants/permissions/setup-health-perm';
import { prisma } from '@/lib/db/prisma';
import { getClockHealth } from '@/lib/clock/clock-health.server';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * Returns the clock health report. 200 even when findings exist; `data.status` carries the verdict.
 * @param request - Incoming request
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(SETUP_HEALTH_PERMISSIONS.VIEW)(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Tenant comes from the session (auth.tenantId), never from the query.
    const data = await getClockHealth(prisma, auth.tenantId);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('GET /api/v1/health/clock failed', error instanceof Error ? error : undefined, {
      feature: 'clock',
      action: 'health',
      tenantId: auth.tenantId,
    });
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'CLOCK_HEALTH_FAILED' }, { status: 500 });
  }
}
