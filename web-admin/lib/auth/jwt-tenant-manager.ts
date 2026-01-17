/**
 * JWT Tenant Context Manager
 * 
 * Ensures JWT tokens always contain tenant_org_id in user_metadata.
 * Provides utilities to validate, repair, and manage tenant context in JWTs.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface JWTValidationResult {
  isValid: boolean;
  tenantId: string | null;
  needsRepair: boolean;
  error?: string;
}

/**
 * Get tenant ID from user's active tenant in org_users_mst
 * Falls back to most recently accessed tenant
 */
async function getUserActiveTenant(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    // Get user's active tenant (most recently accessed)
    const { data, error } = await supabase
      .from('org_users_mst')
      .select('tenant_org_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_login_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      logger.warn('No active tenant found for user', {
        feature: 'jwt-tenant-manager',
        action: 'getUserActiveTenant',
        userId,
        error: error?.message,
      });
      return null;
    }

    return data.tenant_org_id;
  } catch (error) {
    logger.error('Error getting user active tenant', error as Error, {
      feature: 'jwt-tenant-manager',
      action: 'getUserActiveTenant',
      userId,
    });
    return null;
  }
}

/**
 * Validate JWT contains tenant context
 * @param user - Supabase user object
 * @returns Validation result with tenant ID and repair status
 */
export async function validateJWTTenantContext(user: any): Promise<JWTValidationResult> {
  try {
    if (!user) {
      return {
        isValid: false,
        tenantId: null,
        needsRepair: false,
        error: 'User not authenticated',
      };
    }

    const tenantId = user.user_metadata?.tenant_org_id;

    if (!tenantId) {
      // JWT missing tenant context - needs repair
      logger.warn('JWT missing tenant context', {
        feature: 'jwt-tenant-manager',
        action: 'validateJWTTenantContext',
        userId: user.id,
      });

      // Try to get tenant from database
      const activeTenant = await getUserActiveTenant(user.id);
      
      if (activeTenant) {
        return {
          isValid: false,
          tenantId: activeTenant,
          needsRepair: true,
          error: 'JWT missing tenant context',
        };
      }

      return {
        isValid: false,
        tenantId: null,
        needsRepair: false,
        error: 'No tenant found for user',
      };
    }

    // Validate tenant exists and user has access
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('org_users_mst')
      .select('tenant_org_id, is_active')
      .eq('user_id', user.id)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      logger.warn('JWT tenant context invalid - user does not have access', {
        feature: 'jwt-tenant-manager',
        action: 'validateJWTTenantContext',
        userId: user.id,
        tenantId,
        error: error?.message,
      });

      // Try to get valid tenant
      const activeTenant = await getUserActiveTenant(user.id);
      
      return {
        isValid: false,
        tenantId: activeTenant,
        needsRepair: true,
        error: 'User does not have access to tenant in JWT',
      };
    }

    return {
      isValid: true,
      tenantId,
      needsRepair: false,
    };
  } catch (error) {
    logger.error('Error validating JWT tenant context', error as Error, {
      feature: 'jwt-tenant-manager',
      action: 'validateJWTTenantContext',
    });

    return {
      isValid: false,
      tenantId: null,
      needsRepair: false,
      error: 'Validation error',
    };
  }
}

/**
 * Repair JWT by updating user_metadata with tenant context
 * Uses database function to update via service role for security
 * @param userId - User ID
 * @param tenantId - Tenant ID to set
 * @returns Success status
 */
export async function repairJWTTenantContext(
  userId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Verify we're updating the current user's metadata
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError || !user || user.id !== userId) {
      logger.error('User mismatch when repairing JWT tenant context', getUserError as Error, {
        feature: 'jwt-tenant-manager',
        action: 'repairJWTTenantContext',
        userId,
        tenantId,
        currentUserId: user?.id,
      });

      return {
        success: false,
        error: 'User mismatch or not authenticated',
      };
    }

    // Update user metadata with tenant context
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        tenant_org_id: tenantId,
      },
    });

    if (updateError) {
      logger.error('Failed to repair JWT tenant context', updateError as Error, {
        feature: 'jwt-tenant-manager',
        action: 'repairJWTTenantContext',
        userId,
        tenantId,
        error: updateError.message,
      });

      return {
        success: false,
        error: updateError.message,
      };
    }

    logger.info('JWT tenant context repaired', {
      feature: 'jwt-tenant-manager',
      action: 'repairJWTTenantContext',
      userId,
      tenantId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error repairing JWT tenant context', error as Error, {
      feature: 'jwt-tenant-manager',
      action: 'repairJWTTenantContext',
      userId,
      tenantId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Repair failed',
    };
  }
}

/**
 * Ensure tenant context is set in user metadata
 * This should be called after login or tenant switch
 * @param userId - User ID
 * @param tenantId - Tenant ID to ensure is set
 */
export async function ensureTenantInUserMetadata(
  userId: string,
  tenantId: string
): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError || !user || user.id !== userId) {
      throw new Error('User mismatch or not authenticated');
    }

    // Check if tenant already set
    if (user.user_metadata?.tenant_org_id === tenantId) {
      return; // Already set correctly
    }

    // Update user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        tenant_org_id: tenantId,
      },
    });

    if (updateError) {
      throw updateError;
    }

    logger.info('Tenant context ensured in user metadata', {
      feature: 'jwt-tenant-manager',
      action: 'ensureTenantInUserMetadata',
      userId,
      tenantId,
    });
  } catch (error) {
    logger.error('Error ensuring tenant in user metadata', error as Error, {
      feature: 'jwt-tenant-manager',
      action: 'ensureTenantInUserMetadata',
      userId,
      tenantId,
    });
    throw error;
  }
}

