'use client'

/**
 * Navigation Hook
 * 
 * Fetches and caches navigation items from the database menu API.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import type { NavigationSection } from '@/config/navigation'
import {
  getCachedNavigation,
  setCachedNavigation,
  hashPermissions,
  invalidateNavigationCache,
} from '@/lib/cache/permission-cache-client'
import { getIcon } from '@/lib/utils/icon-registry'

type NavigationFetchResult =
  | { status: 'ok'; sections: unknown[] }
  | { status: 'unauthorized' }
  | { status: 'non_json' }

// Deduplicates concurrent GET /api/navigation calls across layout consumers
// (CmxSidebar, DashboardTopBar, DashboardBrowserTitle).
const inFlightNavigationRequests = new Map<string, Promise<NavigationFetchResult>>()

async function fetchNavigationShared(cacheKey: string): Promise<NavigationFetchResult> {
  const existing = inFlightNavigationRequests.get(cacheKey)
  if (existing) {
    return existing
  }

  const requestPromise = (async (): Promise<NavigationFetchResult> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 60000)

    let response: Response
    try {
      response = await fetch('/api/navigation', {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Navigation API request timed out')
      }
      throw fetchError
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { status: 'unauthorized' }
      }
      throw new Error(`Failed to fetch navigation: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Navigation API returned non-JSON response, clearing navigation')
      return { status: 'non_json' }
    }

    const data = (await response.json()) as { sections?: unknown[]; source?: string; error?: string }
    const sections = Array.isArray(data.sections) ? data.sections : []
    if (sections.length === 0) {
      console.warn('No navigation sections returned from API', {
        source: data.source,
        error: data.error,
      })
    }
    return { status: 'ok', sections }
  })().finally(() => {
    inFlightNavigationRequests.delete(cacheKey)
  })

  inFlightNavigationRequests.set(cacheKey, requestPromise)
  return requestPromise
}

/**
 * Fetches and caches tenant-scoped navigation sections with stale-while-revalidate.
 */
