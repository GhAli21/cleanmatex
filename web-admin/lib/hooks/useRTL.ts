/**
 * React hook for RTL detection with proper hydration support
 *
 * This hook safely detects RTL on both server and client without hydration mismatches
 */

'use client'

import { useState, useEffect } from 'react'

function getDocumentDirection(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return document.documentElement.dir === 'rtl'
}

function getDocumentLocale(): 'en' | 'ar' {
  if (typeof document === 'undefined') {
    return 'en'
  }

  return document.documentElement.lang === 'ar' ? 'ar' : 'en'
}

/**
 * Hook to detect if current direction is RTL
 * Handles hydration properly by reading from HTML dir attribute
 */
export function useRTL(): boolean {
  const [isRTL, setIsRTL] = useState(getDocumentDirection)

  useEffect(() => {
    // Listen for direction changes
    const observer = new MutationObserver(() => {
      setIsRTL(getDocumentDirection())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir']
    })

    return () => observer.disconnect()
  }, [])

  return isRTL
}

/**
 * Hook to get current locale
 */
export function useLocale(): 'en' | 'ar' {
  const [locale, setLocale] = useState<'en' | 'ar'>(getDocumentLocale)

  useEffect(() => {
    // Listen for language changes
    const observer = new MutationObserver(() => {
      setLocale(getDocumentLocale())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    })

    return () => observer.disconnect()
  }, [])

  return locale
}
