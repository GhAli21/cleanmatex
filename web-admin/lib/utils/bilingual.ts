/**
 * Bilingual Field Utilities
 * 
 * Helper functions for handling bilingual database fields (name/name2 pattern)
 * Returns the appropriate field based on current locale
 */

'use client'

import { useCallback } from 'react'
import type { Locale } from './locale.client'
import { useLocale } from '@/lib/hooks/useRTL'

/**
 * Interface for items with bilingual fields
 */
export interface BilingualItem {
  name?: string | null
  name2?: string | null
  [key: string]: any
}

/**
 * Get bilingual field value based on locale
 * 
 * @param item - Item with name/name2 fields
 * @param locale - Current locale ('en' or 'ar')
 * @returns The appropriate field value, with fallback logic
 * 
 * @example
 * ```typescript
 * const product = { name: 'Shirt', name2: 'قميص' }
 * getBilingualField(product, 'en') // Returns 'Shirt'
 * getBilingualField(product, 'ar') // Returns 'قميص'
 * ```
 */
export function getBilingualField<T extends BilingualItem>(
  item: T,
  locale: Locale
): string {
  if (!item) return ''
  
  // For Arabic, prefer name2 but fallback to name if name2 is empty
  if (locale === 'ar') {
    if (item.name2 && item.name2.trim()) {
      return item.name2
    }
    // Fallback to English if Arabic not available
    return item.name || ''
  }
  
  // For English, prefer name but fallback to name2 if name is empty
  if (item.name && item.name.trim()) {
    return item.name
  }
  // Fallback to Arabic if English not available
  return item.name2 || ''
}

/**
 * Get bilingual field with custom field names
 * 
 * @param item - Item with bilingual fields
 * @param locale - Current locale
 * @param englishField - Name of English field (default: 'name')
 * @param arabicField - Name of Arabic field (default: 'name2')
 * @returns The appropriate field value
 * 
 * @example
 * ```typescript
 * const product = { product_name: 'Shirt', product_name2: 'قميص' }
 * getBilingualFieldCustom(product, 'ar', 'product_name', 'product_name2')
 * ```
 */
export function getBilingualFieldCustom<T extends Record<string, any>>(
  item: T,
  locale: Locale,
  englishField: string = 'name',
  arabicField: string = 'name2'
): string {
  if (!item) return ''
  
  const englishValue = item[englishField]
  const arabicValue = item[arabicField]
  
  if (locale === 'ar') {
    if (arabicValue && String(arabicValue).trim()) {
      return String(arabicValue)
    }
    return englishValue ? String(englishValue) : ''
  }
  
  if (englishValue && String(englishValue).trim()) {
    return String(englishValue)
  }
  return arabicValue ? String(arabicValue) : ''
}

/**
 * Check if item has both bilingual fields populated
 */
export function hasBilingualContent<T extends BilingualItem>(item: T): boolean {
  return !!(item?.name?.trim() && item?.name2?.trim())
}

/**
 * Get display name for product/service items
 * Common pattern: product_name/product_name2
 */
export function getProductName(
  item: { product_name?: string; product_name2?: string },
  locale: Locale
): string {
  return getBilingualFieldCustom(
    item as any,
    locale,
    'product_name',
    'product_name2'
  )
}

/**
 * Get display description for items
 * Common pattern: description/description2
 */
export function getDescription(
  item: { description?: string; description2?: string },
  locale: Locale
): string {
  return getBilingualFieldCustom(
    item as any,
    locale,
    'description',
    'description2'
  )
}

/**
 * React hook to get a bilingual value function
 * 
 * Returns a function that takes two string parameters (name, name2)
 * and returns the appropriate one based on current locale
 * 
 * @returns Function that takes (name, name2) and returns the locale-appropriate value
 * 
 * @example
 * ```typescript
 * const getBilingual = useBilingual()
 * const displayName = getBilingual(category.ctg_name, category.ctg_name2)
 * ```
 */
export function useBilingual(): (name?: string | null, name2?: string | null) => string {
  const locale = useLocale()
  
  return useCallback((name?: string | null, name2?: string | null): string => {
    // For Arabic, prefer name2 but fallback to name if name2 is empty
    if (locale === 'ar') {
      if (name2 && name2.trim()) {
        return name2
      }
      // Fallback to English if Arabic not available
      return name || ''
    }
    
    // For English, prefer name but fallback to name2 if name is empty
    if (name && name.trim()) {
      return name
    }
    // Fallback to Arabic if English not available
    return name2 || ''
  }, [locale])
}