export function useNavigation() {
  const { permissions, currentTenant, isLoading: authLoading, isAuthenticated } = useAuth()
  const [navigation, setNavigation] = useState<NavigationSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const loadedTenantIdRef = useRef<string | null>(null)
  const hasItemsRef = useRef(false)

  const tenantId = currentTenant?.tenant_id ?? ''

  // Generate permissions hash for cache key
  const permissionsHash = useMemo(() => {
    return hashPermissions([tenantId, ...(permissions || [])])
  }, [tenantId, permissions])

  const retry = useCallback(() => {
    setReloadTick((prev) => prev + 1)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadNavigation() {
      if (authLoading) {
        return // Wait for auth to load
      }

      // Clear navigation if user is not authenticated
      if (!isAuthenticated) {
        if (isMounted) {
          loadedTenantIdRef.current = null
          hasItemsRef.current = false
          setNavigation([])
          setIsLoading(false)
          setError(null)
        }
        return
      }

      const tenantChanged = loadedTenantIdRef.current !== null && loadedTenantIdRef.current !== tenantId
      if (tenantChanged) {
        hasItemsRef.current = false
      }

      // Hydrate from cache immediately so refreshes never blank out the sidebar
      let hydratedFromCache = false
      const cached = getCachedNavigation(permissionsHash)
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const transformedCached = transformNavigationIcons(cached)
        if (isMounted) {
          loadedTenantIdRef.current = tenantId
          hasItemsRef.current = true
          hydratedFromCache = true
          setNavigation(transformedCached)
          setIsLoading(false)
          setError(null)
        }
      } else {
        if (cached && cached.length === 0) {
          console.warn('Cache has empty navigation array, clearing cache and fetching fresh')
          invalidateNavigationCache()
        }
        // Only show loading state when we have no valid items for the current tenant yet
        if (isMounted && (!hasItemsRef.current || tenantChanged)) {
          if (tenantChanged) {
            setNavigation([])
          }
          setIsLoading(true)
          setError(null)
        }
      }

      try {
        const result = await fetchNavigationShared(permissionsHash)

        if (!isMounted) return

        if (result.status === 'unauthorized' || result.status === 'non_json') {
          loadedTenantIdRef.current = null
          hasItemsRef.current = false
          setNavigation([])
          setIsLoading(false)
          return
        }

        const sections = result.sections

        if (sections.length > 0) {
          const transformedSections = transformNavigationIcons(sections)
          loadedTenantIdRef.current = tenantId
          hasItemsRef.current = true
          setNavigation(transformedSections)
          setError(null)
          // Cache the result (with icon strings, not components) - only cache non-empty arrays
          setCachedNavigation(permissionsHash, sections)
        } else {
          // No navigation items found - user has no permissions
          loadedTenantIdRef.current = tenantId
          hasItemsRef.current = false
          setNavigation([])
          invalidateNavigationCache()
        }
      } catch (err) {
        if (!isMounted) return

        if (err instanceof SyntaxError && err.message.includes('JSON')) {
          console.warn('Failed to parse navigation response as JSON, clearing navigation')
          if (!hydratedFromCache && !hasItemsRef.current) {
            setNavigation([])
          }
          setError(null) // Don't show error for logout scenarios
        } else {
          console.error('Error loading navigation:', err)
          // Keep hydrated cached items visible on transient refresh errors
          if (!hydratedFromCache && !hasItemsRef.current) {
            setError(err instanceof Error ? err.message : 'Failed to load navigation')
            setNavigation([])
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadNavigation()

    return () => {
      isMounted = false
    }
  }, [permissionsHash, tenantId, authLoading, isAuthenticated, reloadTick])

  return {
    navigation,
    isLoading,
    error,
    retry,
  }
}

/**
 * Transform navigation sections: convert icon strings to LucideIcon components
 * @param sections
 */
function transformNavigationIcons(sections: any[]): NavigationSection[] {
  if (!sections || !Array.isArray(sections)) {
    console.warn('transformNavigationIcons: sections is not an array', sections)
    return []
  }

  return sections.map((section) => {
    if (!section || typeof section !== 'object') {
      console.warn('transformNavigationIcons: invalid section', section)
      return section
    }

    // Handle icon conversion - could be string, object (from JSON), or already a component
    let icon: any

    // Check if icon is already a React component
    if (section.icon && typeof section.icon === 'function') {
      icon = section.icon
    } else if (typeof section.icon === 'string') {
      // Icon is a string name - convert to component
      icon = getIcon(section.icon)
    } else if (section.icon && typeof section.icon === 'object') {
      // Icon is an object (likely from JSON serialization of React component)
      // Try to extract icon name from various possible properties
      const iconName = section.iconName || section.comp_icon || section.icon?.name || section.icon?.displayName || 'Home'
      icon = getIcon(iconName)
      // Only log warning in development if we couldn't resolve the icon name
      if (process.env.NODE_ENV === 'development' && iconName === 'Home' && section.icon) {
        console.debug(`Icon object detected for section ${section.key}, resolved to Home fallback`, {
          sectionKey: section.key,
          iconObject: section.icon
        })
      }
    } else {
      // No icon or invalid icon - use fallback
      const iconName = section.comp_icon || 'Home'
      icon = getIcon(iconName)
    }

    // Ensure icon is a valid component function
    if (!icon || typeof icon !== 'function') {
      // Only log warning if we truly couldn't resolve an icon
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Resolving icon for section ${section.key} to Home fallback`, {
          sectionKey: section.key,
          iconValue: section.icon,
          iconType: typeof section.icon
        })
      }
      icon = getIcon('Home')
    }

    return {
      ...section,
      icon,
      children: section.children && Array.isArray(section.children)
        ? section.children.map((child: any) => ({
          ...child,
          // Children don't have icons in NavigationItem interface
        }))
        : undefined,
    }
  })
}
