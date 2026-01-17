/**
 * JWT Tenant Validator Middleware
 * 
 * Validates that JWT contains tenant_org_id and automatically repairs if missing.
 * This middleware should be used in API routes to ensure tenant context is always present.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  validateJWTTenantContext,
  repairJWTTenantContext,
  type JWTValidationResult,
} from '@/lib/auth/jwt-tenant-manager';
import { logJWTHealthEvent } from '@/lib/monitoring/jwt-health-monitor';
import { logger } from '@/lib/utils/logger';

export interface JWTValidationContext {
  user: any;
  tenantId: string;
  userId: string;
  isValid: boolean;
}

/**
 * Validate JWT tenant context and repair if needed
 * @param request - Next.js request object
 * @returns Validation context or error response
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

    // Validate JWT tenant context
    const validation = await validateJWTTenantContext(user);

    // Log health event
    await logJWTHealthEvent({
      userId: user.id,
      eventType: 'validation',
      tenantId: validation.tenantId || undefined,
      hadTenantContext: validation.isValid,
    });

    if (!validation.isValid) {
      // If repair is possible, attempt it
      if (validation.needsRepair && validation.tenantId) {
        logger.info('Repairing JWT tenant context', {
          feature: 'jwt-tenant-validator',
          action: 'validateJWTWithTenant',
          userId: user.id,
          tenantId: validation.tenantId,
        });

        const repairResult = await repairJWTTenantContext(user.id, validation.tenantId);

        // Log repair event
        await logJWTHealthEvent({
          userId: user.id,
          eventType: 'repair',
          tenantId: validation.tenantId,
          hadTenantContext: false,
          repairAttempted: true,
          repairSuccessful: repairResult.success,
          errorMessage: repairResult.error,
        });

        if (repairResult.success) {
          // Refresh session to get new JWT with tenant context
          const { error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            logger.error('Failed to refresh session after JWT repair', refreshError as Error, {
              feature: 'jwt-tenant-validator',
              action: 'validateJWTWithTenant',
              userId: user.id,
            });
            return NextResponse.json(
              { error: 'Failed to refresh session' },
              { status: 500 }
            );
          }

          // Re-validate after repair
          const { data: { user: refreshedUser } } = await supabase.auth.getUser();
          if (refreshedUser) {
            const revalidation = await validateJWTTenantContext(refreshedUser);
            if (revalidation.isValid && revalidation.tenantId) {
              // Log successful repair
              await logJWTHealthEvent({
                userId: refreshedUser.id,
                eventType: 'validation',
                tenantId: revalidation.tenantId,
                hadTenantContext: true,
              });

              return {
                user: refreshedUser,
                tenantId: revalidation.tenantId,
                userId: refreshedUser.id,
                isValid: true,
              };
            }
          }
        }
      }

      // If repair failed or not possible, reject request
      logger.warn('JWT tenant validation failed', {
        feature: 'jwt-tenant-validator',
        action: 'validateJWTWithTenant',
        userId: user.id,
        error: validation.error,
      });

      return NextResponse.json(
        {
          error: validation.error || 'Invalid tenant context',
          code: 'TENANT_CONTEXT_MISSING',
        },
        { status: 403 }
      );
    }

    // JWT is valid with tenant context
    return {
      user,
      tenantId: validation.tenantId!,
      userId: user.id,
      isValid: true,
    };
  } catch (error) {
    logger.error('Error validating JWT tenant context', error as Error, {
      feature: 'jwt-tenant-validator',
      action: 'validateJWTWithTenant',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Middleware wrapper that validates JWT tenant context
 * Use this in API routes before processing requests
 * 
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

