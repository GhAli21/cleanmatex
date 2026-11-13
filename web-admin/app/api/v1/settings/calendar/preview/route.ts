import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { calendarError, calendarFailure, calendarOk } from '@/lib/api/business-calendar-http';
import { BRANCHES_PERMISSIONS } from '@/lib/constants/permissions/branches-perm';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { requirePermission } from '@/lib/middleware/require-permission';
import { previewReadyTimes } from '@/lib/services/settings/business-calendar.service';

export const dynamic = 'force-dynamic';

const query = z.object({ branchId: z.string().guid().optional() });

/**
 * GET /api/v1/settings/calendar/preview?branchId= — "an order placed now": the promised ready time per
 * speed from the saved calendar (`settings:read`; a branch also needs `branches:read`). Read-only.
 * @param request - incoming request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission(SETTINGS_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = query.safeParse({ branchId: request.nextUrl.searchParams.get('branchId') ?? undefined });
  if (!parsed.success) return calendarError(400, 'VALIDATION_FAILED');
  if (parsed.data.branchId) {
    const branchAuth = await requirePermission(BRANCHES_PERMISSIONS.READ)(request);
    if (branchAuth instanceof NextResponse) return branchAuth;
  }
  try {
    return calendarOk(await previewReadyTimes(auth.tenantId, parsed.data.branchId ?? null));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'preview' });
  }
}
