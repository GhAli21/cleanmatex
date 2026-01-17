/**
 * Tenant Guard Middleware
 * 
 * Unified guard that combines:
 * - JWT validation (ensures tenant context exists)
 * - Authentication check
 * - Tenant validation
 * - Permission check (optional)
 * 
 * This is the recommended middleware for all protected API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantFromRequest, type TenantValidationContext } from './tenant-validation';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { logger } from '@/lib/utils/logger';

export interface TenantGuardContext extends TenantValidationContext {
  hasPermission: boolean;
}

/**
 * Require tenant authentication and optional permission
 * @param permission - Optional permission code (e.g., 'orders:read')
 * @returns Middleware function
 */
export function requireTenantAuth(permission?: string) {
  return async (request: NextRequest): Promise<TenantGuardContext | NextResponse> => {
    try {
      // 1. Validate JWT and ensure tenant context exists
      const tenantValidation = await validateTenantFromRequest(request);
      
      if (tenantValidation instanceof NextResponse) {
        return tenantValidation; // Unauthorized or invalid tenant
      }

      // 2. Check permission if provided
      if (permission) {
        const hasAccess = await hasPermissionServer(permission);
        
        if (!hasAccess) {
          logger.warn('Permission denied', {
            feature: 'tenant-guard',
            action: 'requireTenantAuth',
            userId: tenantValidation.userId,
            tenantId: tenantValidation.tenantId,
            permission,
          });

          return NextResponse.json(
            { error: `Permission denied: ${permission}`, code: 'PERMISSION_DENIED' },
            { status: 403 }
          );
        }
      }

      return {
        ...tenantValidation,
        hasPermission: true,
      };
    } catch (error) {
      logger.error('Error in tenant guard', error as Error, {
        feature: 'tenant-guard',
        action: 'requireTenantAuth',
        permission,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Require any of the specified permissions
 * @param permissions - Array of permission codes
 * @returns Middleware function
 */
export function requireAnyTenantPermission(permissions: string[]) {
  return async (request: NextRequest): Promise<TenantGuardContext | NextResponse> => {
    try {
      const tenantValidation = await validateTenantFromRequest(request);
      
      if (tenantValidation instanceof NextResponse) {
        return tenantValidation;
      }

      // Check if user has any of the required permissions
      const checks = await Promise.all(
        permissions.map(perm => hasPermissionServer(perm))
      );
      const hasAccess = checks.some(check => check === true);

      if (!hasAccess) {
        return NextResponse.json(
          {
            error: `Permission denied: requires one of [${permissions.join(', ')}]`,
            code: 'PERMISSION_DENIED',
          },
          { status: 403 }
        );
      }

      return {
        ...tenantValidation,
        hasPermission: true,
      };
    } catch (error) {
      logger.error('Error in tenant guard', error as Error, {
        feature: 'tenant-guard',
        action: 'requireAnyTenantPermission',
        permissions,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Require all of the specified permissions
 * @param permissions - Array of permission codes
 * @returns Middleware function
 */
export function requireAllTenantPermissions(permissions: string[]) {
  return async (request: NextRequest): Promise<TenantGuardContext | NextResponse> => {
    try {
      const tenantValidation = await validateTenantFromRequest(request);
      
      if (tenantValidation instanceof NextResponse) {
        return tenantValidation;
      }

      // Check if user has all required permissions
      const checks = await Promise.all(
        permissions.map(perm => hasPermissionServer(perm))
      );
      const hasAccess = checks.every(check => check === true);

      if (!hasAccess) {
        return NextResponse.json(
          {
            error: `Permission denied: requires all of [${permissions.join(', ')}]`,
            code: 'PERMISSION_DENIED',
          },
          { status: 403 }
        );
      }

      return {
        ...tenantValidation,
        hasPermission: true,
      };
    } catch (error) {
      logger.error('Error in tenant guard', error as Error, {
        feature: 'tenant-guard',
        action: 'requireAllTenantPermissions',
        permissions,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrap an API route handler with tenant guard
 * @param handler - Route handler function
 * @param permission - Required permission (optional)
 * @returns Protected route handler
 */
export function withTenantGuard<T extends any[]>(
  handler: (context: TenantGuardContext, request: NextRequest, ...args: T) => Promise<Response>,
  permission?: string
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authCheck = await requireTenantAuth(permission)(request);
    
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied or unauthorized
    }

    return handler(authCheck, request, ...args);
  };
}

