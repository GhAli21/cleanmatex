'use client'

/**
 * Navigation Hook
 * 
 * Fetches and caches navigation items from API
 * Falls back to hardcoded navigation if API fails
 */

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import type { NavigationSection } from '@/config/navigation'
import { NAVIGATION_SECTIONS } from '@/config/navigation'
import {
  getCachedNavigation,
  setCachedNavigation,
  hashPermissions,
  invalidateNavigationCache,
} from '@/lib/cache/permission-cache-client'
import { getIcon } from '@/lib/utils/icon-registry'

export function useNavigation() {
  const { permissions, isLoading: authLoading, isAuthenticated } = useAuth()
  const [navigation, setNavigation] = useState<NavigationSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  console.log('Jh in useNavigation() [ 0 ] : permissions', permissions)
  console.log('Jh in useNavigation() [ 0 ] : authLoading', authLoading)
  console.log('Jh in useNavigation() [ 0 ] : isAuthenticated', isAuthenticated)
  // Generate permissions hash for cache key
  const permissionsHash = useMemo(() => {
    return hashPermissions(permissions || [])
  }, [permissions])
  console.log('Jh in useNavigation() [ 1 ] : permissionsHash', permissionsHash)
  useEffect(() => {
    async function loadNavigation() {
      if (authLoading) {
        console.log('Jh in useNavigation() [ 2 ] : authLoading is true, returning')
        return // Wait for auth to load
      }

      // Clear navigation if user is not authenticated
      if (!isAuthenticated) {
        console.log('Jh in useNavigation() [ 3 ] : isAuthenticated is false, setting navigation to []')
        setNavigation([])
        console.log('Jh in useNavigation() [ 4 ] : setting navigation to []')
        setIsLoading(false)
        console.log('Jh in useNavigation() [ 5 ] : setting isLoading to false')
        setError(null)
        console.log('Jh in useNavigation() [ 6 ] : setting error to null')
        return
      }

      console.log('Jh in useNavigation() [ 7 ] : setting isLoading to true')
      setIsLoading(true)
      console.log('Jh in useNavigation() [ 8 ] : setting error to null')
      setError(null)

      try {
        // Check cache first - but only use it if it has items
        console.log('Jh in useNavigation() [ 9 ] : checking cache')
        const cached = getCachedNavigation(permissionsHash)
        console.log('Jh in useNavigation() [ 10 ] : cached', cached)
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log('Jh in useNavigation() [ 11 ] : cached has items, using cached navigation')
          console.log('Jh in useNavigation() [ 12 ] : cached', cached)
          // Transform icon strings to components
          const transformedCached = transformNavigationIcons(cached)
          console.log('Jh in useNavigation() [ 13 ] : transformedCached', transformedCached)
          setNavigation(transformedCached)
          console.log('Jh in useNavigation() [ 14 ] : setting navigation to transformedCached')
          setIsLoading(false)
          console.log('Jh in useNavigation() [ 15 ] : setting isLoading to false returning')
          return
        } else if (cached && cached.length === 0) {
          console.log('Jh in useNavigation() [ 16 ] : cached has no items, clearing cache and fetching fresh')
          // Cache has empty array - clear it and fetch fresh
          console.warn('Cache has empty navigation array, clearing cache and fetching fresh')
          invalidateNavigationCache()
          console.log('Jh in useNavigation() [ 17 ] : cache cleared, fetching fresh')
        }

          // Fetch from API with timeout
         console.log('Jh in useNavigation() [ 18 ] : fetching from API')
          const controller = new AbortController()
          const timeoutId = setTimeout(() => {
            console.log('Jh in useNavigation() [ 18.5 ] : fetch timeout, aborting')
            controller.abort()
          }, 10000) // 10 second timeout
          
          let response: Response
          try {
            response = await fetch('/api/navigation', {
              signal: controller.signal,
            })
            clearTimeout(timeoutId)
          } catch (fetchError: any) {
            clearTimeout(timeoutId)
            if (fetchError.name === 'AbortError') {
              console.log('Jh in useNavigation() [ 18.6 ] : fetch aborted due to timeout')
              throw new Error('Navigation API request timed out')
            }
            throw fetchError
          }
          
         console.log('Jh in useNavigation() [ 19 ] : response', response)
        
        // Check if response is OK
        if (!response.ok) {
          console.log('Jh in useNavigation() [ 20 ] : response is not ok response.status=', response.status)
          // Handle authentication errors gracefully
          if (response.status === 401 || response.status === 403) {
            // User is not authenticated or unauthorized - clear navigation
            setNavigation([])
            setIsLoading(false)
            console.log('Jh in useNavigation() [ 22 ] : setting navigation to [] and setting isLoading to false returning')
            return
          }
          console.log('Jh in useNavigation() [ 23 ] : throwing error Failed to fetch navigation: ${response.statusText}')
          throw new Error(`Failed to fetch navigation: ${response.statusText}`)
        }

        // Check Content-Type to ensure we're getting JSON, not HTML
        console.log('Jh in useNavigation() [ 24 ] : checking content type')
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          // Response is not JSON (likely HTML redirect page)
          console.log('Jh in useNavigation() [ 25 ] : content type is not application/json, clearing navigation')
          console.warn('Navigation API returned non-JSON response, clearing navigation')
          setNavigation([])
          setIsLoading(false)
          console.log('Jh in useNavigation() [ 26 ] : setting navigation to [] and setting isLoading to false returning')
          return
        }

        console.log('Jh in useNavigation() [ 27 ] : parsing response as json')
        const data = await response.json()
        console.log('Jh in useNavigation() [ 28 ] : data', data)
        const sections = data.sections as any[]

        console.log('Jh in useNavigation() [ 29 ] : sections', sections)
        console.log('Jh in useNavigation() [ 30 ] : Navigation API response:', {
          sectionsCount: sections?.length || 0,
          source: data.source,
          sections: sections,
        })
        console.log('Jh in useNavigation() [ 31 ] : sections and sections.length > 0')
        if (sections && sections.length > 0) {
          console.log('Jh in useNavigation() [ 32 ] : sections and sections.length > 0, transforming icons')
          // Transform icon strings to components
          const transformedSections = transformNavigationIcons(sections)
          console.log('Jh in useNavigation() [ 33 ] : transformedSections', transformedSections)
          console.log('Jh in useNavigation() [ 34 ] : setting navigation to transformedSections')
          setNavigation(transformedSections)
          // Cache the result (with icon strings, not components) - only cache non-empty arrays
          console.log('Jh in useNavigation() [ 35 ] : caching navigation to cache')
          setCachedNavigation(permissionsHash, sections)
          console.log('Jh in useNavigation() [ 36 ] : cached navigation to cache')
        } else {
          // No navigation items found - user has no permissions
          console.log('Jh in useNavigation() [ 37 ] : no navigation items found, setting navigation to []')
          console.warn('Jh in useNavigation() [ 38 ] : No navigation sections returned from API', {
            source: data.source,
            error: data.error,
          })
          console.log('Jh in useNavigation() [ 39 ] : setting navigation to []')
          setNavigation([])
          // Don't cache empty arrays - clear any existing cache
          console.log('Jh in useNavigation() [ 40 ] : clearing cache')
          invalidateNavigationCache()
          console.log('Jh in useNavigation() [ 41 ] : cache cleared')
        }
      } catch (err) {
        // Handle JSON parsing errors specifically
        if (err instanceof SyntaxError && err.message.includes('JSON')) {
          console.log('Jh in useNavigation() [ 42 ] : failed to parse navigation response as JSON, setting navigation to []')
          console.warn('Jh in useNavigation() [ 43 ] : Failed to parse navigation response as JSON, clearing navigation')
          setNavigation([])
          setError(null) // Don't show error for logout scenarios
        } else {
          console.log('Jh in useNavigation() [ 44 ] : error loading navigation, setting error to err.message')
          console.error('Jh in useNavigation() [ 45 ] : Error loading navigation:', err)
          setError(err instanceof Error ? err.message : 'Failed to load navigation')
          // Return empty navigation on error (no default fallback)
          setNavigation([])
          console.log('Jh in useNavigation() [ 46 ] : setting navigation to []')
        }
      } finally {
        setIsLoading(false)
        console.log('Jh in useNavigation() [ 47 ] : setting isLoading to false')
      }
    }

    console.log('Jh in useNavigation() [ 48 ] : loading navigation')
    loadNavigation()
  }, [permissionsHash, authLoading, isAuthenticated])

  console.log('Jh in useNavigation() [ 49 ] : returning navigation', navigation)
  console.log('Jh in useNavigation() [ 50 ] : returning isLoading', isLoading)
  console.log('Jh in useNavigation() [ 51 ] : returning error', error)
  return {
    navigation,
    isLoading,
    error,
  }
}

/**
 * Transform navigation sections: convert icon strings to LucideIcon components
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
    
    // Check if icon is already a valid React component (from hardcoded NAVIGATION_SECTIONS)
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
