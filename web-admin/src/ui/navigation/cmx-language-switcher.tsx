'use client'
/* eslint-disable jsdoc/require-jsdoc */

/**
 * CmxLanguageSwitcher - Switch between English and Arabic with RTL
 * @module ui/navigation
 */

import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { type Locale, setLocale as saveLocale } from '@/lib/utils/locale.client'

export function CmxLanguageSwitcher() {
  const router = useRouter()
  const currentLocale = useLocale() as Locale
  const [locale, setLocale] = useState<Locale>(currentLocale)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setLocale(currentLocale)
  }, [currentLocale])

  const switchLanguage = (newLocale: Locale) => {
    if (newLocale === locale) {
      setIsOpen(false)
      return
    }

    setLocale(newLocale)
    saveLocale(newLocale)
    setIsOpen(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors min-w-fit whitespace-nowrap"
        aria-label="Switch language"
      >
        <Globe className="h-5 w-5 flex-shrink-0" />
        <span className="hidden sm:inline-block whitespace-nowrap">
          {locale === 'en' ? 'English' : 'العربية'}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute end-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border z-20">
            <div className="py-1">
              <button
                onClick={() => switchLanguage('en')}
                dir="ltr"
                className={`w-full text-start px-4 py-2 text-sm hover:bg-muted flex items-center justify-between ${
                  locale === 'en' ? 'bg-info-bg text-info-text' : 'text-muted-foreground'
                }`}
              >
                {/* cmx-ds-ignore UI008: native language endonym in language switcher */}
                <span>English</span>
                {locale === 'en' && <span className="text-primary-text">✓</span>}
              </button>
              <button
                onClick={() => switchLanguage('ar')}
                dir="rtl"
                className={`w-full text-start px-4 py-2 text-sm hover:bg-muted flex items-center justify-between ${
                  locale === 'ar' ? 'bg-info-bg text-info-text' : 'text-muted-foreground'
                }`}
              >
                <span>العربية</span>
                {locale === 'ar' && <span className="text-primary-text">✓</span>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
