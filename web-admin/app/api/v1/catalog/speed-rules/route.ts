import { NextRequest, NextResponse } from 'next/server';

import { speedRulesError, speedRulesFailure, speedRulesOk } from '@/lib/api/speed-rules-http';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createSpeedRule, listSpeedRules } from '@/lib/services/catalog/speed-rules.service';
import { speedRuleCreateSchema, speedRuleListQuerySchema } from '@/lib/validations/speed-rule-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/catalog/speed-rules — Speed Pricing rules, filtered and paged on the server (`pricing:read`).
 * @param request - filters: serviceSpeed, branchId, serviceCategoryCode, productId, active, page, pageSize
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission(PRICING_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  const q = speedRuleListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await listSpeedRules(auth.tenantId, q.data));
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'list' });
  }
}

/**
 * POST /api/v1/catalog/speed-rules — create a rule (`pricing:create`, CSRF). Duplicate scope → 409.
 * @param request - the rule
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return speedRulesError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(PRICING_PERMISSIONS.CREATE)(request);
  if (auth instanceof NextResponse) return auth;
  const body = speedRuleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await createSpeedRule(auth.tenantId, auth.userId, body.data), 201);
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'create' });
  }
}
