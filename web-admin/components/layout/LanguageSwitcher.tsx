'use client'

/**
 * Language Switcher Component
 *
 * Allows users to switch between English and Arabic
 * Persists selection in localStorage and cookies
 * Supports RTL layout without page reload
 */

import { useState, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { type Locale, setLocale as saveLocale, getLocaleFromLocalStorage } from '@/lib/utils/locale.client'
import { useRTL } from '@/lib/hooks/useRTL'

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>('en')
  const [isOpen, setIsOpen] = useState(false)
  const isRTL = useRTL() // Use hook instead of function

  useEffect(() => {
    // Load saved locale from localStorage
    const savedLocale = getLocaleFromLocalStorage()
    setLocale(savedLocale)
  }, [])

  const switchLanguage = (newLocale: Locale) => {
    // Update state
    setLocale(newLocale)

    // Save to localStorage and cookies, update HTML attributes
    saveLocale(newLocale)

    // Dispatch custom event to update AppProviders WITHOUT page reload
    window.dispatchEvent(new CustomEvent('localeChange', { detail: newLocale }))

    // Close dropdown
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-w-fit whitespace-nowrap"
        aria-label="Switch language"
      >
        <Globe className="h-5 w-5 flex-shrink-0" />
        <span className="hidden sm:inline-block whitespace-nowrap">
          {locale === 'en' ? 'English' : 'العربية'}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown - RTL aware positioning */}
          <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20`}>
            <div className="py-1">
              <button
                onClick={() => switchLanguage('en')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                  locale === 'en' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                <span>English</span>
                {locale === 'en' && (
                  <span className="text-blue-600">✓</span>
                )}
              </button>

              <button
                onClick={() => switchLanguage('ar')}
                className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between flex-row-reverse ${
                  locale === 'ar' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                <span>العربية</span>
                {locale === 'ar' && (
                  <span className="text-blue-600">✓</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
