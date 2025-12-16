/**
 * React hook for RTL detection with proper hydration support
 *
 * This hook safely detects RTL on both server and client without hydration mismatches
 */

'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if current direction is RTL
 * Handles hydration properly by reading from HTML dir attribute
 */
export function useRTL(): boolean {
  const [isRTL, setIsRTL] = useState(false)

  useEffect(() => {
    // Only run on client side after hydration
    const dir = document.documentElement.dir
    setIsRTL(dir === 'rtl')

    // Listen for direction changes
    const observer = new MutationObserver(() => {
      const newDir = document.documentElement.dir
      setIsRTL(newDir === 'rtl')
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
  const [locale, setLocale] = useState<'en' | 'ar'>('en')

  useEffect(() => {
    const lang = document.documentElement.lang
    setLocale(lang === 'ar' ? 'ar' : 'en')

    // Listen for language changes
    const observer = new MutationObserver(() => {
      const newLang = document.documentElement.lang
      setLocale(newLang === 'ar' ? 'ar' : 'en')
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    })

    return () => observer.disconnect()
  }, [])

  return locale
}
