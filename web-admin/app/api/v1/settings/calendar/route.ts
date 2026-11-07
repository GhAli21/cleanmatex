import { NextRequest, NextResponse } from 'next/server';

import { calendarError, calendarFailure, calendarOk } from '@/lib/api/business-calendar-http';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getOrganizationCalendar, updateOrganizationCalendar } from '@/lib/services/settings/business-calendar.service';
import { organizationCalendarSchema } from '@/lib/validations/business-calendar-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/settings/calendar — the organization's hours, cut-off and ready time (`settings:read`).
 * @param request - incoming request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission(SETTINGS_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return calendarOk(await getOrganizationCalendar(auth.tenantId));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'get' });
  }
}

/**
 * PUT /api/v1/settings/calendar — replace them (`settings:organization`, CSRF).
 * Invalid hours answer 400 `CALENDAR_INVALID_HOURS`.
 * @param request - `{ businessHours, cutoffTime, readyTime }`
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return calendarError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(SETTINGS_PERMISSIONS.ORGANIZATION)(request);
  if (auth instanceof NextResponse) return auth;
  const body = organizationCalendarSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return calendarError(400, 'CALENDAR_INVALID_HOURS');
  try {
    return calendarOk(await updateOrganizationCalendar(auth.tenantId, auth.userId, body.data));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'update' });
  }
}
