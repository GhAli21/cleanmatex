/**
 * Shared guard and error mapping for the saved-theme write routes
 * (/api/v1/settings/branding/themes/**): settings:branding + CSRF + rate limit,
 * tenant and user from the session only.
 * @module lib/services/org-ui-theme-http
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import { UiThemeError, uiThemeErrorStatus, type ThemeActor } from '@/lib/services/org-ui-theme.service';
import { logger } from '@/lib/utils/logger';

/**
 * Check CSRF, permission and rate limit for a theme write.
 * @param request - Incoming request
 * @returns The session tenant and actor, or the refusal response
 */
export async function guardThemeWrite(request: NextRequest): Promise<{ tenantId: string; actor: ThemeActor } | NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;
  const auth = await requirePermission('settings:branding')(request);
  if (auth instanceof NextResponse) return auth;
  const limited = await checkAPIRateLimitTenant(auth.tenantId);
  if (limited) return limited;
  return { tenantId: auth.tenantId, actor: { userId: auth.userId, userInfo: request.headers.get('user-agent') ?? undefined } };
}

/** Path id of a saved theme. */
export const themeIdSchema = z.string().uuid();

/** First message per field, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    out[key] ??= issue.message;
  }
  return out;
}

/** Refresh pages that render the theme (the layout reads it on the next request). */
export function revalidateTheme(): void {
  revalidatePath('/', 'layout');
}

/**
 * Map a thrown error to a response: UiThemeError keeps its code, anything else is 500.
 * @param err - Thrown value
 * @param what - Route label for the log
 * @returns The error response
 */
export function themeErrorResponse(err: unknown, what: string): NextResponse {
  if (err instanceof UiThemeError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: uiThemeErrorStatus[err.code] });
  }
  logger.error(`${what} failed`, err instanceof Error ? err : new Error(String(err)), {});
  return NextResponse.json({ error: 'Failed to save the theme' }, { status: 500 });
}
