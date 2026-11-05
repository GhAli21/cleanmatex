import { NextRequest, NextResponse } from 'next/server';

import { speedRulesError, speedRulesFailure, speedRulesOk } from '@/lib/api/speed-rules-http';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { bulkCreateSpeedRules } from '@/lib/services/catalog/speed-rules.service';
import { speedRuleBulkSchema } from '@/lib/validations/speed-rule-schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/catalog/speed-rules/bulk — one product rule per active product of a category (`pricing:bulk`, CSRF).
 * @param request - the rule to copy, with the category
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return speedRulesError(403, 'CSRF_REJECTED');
  const auth = await requirePermission(PRICING_PERMISSIONS.BULK)(request);
  if (auth instanceof NextResponse) return auth;
  const body = speedRuleBulkSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await bulkCreateSpeedRules(auth.tenantId, auth.userId, body.data), 201);
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'bulk' });
  }
}
