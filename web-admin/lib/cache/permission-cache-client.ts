'use client'

/**
 * Client-Side Permission and Feature Flag Cache
 * 
 * Provides localStorage-based caching for permissions and feature flags
 * with TTL (Time To Live) support and automatic invalidation
 */

const PERMISSION_CACHE_KEY = 'permissions_cache'
const FEATURE_FLAG_CACHE_KEY = 'feature_flags_cache'
const NAVIGATION_CACHE_KEY = 'navigation_cache'
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

interface CachedData<T> {
  data: T
  timestamp: number
  tenantId: string
}

// ========================
// Permission Cache
// ========================

/**
 * Get cached permissions for a tenant
 * @param tenantId - Tenant ID
 * @returns Cached permissions or null if not found/invalid
 */
export function getCachedPermissions(tenantId: string): string[] | null {
  try {
    const cached = localStorage.getItem(PERMISSION_CACHE_KEY)
    if (!cached) return null

    const { data, timestamp, tenantId: cachedTenantId }: CachedData<string[]> = JSON.parse(cached)
    
    // Check if cache is valid
    if (cachedTenantId !== tenantId) return null
    if (Date.now() - timestamp > CACHE_TTL) {
      // Cache expired, remove it
      localStorage.removeItem(PERMISSION_CACHE_KEY)
      return null
    }

    return data
  } catch (error) {
    console.warn('Failed to read permission cache:', error)
    return null
  }
}

/**
 * Cache permissions for a tenant
 * @param tenantId - Tenant ID
 * @param permissions - Permissions to cache
 */
export function setCachedPermissions(tenantId: string, permissions: string[]): void {
  try {
    const cached: CachedData<string[]> = {
      data: permissions,
      timestamp: Date.now(),
      tenantId,
    }
    localStorage.setItem(PERMISSION_CACHE_KEY, JSON.stringify(cached))
  } catch (error) {
    console.warn('Failed to cache permissions:', error)
    // localStorage might be full or disabled, continue without caching
  }
}

// ========================
// Feature Flag Cache
// ========================

/**
 * Get cached feature flags for a tenant
 * @param tenantId - Tenant ID
 * @returns Cached feature flags or null if not found/invalid
 */
export function getCachedFeatureFlags(tenantId: string): Record<string, boolean> | null {
  try {
    const cached = localStorage.getItem(FEATURE_FLAG_CACHE_KEY)
    if (!cached) return null

    const { data, timestamp, tenantId: cachedTenantId }: CachedData<Record<string, boolean>> = JSON.parse(cached)
    
    // Check if cache is valid
    if (cachedTenantId !== tenantId) return null
    if (Date.now() - timestamp > CACHE_TTL) {
      // Cache expired, remove it
      localStorage.removeItem(FEATURE_FLAG_CACHE_KEY)
      return null
    }

    return data
  } catch (error) {
    console.warn('Failed to read feature flag cache:', error)
    return null
  }
}

/**
 * Cache feature flags for a tenant
 * @param tenantId - Tenant ID
 * @param flags - Feature flags to cache
 */
export function setCachedFeatureFlags(tenantId: string, flags: Record<string, boolean>): void {
  try {
    const cached: CachedData<Record<string, boolean>> = {
      data: flags,
      timestamp: Date.now(),
      tenantId,
    }
    localStorage.setItem(FEATURE_FLAG_CACHE_KEY, JSON.stringify(cached))
  } catch (error) {
    console.warn('Failed to cache feature flags:', error)
    // localStorage might be full or disabled, continue without caching
  }
}

// ========================
// Navigation Cache
// ========================

interface NavigationCacheData {
  data: any[]
  timestamp: number
  permissionsHash: string
}

/**
 * Get cached navigation for a permissions hash
 * @param permissionsHash - Hash of user permissions (for cache key)
 * @returns Cached navigation or null if not found/invalid
 */
export function getCachedNavigation(permissionsHash: string): any[] | null {
  try {
    const cached = localStorage.getItem(NAVIGATION_CACHE_KEY)
    if (!cached) return null

    const { data, timestamp, permissionsHash: cachedHash }: NavigationCacheData = JSON.parse(cached)
    
    // Check if cache is valid
    if (cachedHash !== permissionsHash) return null
    if (Date.now() - timestamp > CACHE_TTL) {
      // Cache expired, remove it
      localStorage.removeItem(NAVIGATION_CACHE_KEY)
      return null
    }

    return data
  } catch (error) {
    console.warn('Failed to read navigation cache:', error)
    return null
  }
}

/**
 * Cache navigation
 * @param permissionsHash - Hash of user permissions (for cache key)
 * @param navigation - Navigation sections to cache
 */
export function setCachedNavigation(permissionsHash: string, navigation: any[]): void {
  try {
    const cached: NavigationCacheData = {
      data: navigation,
      timestamp: Date.now(),
      permissionsHash,
    }
    localStorage.setItem(NAVIGATION_CACHE_KEY, JSON.stringify(cached))
  } catch (error) {
    console.warn('Failed to cache navigation:', error)
  }
}

/**
 * Invalidate navigation cache
 */
export function invalidateNavigationCache(): void {
  try {
    localStorage.removeItem(NAVIGATION_CACHE_KEY)
  } catch (error) {
    console.warn('Failed to invalidate navigation cache:', error)
  }
}

/**
 * Generate hash from permissions array for cache key
 * @param permissions - Array of permission codes
 * @returns Hash string
 */
export function hashPermissions(permissions: string[]): string {
  // Simple hash function - sort and join
  // For production, consider using a proper hash function
  return permissions.sort().join(',')
}

// ========================
// Cache Invalidation
// ========================

/**
 * Invalidate all permission and feature flag caches
 * Useful when user logs out or switches tenant
 */
export function invalidatePermissionCache(): void {
  try {
    localStorage.removeItem(PERMISSION_CACHE_KEY)
    localStorage.removeItem(FEATURE_FLAG_CACHE_KEY)
    localStorage.removeItem(NAVIGATION_CACHE_KEY)
  } catch (error) {
    console.warn('Failed to invalidate cache:', error)
  }
}

/**
 * Invalidate cache for a specific tenant
 * @param tenantId - Tenant ID
 */
export function invalidateTenantCache(tenantId: string): void {
  try {
    // Check permission cache
    const permCache = localStorage.getItem(PERMISSION_CACHE_KEY)
    if (permCache) {
      const { tenantId: cachedTenantId }: CachedData<string[]> = JSON.parse(permCache)
      if (cachedTenantId === tenantId) {
        localStorage.removeItem(PERMISSION_CACHE_KEY)
      }
    }

    // Check feature flag cache
    const flagCache = localStorage.getItem(FEATURE_FLAG_CACHE_KEY)
    if (flagCache) {
      const { tenantId: cachedTenantId }: CachedData<Record<string, boolean>> = JSON.parse(flagCache)
      if (cachedTenantId === tenantId) {
        localStorage.removeItem(FEATURE_FLAG_CACHE_KEY)
      }
    }

    // Navigation cache is based on permissions hash, not tenant ID
    // So we don't need to check it here
  } catch (error) {
    console.warn('Failed to invalidate tenant cache:', error)
  }
}

