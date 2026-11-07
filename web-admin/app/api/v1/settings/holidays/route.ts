import { NextRequest, NextResponse } from 'next/server';

import { calendarError, calendarFailure, calendarOk } from '@/lib/api/business-calendar-http';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createHoliday, listHolidays } from '@/lib/services/settings/business-calendar.service';
import { holidayListQuerySchema, holidaySchema } from '@/lib/validations/business-calendar-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/settings/holidays?year=2027[&branchId=] — the organization's holidays and its
 * country's public holidays for the year (`settings:read`).
 * @param request - incoming request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission(SETTINGS_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  const q = holidayListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return calendarError(400, 'VALIDATION_FAILED');
  try {
    return calendarOk(await listHolidays(auth.tenantId, q.data));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'list_holidays' });
  }
}

/**
 * POST /api/v1/settings/holidays — add a holiday (`settings:organization`, CSRF).
 * A date already set for the same branch scope answers 409 `HOLIDAY_DUPLICATE`.
 * @param request - the holiday
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return calendarError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(SETTINGS_PERMISSIONS.ORGANIZATION)(request);
  if (auth instanceof NextResponse) return auth;
  const body = holidaySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return calendarError(400, 'VALIDATION_FAILED');
  try {
    return calendarOk(await createHoliday(auth.tenantId, auth.userId, body.data), 201);
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'create_holiday' });
  }
}
