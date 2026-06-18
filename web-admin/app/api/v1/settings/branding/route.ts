/**
 * Settings → Branding API
 *
 *   GET  /api/v1/settings/branding — load logo URL + brand colors
 *   PUT  /api/v1/settings/branding — replace logo URL + brand colors
 *
 * Logo URLs are host-validated to prevent the Branding form from being used
 * to point a tenant's logo at an attacker-controlled image (e.g. an SVG with
 * inline script). Acceptable URLs must live under the public storage host
 * declared by `NEXT_PUBLIC_STORAGE_URL` and use the
 * `tenants/{tenantId}/logo/...` key pattern produced by `uploadTenantLogo`.
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
import { deleteTenantLogo } from '@/lib/storage/tenant-logo';

const HEX = /^#[0-9A-Fa-f]{6}$/;

const brandingInputSchema = z.object({
  logo: z.string().max(2048).default(''),
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

    if (parsed.data.logo && !isAllowedLogoUrl(parsed.data.logo, tenantId)) {
      return NextResponse.json(
        {
          error: 'Logo URL is not allowed',
          fieldErrors: { logo: 'Logo URL must be hosted on the configured storage host' },
        },
        { status: 400 }
      );
    }

    const userInfo = request.headers.get('user-agent') ?? undefined;

    try {
      const { branding, previousLogoUrl } = await updateTenantBranding(
        tenantId,
        parsed.data,
        { userId, userInfo }
      );

      // Best-effort cleanup of the replaced logo. Failures are logged but
      // do not fail the request — the new logo is already persisted.
      if (previousLogoUrl) {
        try {
          await deleteTenantLogo(previousLogoUrl);
        } catch (cleanupErr) {
          logger.error(
            'settings/branding: previous logo cleanup failed',
            cleanupErr instanceof Error ? cleanupErr : new Error(String(cleanupErr)),
            { tenantId, previousLogoUrl }
          );
        }
      }

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

/**
 * Accept only logos that came from our own storage host AND are scoped to
 * this tenant's logo key prefix. Defends against arbitrary-URL XSS via the
 * Branding form (e.g. inline-script SVG hosted on attacker domain).
 * @param url
 * @param tenantOrgId
 */
function isAllowedLogoUrl(url: string, tenantOrgId: string): boolean {
  try {
    const u = new URL(url);
    const publicBase = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:9000';
    const allowed = new URL(publicBase);
    if (u.host !== allowed.host) return false;
    if (u.protocol !== allowed.protocol) return false;
    // Path must contain the tenant-scoped logo key pattern.
    const needle = `/tenants/${tenantOrgId}/logo/`;
    return u.pathname.includes(needle);
  } catch {
    return false;
  }
}

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
