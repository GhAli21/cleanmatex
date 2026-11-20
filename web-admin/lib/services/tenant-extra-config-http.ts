/**
 * Shared HTTP guards and error mapping for `/api/v1/settings/extra-config/**`.
 * Follows `org-ui-theme-http.ts`: CSRF + RBAC permission + tenant rate limit.
 *
 * @module lib/services/tenant-extra-config-http
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator';
import { validateCSRF } from '@/lib/middleware/csrf';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import {
  ExtraConfigError,
  extraConfigErrorStatus,
  type ExtraConfigActor,
} from '@/lib/services/tenant-extra-config.service';
import { logger } from '@/lib/utils/logger';

/**
 * Validate active authenticated tenant session for read-only access to Extra Config.
 * Allows Operators and Viewers without `settings:read` to inspect the screen in read-only mode
 * (mutations still strictly require `settings:update` via `guardExtraConfigWrite`).
 */
export async function guardExtraConfigRead(
  request: NextRequest
): Promise<{ tenantId: string; userId: string } | NextResponse> {
  const auth = await validateJWTWithTenant(request);
  if (auth instanceof NextResponse) return auth;
  return { tenantId: auth.tenantId, userId: auth.userId };
}

/**
 * Validate CSRF, `settings:update` permission, and tenant rate limit for mutations.
 */
export async function guardExtraConfigWrite(
  request: NextRequest
): Promise<{ tenantId: string; actor: ExtraConfigActor } | NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;
  const auth = await requirePermission('settings:update')(request);
  if (auth instanceof NextResponse) return auth;
  const limited = await checkAPIRateLimitTenant(auth.tenantId);
  if (limited) return limited;

  return {
    tenantId: auth.tenantId,
    actor: {
      userId: auth.userId,
      userInfo: request.headers.get('user-agent') ?? undefined,
    },
  };
}

/** Revalidate root layout RSC tree after extra-config changes. */
export function revalidateExtraConfigLayout(): void {
  revalidatePath('/', 'layout');
}

/** Map thrown error into structured JSON HTTP response. */
export function extraConfigErrorResponse(err: unknown, contextLabel: string): NextResponse {
  if (err instanceof ExtraConfigError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        ...(err.configKey ? { configKey: err.configKey } : {}),
      },
      { status: extraConfigErrorStatus[err.code] }
    );
  }
  logger.error(
    `${contextLabel} failed`,
    err instanceof Error ? err : new Error(String(err)),
    {}
  );
  return NextResponse.json(
    { error: 'Failed to process extra configuration request' },
    { status: 500 }
  );
}
