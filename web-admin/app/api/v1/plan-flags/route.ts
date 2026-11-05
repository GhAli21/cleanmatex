/**
 * GET /api/v1/plan-flags
 * Returns plan-bound feature flags for the current tenant (bundles, repeat last order, smart suggestions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator';
import { getPlanFlags } from '@/lib/services/plan-flags.service';

export const dynamic = 'force-dynamic';

/**
 * Plan flags are read by every order screen, so only the session is checked.
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await validateJWTWithTenant(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const flags = await getPlanFlags(auth.tenantId);
    return NextResponse.json(flags);
  } catch (error) {
    console.error('[API] GET /api/v1/plan-flags error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
