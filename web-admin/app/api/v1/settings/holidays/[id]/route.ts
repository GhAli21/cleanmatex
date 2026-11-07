import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { calendarError, calendarFailure, calendarOk } from '@/lib/api/business-calendar-http';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { deleteHoliday, updateHoliday } from '@/lib/services/settings/business-calendar.service';
import { holidaySchema } from '@/lib/validations/business-calendar-schemas';

export const dynamic = 'force-dynamic';

const idOf = async (params: Promise<{ id: string }>) => z.string().uuid().safeParse((await params).id);

/**
 * PATCH /api/v1/settings/holidays/[id] — replace a holiday (`settings:organization`, CSRF).
 * @param request - the holiday as it should be
 * @param ctx - route context
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return calendarError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(SETTINGS_PERMISSIONS.ORGANIZATION)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  const body = holidaySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return calendarError(400, 'VALIDATION_FAILED');
  try {
    return calendarOk(await updateHoliday(auth.tenantId, auth.userId, id.data, body.data));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'update_holiday' });
  }
}

/**
 * DELETE /api/v1/settings/holidays/[id] (`settings:organization`, CSRF).
 * @param request - incoming request
 * @param ctx - route context
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return calendarError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(SETTINGS_PERMISSIONS.ORGANIZATION)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  if (!id.success) return calendarError(400, 'VALIDATION_FAILED');
  try {
    await deleteHoliday(auth.tenantId, id.data);
    return calendarOk({ deleted: true });
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'delete_holiday' });
  }
}
