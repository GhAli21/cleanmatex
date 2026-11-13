import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { speedRulesError, speedRulesFailure, speedRulesOk } from '@/lib/api/speed-rules-http';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { deleteSpeedRule, getSpeedRule, updateSpeedRule } from '@/lib/services/catalog/speed-rules.service';
import { speedRuleUpdateSchema } from '@/lib/validations/speed-rule-schemas';

export const dynamic = 'force-dynamic';

const idOf = async (params: Promise<{ id: string }>) => z.string().guid().safeParse((await params).id);

/**
 * GET /api/v1/catalog/speed-rules/[id] (`pricing:read`).
 * @param request - incoming request
 * @param ctx - route context
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await requirePermission(PRICING_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  if (!id.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await getSpeedRule(auth.tenantId, id.data));
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'get' });
  }
}

/**
 * PATCH /api/v1/catalog/speed-rules/[id] — replace the rule (`pricing:update`, CSRF).
 * @param request - the rule as it should be
 * @param ctx - route context
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return speedRulesError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(PRICING_PERMISSIONS.UPDATE)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  const body = speedRuleUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await updateSpeedRule(auth.tenantId, auth.userId, id.data, body.data));
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'update' });
  }
}

/**
 * DELETE /api/v1/catalog/speed-rules/[id] (`pricing:delete`, CSRF).
 * A rule used by an order line answers 409 RULE_IN_USE: deactivate it instead.
 * @param request - incoming request
 * @param ctx - route context
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return speedRulesError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(PRICING_PERMISSIONS.DELETE)(request);
  if (auth instanceof NextResponse) return auth;
  const id = await idOf(params);
  if (!id.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    await deleteSpeedRule(auth.tenantId, auth.userId, id.data);
    return speedRulesOk({ deleted: true });
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'delete' });
  }
}
