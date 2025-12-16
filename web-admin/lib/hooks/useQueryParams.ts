'use client'

/**
 * useQueryParams Hook
 *
 * Manages URL query parameters synchronization with React state
 * Provides a simple API to read and update query params while maintaining browser history
 *
 * Features:
 * - Read query parameters from URL
 * - Update query parameters and sync with URL
 * - TypeScript support for type-safe params
 * - Preserves existing params when updating
 * - Handles arrays and objects
 * - Clean API similar to useState
 *
 * Usage:
 * ```tsx
 * const [params, setParams] = useQueryParams<{ status: string; page: number }>()
 *
 * // Read
 * const status = params.status
 *
 * // Update
 * setParams({ status: 'active' })
 *
 * // Update multiple
 * setParams({ status: 'active', page: 2 })
 *
 * // Clear param
 * setParams({ status: undefined })
 * ```
 */

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export type QueryParams = Record<string, string | string[] | number | boolean | undefined | null>

export function useQueryParams<T extends QueryParams = QueryParams>(): [
  T,
  (params: Partial<T>, options?: { replace?: boolean }) => void,
  () => void
] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse current query parameters
  const currentParams = useMemo(() => {
    const params: Record<string, any> = {}

    searchParams.forEach((value, key) => {
      // Handle array parameters (e.g., ?status=active&status=completed)
      const existing = params[key]
      if (existing) {
        params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        // Try to parse as number
        const numValue = Number(value)
        if (!isNaN(numValue) && value !== '') {
          params[key] = numValue
        } else if (value === 'true' || value === 'false') {
          params[key] = value === 'true'
        } else {
          params[key] = value
        }
      }
    })

    return params as T
  }, [searchParams])

  // Update query parameters
  const setParams = useCallback(
    (newParams: Partial<T>, options: { replace?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString())

      // Update or remove parameters
      Object.entries(newParams).forEach(([key, value]) => {
        // Remove parameter if value is undefined or null
        if (value === undefined || value === null) {
          params.delete(key)
          return
        }

        // Handle arrays
        if (Array.isArray(value)) {
          params.delete(key)
          value.forEach((v) => {
            if (v !== undefined && v !== null) {
              params.append(key, String(v))
            }
          })
          return
        }

        // Handle other types
        params.set(key, String(value))
      })

      // Build new URL
      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname

      // Navigate with or without replacing history
      if (options.replace) {
        router.replace(newUrl)
      } else {
        router.push(newUrl)
      }
    },
    [pathname, router, searchParams]
  )

  // Clear all parameters
  const clearParams = useCallback(() => {
    router.push(pathname)
  }, [pathname, router])

  return [currentParams, setParams, clearParams]
}

/**
 * Hook to get a single query parameter
 */
export function useQueryParam<T = string>(
  key: string,
  defaultValue?: T
): [T | undefined, (value: T | undefined) => void] {
  const [params, setParams] = useQueryParams()

  const value = (params[key] as T) ?? defaultValue

  const setValue = useCallback(
    (newValue: T | undefined) => {
      setParams({ [key]: newValue } as any, { replace: true })
    },
    [key, setParams]
  )

  return [value, setValue]
}

/**
 * Hook to manage filter state with URL synchronization
 */
export function useFilters<T extends QueryParams>(defaultFilters?: T) {
  const [params, setParams, clearParams] = useQueryParams<T>()

  const filters = useMemo(() => {
    return { ...defaultFilters, ...params }
  }, [defaultFilters, params])

  const updateFilters = useCallback(
    (newFilters: Partial<T>) => {
      setParams(newFilters, { replace: true })
    },
    [setParams]
  )

  const resetFilters = useCallback(() => {
    if (defaultFilters) {
      setParams(defaultFilters as Partial<T>, { replace: true })
    } else {
      clearParams()
    }
  }, [defaultFilters, setParams, clearParams])

  const hasActiveFilters = useMemo(() => {
    if (!defaultFilters) return Object.keys(params).length > 0

    return Object.keys(params).some((key) => {
      const currentValue = params[key]
      const defaultValue = defaultFilters[key as keyof T]
      return currentValue !== defaultValue
    })
  }, [params, defaultFilters])

  return {
    filters,
    updateFilters,
    resetFilters,
    hasActiveFilters
  }
}
