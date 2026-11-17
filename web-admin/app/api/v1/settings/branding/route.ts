/**
 * Settings → Branding API
 *
 *   GET  /api/v1/settings/branding — load logo URL + brand colors
 *   PUT  /api/v1/settings/branding — replace brand colors
 *
 * The logo is uploaded through File Util (category TENANT_LOGO), which publishes
 * `org_tenants_mst.logo_url` itself. This route never accepts a logo URL, so a
 * client cannot point the logo at an outside image; a `logo` field in the body is ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { validateCSRF } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';
import {
  getTenantProfile,
  updateTenantBranding,
  TenantProfileError,
} from '@/lib/services/tenant-profile.service';

const HEX = /^#[0-9A-Fa-f]{6}$/;

const brandingInputSchema = z.object({
  primaryColor: z.string().regex(HEX, 'primaryColor must be #RRGGBB'),
  secondaryColor: z.string().regex(HEX, 'secondaryColor must be #RRGGBB'),
  accentColor: z.string().regex(HEX, 'accentColor must be #RRGGBB'),
});

// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('settings:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { branding } = await getTenantProfile(tenantId);
    return NextResponse.json({ success: true, data: branding });
  } catch (err) {
    logger.error(
      'GET /settings/branding failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json(
      { error: 'Failed to load branding settings' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------

/**
 *
 * @param request
 */
export async function PUT(request: NextRequest) {
  try {
    const csrfResponse = await validateCSRF(request);
    if (csrfResponse) return csrfResponse;

    const authCheck = await requirePermission('settings:branding')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId } = authCheck;

    const rl = await checkAPIRateLimitTenant(tenantId);
    if (rl) return rl;

    const raw = await request.json();
    const parsed = brandingInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: flattenZod(parsed.error) },
        { status: 400 }
      );
    }

    const userInfo = request.headers.get('user-agent') ?? undefined;

    try {
      const { branding } = await updateTenantBranding(
        tenantId,
        parsed.data,
        { userId, userInfo }
      );

      revalidatePath('/dashboard/settings/branding');
      revalidatePath('/dashboard'); // header/shell renders the logo
      return NextResponse.json({ success: true, data: branding });
    } catch (err) {
      if (err instanceof TenantProfileError) {
        return mapDomainError(err);
      }
      throw err;
    }
  } catch (err) {
    logger.error(
      'PUT /settings/branding failed',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return NextResponse.json(
      { error: 'Failed to update branding settings' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------

function flattenZod(zodErr: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of zodErr.issues) {
    const path = issue.path.join('.') || '_root';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

function mapDomainError(err: TenantProfileError): NextResponse {
  if (err.code === 'NOT_FOUND') {
    return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
  }
  return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
}
