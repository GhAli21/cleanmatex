import { NextRequest, NextResponse } from 'next/server';

import { speedRulesError, speedRulesFailure, speedRulesOk } from '@/lib/api/speed-rules-http';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { setProductRulesActive } from '@/lib/services/catalog/speed-rules.service';
import { speedRuleBulkStatusSchema } from '@/lib/validations/speed-rule-schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/catalog/speed-rules/bulk-status — retires or restores the product
 * rules of a speed, optionally for one category (`pricing:bulk`). `dryRun` only counts.
 * @param request - the speed, the category, the new status and `dryRun`
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return speedRulesError(403, 'CSRF_REJECTED');
  // Tenant and user are resolved server-side from the authenticated session.
  const auth = await requirePermission(PRICING_PERMISSIONS.BULK)(request);
  if (auth instanceof NextResponse) return auth;
  const body = speedRuleBulkStatusSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return speedRulesError(400, 'VALIDATION_FAILED');
  try {
    return speedRulesOk(await setProductRulesActive(auth.tenantId, auth.userId, body.data));
  } catch (error) {
    return speedRulesFailure(error, { tenantId: auth.tenantId, action: 'bulk_status' });
  }
}
