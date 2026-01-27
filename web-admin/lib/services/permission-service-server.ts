/**
 * Permission Service - Server-Only Functions
 *
 * Server-side permission checking with Redis cache
 * MUST only be imported in server components or API routes
 */

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getCachedPermissions, setCachedPermissions, invalidatePermissionCache, invalidateTenantPermissionCache } from '@/lib/services/permission-cache';
import { logger } from '@/lib/utils/logger';

// Re-export types from client version
export type { Permission, PermissionCheckOptions } from './permission-service-client';

interface Permission {
  permission_code: string;
  resource_type: string | null;
  resource_id: string | null;
}

interface PermissionCheckOptions {
  resourceType?: string;
  resourceId?: string;
}

/**
 * Get all permissions for current user (server-side)
 * Uses Redis cache with 15-minute TTL
 * @param userId - User ID (required for caching)
 * @param tenantId - Tenant ID (required for caching)
 * @returns Array of permission codes
 */
export async function getUserPermissionsServer(
  userId?: string,
  tenantId?: string
): Promise<string[]> {
  // Try cache first if userId and tenantId provided
  if (userId && tenantId) {
    try {
      const cached = await getCachedPermissions(userId, tenantId);

      if (cached) {
        return cached;
      }
    } catch (cacheError) {
      // Cache not available, continue to database lookup
      logger.warn('Permission cache unavailable (read), falling back to DB', {
        feature: 'permissions',
        action: 'get_user_permissions',
        tenantId,
        userId,
      });
    }
  }

  const client = await createClient();

  try {
    const { data, error } = await client.rpc('get_user_permissions');

    if (error) {
      logger.error('Error fetching user permissions', new Error(error.message), {
        feature: 'permissions',
        action: 'get_user_permissions',
        tenantId,
        userId,
      });
      return [];
    }

    const permissions = (data || []).map((p: Permission) => p.permission_code);

    // Cache permissions for 15 minutes (900 seconds)
    if (userId && tenantId) {
      try {
        await setCachedPermissions(userId, tenantId, permissions, 900);
      } catch (cacheError) {
        // Cache not available, continue without caching
        logger.warn('Permission cache unavailable (write)', {
          feature: 'permissions',
          action: 'get_user_permissions',
          tenantId,
          userId,
        });
      }
    }

    return permissions;
  } catch (error) {
    logger.error(
      'Error in getUserPermissionsServer',
      error instanceof Error ? error : new Error('Unknown error'),
      {
        feature: 'permissions',
        action: 'get_user_permissions',
        tenantId,
        userId,
      }
    );
    return [];
  }
}

/**
 * Check if user has specific permission (server-side)
 * @param permission - Permission code
 * @param options - Optional resource type and ID
 * @returns True if user has permission
 */
export async function hasPermissionServer(
  permission: string,
  options?: PermissionCheckOptions
): Promise<boolean> {
  const client = await createClient();

  try {
    if (options?.resourceType && options?.resourceId) {
      const { data, error } = await client.rpc('has_resource_permission', {
        p_permission: permission,
        p_resource_type: options.resourceType,
        p_resource_id: options.resourceId,
      });

      if (error) {
        logger.error('Error checking resource permission', new Error(error.message), {
          feature: 'permissions',
          action: 'has_resource_permission',
          permission,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
        });
        return false;
      }
      return data === true;
    } else {
      logger.info('Jh65 hasPermissionServer(): has_permission', {
        feature: 'permissions',
        action: 'has_permission',
        message: 'hasPermissionServer(permission: ' + permission + ')',
      });
      const { data, error } = await client.rpc('has_permission', {
        p_permission: permission,
      });
      logger.info('Jh66 hasPermissionServer(): has_permission', {
        feature: 'permissions',
        action: 'has_permission',
        message: 'hasPermissionServer(permission: ' + permission + '): data: ' + data + ' error: ' + error,
      });
      if (error) {
        logger.error('Error checking permission', new Error(error.message), {
          feature: 'permissions',
          action: 'has_permission',
          permission,
        });
        return false;
      }

      return data === true;
    }
  } catch (error) {
    logger.error(
      'Error in hasPermissionServer',
      error instanceof Error ? error : new Error('Unknown error'),
      {
        feature: 'permissions',
        action: 'has_permission',
        permission,
        hasResource: !!(options?.resourceType && options?.resourceId),
      }
    );
    return false;
  }
}

/**
 * Rebuild effective permissions for a user
 * Called automatically on role/permission changes, but can be triggered manually
 * @param userId - User ID
 * @param tenantId - Tenant ID
 */
export async function rebuildUserPermissions(
  userId: string,
  tenantId: string
): Promise<void> {
  const client = await createClient();

  try {
    const { error } = await client.rpc('cmx_rebuild_user_permissions', {
      p_user_id: userId,
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('Error rebuilding user permissions:', error);
      throw new Error('Failed to rebuild user permissions');
    }
  } catch (error) {
    console.error('Error in rebuildUserPermissions:', error);
    throw error;
  }
}

// Re-export cache functions
export { invalidatePermissionCache, invalidateTenantPermissionCache };
