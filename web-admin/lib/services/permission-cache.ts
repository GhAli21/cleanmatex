/**
 * Permission Cache Service (Server-Only)
 * 
 * Server-only functions for Redis cache operations.
 * This file should only be imported dynamically from server-side code.
 * Uses dynamic imports for redis.ts to avoid static analysis issues.
 */

/**
 * Cache key generator for permissions
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns Cache key
 */
export function getPermissionCacheKey(userId: string, tenantId: string): string {
  return `permissions:${userId}:${tenantId}`;
}

/**
 * Get Redis cache instance (dynamic import to avoid static analysis)
 */
async function getCache() {
  const { cache } = await import('@/lib/cache/redis');
  return cache;
}

/**
 * Cache invalidation on permission changes
 * Invalidates Redis cache when permissions change
 * @param userId - User ID
 * @param tenantId - Tenant ID
 */
export async function invalidatePermissionCache(
  userId: string,
  tenantId: string
): Promise<void> {
  try {
    const cache = await getCache();
    const cacheKey = getPermissionCacheKey(userId, tenantId);
    await cache.del(cacheKey);
    
    // Also invalidate workflow roles cache
    const workflowCacheKey = `workflow_roles:${userId}:${tenantId}`;
    await cache.del(workflowCacheKey);
  } catch (error) {
    console.error('Error invalidating permission cache:', error);
    // Don't throw - cache invalidation failure shouldn't break the app
  }
}

/**
 * Invalidate all permission caches for a tenant
 * Useful when role permissions change
 * @param tenantId - Tenant ID
 */
export async function invalidateTenantPermissionCache(tenantId: string): Promise<void> {
  try {
    const cache = await getCache();
    // Delete all permission caches for this tenant
    await cache.delPattern(`permissions:*:${tenantId}`);
    await cache.delPattern(`workflow_roles:*:${tenantId}`);
  } catch (error) {
    console.error('Error invalidating tenant permission cache:', error);
  }
}

/**
 * Get cached permissions for a user
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns Cached permissions or null
 */
export async function getCachedPermissions(
  userId: string,
  tenantId: string
): Promise<string[] | null> {
  try {
    const cache = await getCache();
    const cacheKey = getPermissionCacheKey(userId, tenantId);
    return await cache.get<string[]>(cacheKey);
  } catch (error) {
    console.error('Error getting cached permissions:', error);
    return null;
  }
}

/**
 * Set cached permissions for a user
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @param permissions - Permissions to cache
 * @param ttlSeconds - Time to live in seconds (default: 900)
 */
export async function setCachedPermissions(
  userId: string,
  tenantId: string,
  permissions: string[],
  ttlSeconds: number = 900
): Promise<void> {
  try {
    const cache = await getCache();
    const cacheKey = getPermissionCacheKey(userId, tenantId);
    await cache.set(cacheKey, permissions, ttlSeconds);
  } catch (error) {
    console.error('Error setting cached permissions:', error);
    // Don't throw - cache write failure shouldn't break the app
  }
}

