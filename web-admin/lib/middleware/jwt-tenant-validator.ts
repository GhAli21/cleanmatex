/**
 * Tenant-aware request validator for API routes (used by requirePermission).
 *
 * Authenticates the caller, validates that their session is still alive on the server (membership,
 * absolute expiry, idle timeout — fn_auth_session_validate) and returns the tenant the session is bound to.
 * The tenant comes from the database, never from user_metadata, so there is nothing to "repair" any more.
 * Fail closed: if the session cannot be validated the request is rejected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { guardSession, isSessionActive, sessionEndedResponse } from '@/lib/auth/session-guard';
import { readRequestMeta } from '@/lib/services/auth/session/request-meta';
import { DEVICE_COOKIE_NAME } from '@/lib/constants/auth-session';
import { logger } from '@/lib/utils/logger';

/**
 * Authenticated, tenant-resolved request context.
 */
export interface JWTValidationContext {
  user: any;
  tenantId: string;
  userId: string;
  isValid: boolean;
}

/**
 * Authenticate the caller and resolve their tenant from the validated session.
 *
 * @param request - Next.js request object
 * @returns Validation context, or an error response (401 unauthenticated / SESSION_ENDED, 503 on infra failure)
 */
export async function validateJWTWithTenant(
  request: NextRequest
): Promise<JWTValidationContext | NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized request - no user', {
        feature: 'jwt-tenant-validator',
        action: 'validateJWTWithTenant',
        error: authError?.message,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validation = await guardSession(
      supabase,
      readRequestMeta(request.headers, request.cookies.get(DEVICE_COOKIE_NAME)?.value)
    );

    if (!isSessionActive(validation) || !validation.tenantOrgId) {
      logger.warn('Session not active', {
        feature: 'jwt-tenant-validator',
        action: 'validateJWTWithTenant',
        userId: user.id,
        state: validation.state,
        reason: validation.endReason,
      });
      return sessionEndedResponse(validation);
    }

    return {
      user,
      tenantId: validation.tenantOrgId,
      userId: user.id,
      isValid: true,
    };
  } catch (error) {
    // Fail closed: an unvalidated session must not be let through.
    logger.error('Error validating session', error as Error, {
      feature: 'jwt-tenant-validator',
      action: 'validateJWTWithTenant',
    });

    return NextResponse.json(
      { error: 'Session validation unavailable', code: 'SESSION_VALIDATION_UNAVAILABLE' },
      { status: 503 }
    );
  }
}

/**
 * Middleware wrapper that validates the session and resolves the tenant.
 * Use this in API routes before processing requests.
 *
 * @param handler
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const jwtValidation = await validateJWTWithTenant(request);
 *   if (jwtValidation instanceof NextResponse) return jwtValidation;
 *
 *   const { tenantId, userId } = jwtValidation;
 *   // Proceed with tenant-scoped operations
 * }
 * ```
 */
export function withJWTTenantValidation<T>(
  handler: (context: JWTValidationContext, request: NextRequest) => Promise<T>
) {
  return async (request: NextRequest): Promise<T | NextResponse> => {
    const validation = await validateJWTWithTenant(request);

    if (validation instanceof NextResponse) {
      return validation;
    }

    return handler(validation, request);
  };
}
