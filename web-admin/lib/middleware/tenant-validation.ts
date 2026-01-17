/**
 * Tenant Validation Middleware
 * 
 * Validates tenant context from JWT and ensures user has access to the tenant.
 * Uses JWT tenant validator to ensure tenant context exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateJWTWithTenant, type JWTValidationContext } from './jwt-tenant-validator';
import { logger } from '@/lib/utils/logger';

export interface TenantValidationContext extends JWTValidationContext {
  tenantActive: boolean;
  tenantName?: string;
}

/**
 * Validate tenant access for a user
 * @param tenantId - Tenant ID to validate
 * @param userId - User ID
 * @returns True if user has access to tenant
 */
async function validateTenantAccess(
  tenantId: string,
  userId: string
): Promise<{ valid: boolean; tenantActive?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Check if user has access to tenant
    const { data, error } = await supabase
      .from('org_users_mst')
      .select('tenant_org_id, is_active, tenant:org_tenants_mst(id, name, is_active)')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return {
        valid: false,
        error: 'User does not have access to this tenant',
      };
    }

    // Check if tenant is active
    const tenant = data.tenant as any;
    if (!tenant || !tenant.is_active) {
      return {
        valid: false,
        tenantActive: false,
        error: 'Tenant is not active',
      };
    }

    return {
      valid: true,
      tenantActive: true,
    };
  } catch (error) {
    logger.error('Error validating tenant access', error as Error, {
      feature: 'tenant-validation',
      action: 'validateTenantAccess',
      tenantId,
      userId,
    });

    return {
      valid: false,
      error: 'Validation error',
    };
  }
}

/**
 * Validate tenant context from request
 * Combines JWT validation with tenant access validation
 * @param request - Next.js request object
 * @returns Validation context or error response
 */
export async function validateTenantFromRequest(
  request: NextRequest
): Promise<TenantValidationContext | NextResponse> {
  try {
    // First validate JWT has tenant context
    const jwtValidation = await validateJWTWithTenant(request);

    if (jwtValidation instanceof NextResponse) {
      return jwtValidation;
    }

    // Then validate user has access to tenant
    const tenantAccess = await validateTenantAccess(
      jwtValidation.tenantId,
      jwtValidation.userId
    );

    if (!tenantAccess.valid) {
      logger.warn('Tenant access validation failed', {
        feature: 'tenant-validation',
        action: 'validateTenantFromRequest',
        userId: jwtValidation.userId,
        tenantId: jwtValidation.tenantId,
        error: tenantAccess.error,
      });

      return NextResponse.json(
        {
          error: tenantAccess.error || 'Invalid tenant access',
          code: 'TENANT_ACCESS_DENIED',
        },
        { status: 403 }
      );
    }

    // Get tenant name for context
    const supabase = await createClient();
    const { data: tenantData } = await supabase
      .from('org_tenants_mst')
      .select('name')
      .eq('id', jwtValidation.tenantId)
      .single();

    return {
      ...jwtValidation,
      tenantActive: tenantAccess.tenantActive || true,
      tenantName: tenantData?.name,
    };
  } catch (error) {
    logger.error('Error validating tenant from request', error as Error, {
      feature: 'tenant-validation',
      action: 'validateTenantFromRequest',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Middleware wrapper that validates tenant context
 * Use this in API routes before processing requests
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const tenantValidation = await validateTenantFromRequest(request);
 *   if (tenantValidation instanceof NextResponse) return tenantValidation;
 *   
 *   const { tenantId, userId } = tenantValidation;
 *   // Proceed with tenant-scoped operations
 * }
 * ```
 */
export function withTenantValidation<T>(
  handler: (context: TenantValidationContext, request: NextRequest) => Promise<T>
) {
  return async (request: NextRequest): Promise<T | NextResponse> => {
    const validation = await validateTenantFromRequest(request);
    
    if (validation instanceof NextResponse) {
      return validation;
    }

    return handler(validation, request);
  };
}

