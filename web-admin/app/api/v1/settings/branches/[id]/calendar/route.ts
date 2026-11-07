import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { calendarError, calendarFailure, calendarOk } from '@/lib/api/business-calendar-http';
import { BRANCHES_PERMISSIONS } from '@/lib/constants/permissions/branches-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getBranchCalendar, updateBranchCalendar } from '@/lib/services/settings/business-calendar.service';
import { branchCalendarSchema } from '@/lib/validations/business-calendar-schemas';

export const dynamic = 'force-dynamic';

const idOf = async (params: Promise<{ id: string }>) => z.string().uuid().safeParse((await params).id);

/**
 * GET /api/v1/settings/branches/[id]/calendar — the branch's own values and the organization's (`branches:read`).
 * @param request - incoming request
 * @param ctx - route context
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requirePermission(BRANCHES_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  if (!id.success) return calendarError(400, 'VALIDATION_FAILED');
  try {
    return calendarOk(await getBranchCalendar(auth.tenantId, id.data));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'get_branch' });
  }
}

/**
 * PUT /api/v1/settings/branches/[id]/calendar — replace the branch's values; null = the organization's
 * (`branches:settings`, CSRF). Invalid hours answer 400 `CALENDAR_INVALID_HOURS`.
 * @param request - `{ businessHours, cutoffTime, readyTime }`
 * @param ctx - route context
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return calendarError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(BRANCHES_PERMISSIONS.SETTINGS)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  if (!id.success) return calendarError(400, 'VALIDATION_FAILED');
  const body = branchCalendarSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return calendarError(400, 'CALENDAR_INVALID_HOURS');
  try {
    return calendarOk(await updateBranchCalendar(auth.tenantId, auth.userId, id.data, body.data));
  } catch (error) {
    return calendarFailure(error, { tenantId: auth.tenantId, action: 'update_branch' });
  }
}
