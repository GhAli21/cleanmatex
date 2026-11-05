import { NextRequest, NextResponse } from 'next/server';

import { speedRulesError, speedRulesFailure, speedRulesOk } from '@/lib/api/speed-rules-http';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { requirePermission } from '@/lib/middleware/require-permission';
import { resolveSpeedRule } from '@/lib/services/catalog/speed-rules.service';
import { speedRuleResolveQuerySchema } from '@/lib/validations/speed-rule-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/catalog/speed-rules/resolve?serviceSpeed&productId&branchId&date — which rule wins and why (`pricing:read`).
 * The same selection the calculator makes; every matching rule is listed, most specific first.
 * @param request - the row to resolve
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission(PRICING_PERMISSIONS.READ)(request);
  if (auth instanceof NextResponse) return auth;
  const q = speedRuleResolveQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await resolveSpeedRule(auth.tenantId, q.data));
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'resolve' });
  }
}
