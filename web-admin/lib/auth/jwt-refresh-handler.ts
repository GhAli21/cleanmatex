/**
 * JWT Refresh Handler
 * 
 * Handles JWT refresh events to ensure tenant context is preserved.
 * Intercepts refresh requests and validates tenant context is maintained.
 */

import { createClient } from '@/lib/supabase/server';
import {
  validateJWTTenantContext,
  ensureTenantInUserMetadata,
} from '@/lib/auth/jwt-tenant-manager';
import { logger } from '@/lib/utils/logger';

/**
 * Handle JWT refresh with tenant context preservation
 * Should be called before refreshing session to ensure tenant is in metadata
 * @param userId - User ID
 * @returns Success status
 */
export async function handleJWTRefreshWithTenant(
  userId: string
): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();

    if (getUserError || !user || user.id !== userId) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Validate current JWT tenant context
    const validation = await validateJWTTenantContext(user);

    if (validation.isValid && validation.tenantId) {
      // Tenant context exists - ensure it's in metadata before refresh
      await ensureTenantInUserMetadata(userId, validation.tenantId);
      
      return {
        success: true,
        tenantId: validation.tenantId,
      };
    }

    // Tenant context missing - try to repair
    if (validation.needsRepair && validation.tenantId) {
      await ensureTenantInUserMetadata(userId, validation.tenantId);
      
      return {
        success: true,
        tenantId: validation.tenantId,
      };
    }

    logger.warn('Cannot refresh JWT - no tenant context available', {
      feature: 'jwt-refresh-handler',
      action: 'handleJWTRefreshWithTenant',
      userId,
    });

    return {
      success: false,
      error: 'No tenant context available',
    };
  } catch (error) {
    logger.error('Error handling JWT refresh with tenant', error as Error, {
      feature: 'jwt-refresh-handler',
      action: 'handleJWTRefreshWithTenant',
      userId,
    });

    return {
      success: false,
      error: 'Refresh handler error',
    };
  }
}

/**
 * Refresh session and verify tenant context is preserved
 * @param userId - User ID
 * @returns Refresh result with tenant ID
 */
export async function refreshSessionWithTenantVerification(
  userId: string
): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  try {
    // Ensure tenant is in metadata before refresh
    const preRefresh = await handleJWTRefreshWithTenant(userId);
    
    if (!preRefresh.success) {
      return preRefresh;
    }

    const supabase = await createClient();
    
    // Refresh session
    const { data, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      logger.error('Failed to refresh session', refreshError as Error, {
        feature: 'jwt-refresh-handler',
        action: 'refreshSessionWithTenantVerification',
        userId,
      });

      return {
        success: false,
        error: refreshError.message,
      };
    }

    // Verify tenant context is preserved
    if (data.session?.user) {
      const postRefresh = await validateJWTTenantContext(data.session.user);

      if (postRefresh.isValid && postRefresh.tenantId) {
        logger.info('Session refreshed with tenant context preserved', {
          feature: 'jwt-refresh-handler',
          action: 'refreshSessionWithTenantVerification',
          userId,
          tenantId: postRefresh.tenantId,
        });

        return {
          success: true,
          tenantId: postRefresh.tenantId,
        };
      }

      // Tenant context lost during refresh - this should not happen
      logger.error('Tenant context lost during refresh', new Error('Tenant context missing'), {
        feature: 'jwt-refresh-handler',
        action: 'refreshSessionWithTenantVerification',
        userId,
        expectedTenantId: preRefresh.tenantId,
      });

      return {
        success: false,
        error: 'Tenant context lost during refresh',
      };
    }

    return {
      success: false,
      error: 'No session after refresh',
    };
  } catch (error) {
    logger.error('Error refreshing session with tenant verification', error as Error, {
      feature: 'jwt-refresh-handler',
      action: 'refreshSessionWithTenantVerification',
      userId,
    });

    return {
      success: false,
      error: 'Refresh verification error',
    };
  }
}

