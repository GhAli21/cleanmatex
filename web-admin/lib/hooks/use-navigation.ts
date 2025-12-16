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
} from '@/lib/cache/permission-cache-client'
import { getIcon } from '@/lib/utils/icon-registry'

export function useNavigation() {
  const { permissions, isLoading: authLoading, isAuthenticated } = useAuth()
  const [navigation, setNavigation] = useState<NavigationSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate permissions hash for cache key
  const permissionsHash = useMemo(() => {
    return hashPermissions(permissions || [])
  }, [permissions])

  useEffect(() => {
    async function loadNavigation() {
      if (authLoading) {
        return // Wait for auth to load
      }

      // Clear navigation if user is not authenticated
      if (!isAuthenticated) {
        setNavigation([])
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Check cache first
        const cached = getCachedNavigation(permissionsHash)
        if (cached) {
          // Transform icon strings to components
          const transformedCached = transformNavigationIcons(cached)
          setNavigation(transformedCached)
          setIsLoading(false)
          return
        }

        // Fetch from API
        const response = await fetch('/api/navigation')
        
        // Check if response is OK
        if (!response.ok) {
          // Handle authentication errors gracefully
          if (response.status === 401 || response.status === 403) {
            // User is not authenticated or unauthorized - clear navigation
            setNavigation([])
            setIsLoading(false)
            return
          }
          throw new Error(`Failed to fetch navigation: ${response.statusText}`)
        }

        // Check Content-Type to ensure we're getting JSON, not HTML
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          // Response is not JSON (likely HTML redirect page)
          console.warn('Navigation API returned non-JSON response, clearing navigation')
          setNavigation([])
          setIsLoading(false)
          return
        }

        const data = await response.json()
        const sections = data.sections as any[]

        if (sections && sections.length > 0) {
          // Transform icon strings to components
          const transformedSections = transformNavigationIcons(sections)
          setNavigation(transformedSections)
          // Cache the result (with icon strings, not components)
          setCachedNavigation(permissionsHash, sections)
        } else {
          // No navigation items found - user has no permissions
          setNavigation([])
        }
      } catch (err) {
        // Handle JSON parsing errors specifically
        if (err instanceof SyntaxError && err.message.includes('JSON')) {
          console.warn('Failed to parse navigation response as JSON, clearing navigation')
          setNavigation([])
          setError(null) // Don't show error for logout scenarios
        } else {
          console.error('Error loading navigation:', err)
          setError(err instanceof Error ? err.message : 'Failed to load navigation')
          // Return empty navigation on error (no default fallback)
          setNavigation([])
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadNavigation()
  }, [permissionsHash, authLoading, isAuthenticated])

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
