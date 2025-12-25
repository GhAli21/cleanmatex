/**
 * Permission Service - Server-Only Functions
 *
 * Server-side permission checking with Redis cache
 * MUST only be imported in server components or API routes
 */

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getCachedPermissions, setCachedPermissions, invalidatePermissionCache, invalidateTenantPermissionCache } from '@/lib/services/permission-cache';

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
      console.warn('Cache not available, falling back to database:', cacheError);
    }
  }

  const client = await createClient();

  try {
    const { data, error } = await client.rpc('get_user_permissions');

    if (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }

    const permissions = (data || []).map((p: Permission) => p.permission_code);

    // Cache permissions for 15 minutes (900 seconds)
    if (userId && tenantId) {
      try {
        await setCachedPermissions(userId, tenantId, permissions, 900);
      } catch (cacheError) {
        // Cache not available, continue without caching
        console.warn('Cache not available for write:', cacheError);
      }
    }

    return permissions;
  } catch (error) {
    console.error('Error in getUserPermissionsServer:', error);
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
    console.log('[Jh] hasPermissionServer ( 1 ): Permission:', permission)
    console.log('[Jh] hasPermissionServer ( 2 ): Options:', options)
    console.log('[Jh] hasPermissionServer ( 3 ): Test check_jwt_claims_jh() ')
    const { data, error } = await client.rpc('check_jwt_claims_jh');
    console.log('[Jh] hasPermissionServer check_jwt_claims_jh()( 3 ): Data:', data)
    if (error) {
      console.log('[Jh] hasPermissionServer ( 3.1 ): Error:', error)
      console.error('Error checking permission check_jwt_claims_jh():', error);
      return false;
    }
    console.log('[Jh] hasPermissionServer check_jwt_claims_jh() ( 4 ): Data:', data)
    console.log('[Jh] hasPermissionServer check_jwt_claims_jh() ( 5 ): Returning true for testing')
    return true; // true for testing Jhtest_TODO: Remove this

    if (options?.resourceType && options?.resourceId) {
      const { data, error } = await client.rpc('has_resource_permission', {
        p_permission: permission,
        p_resource_type: options.resourceType,
        p_resource_id: options.resourceId,
      });

      if (error) {
        console.log('[Jh] hasPermissionServer ( 3 ): Error:', error)
        console.error('Error checking resource permission:', error);
        return false;
      }
      console.log('[Jh] hasPermissionServer ( 4 ): Data:', data)
      return data === true;
    } else {
      console.log('[Jh] hasPermissionServer ( 5 ): Permission:', permission)
      console.log('[Jh] hasPermissionServer ( 6 ): Before call rpc has_permission')
      const { data, error } = await client.rpc('has_permission', {
        p_permission: permission,
      });

      if (error) {
        console.log('[Jh] hasPermissionServer ( 7 ): Error:', error)
        console.error('Error checking permission:', error);
        return false;
      }
      console.log('[Jh] hasPermissionServer ( 8 ): Data:', data)
      return data === true;
    }
  } catch (error) {
    console.log('[Jh] hasPermissionServer ( 9 ): Error:', error)
    console.error('Error in hasPermissionServer:', error);
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
