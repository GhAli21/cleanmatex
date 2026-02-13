'use client'

/**
 * Top Bar Component
 *
 * Features:
 * - Breadcrumb navigation
 * - Global search
 * - Notifications panel
 * - Language switcher
 * - User profile dropdown
 * - Tenant switcher
 */

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, ChevronDown, Search, User, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { findNavigationByPath } from '@/config/navigation'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useRTL } from '@/lib/hooks/useRTL'

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, currentTenant, availableTenants, signOut, switchTenant } = useAuth()
  const isRTL = useRTL()
  const t = useTranslations('layout.topBar')
  const tCommon = useTranslations('common')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showTenantMenu, setShowTenantMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  // Get current page title from navigation
  const currentSection = findNavigationByPath(pathname)
  const pageTitle = currentSection?.label || 'Dashboard'

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleTenantSwitch = async (tenantId: string) => {
    try {
      await switchTenant(tenantId)
      setShowTenantMenu(false)
    } catch (error) {
      console.error('Error switching tenant:', error)
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:top-0">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Page Title & Breadcrumb */}
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-4">
            {/* Global Search */}
            <div className="hidden md:block">
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="global-search"
                  name="search"
                  placeholder={t('searchPlaceholder')}
                  className={`block w-64 ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            </div>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md relative"
                aria-label="Notifications"
              >
                <Bell className="h-6 w-6" />
                {/* Notification badge */}
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              </button>

              {/* Notifications Dropdown - RTL aware */}
              {showNotifications && (
                <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">{t('notifications')}</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noNotifications')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tenant Switcher */}
            {availableTenants.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTenantMenu(!showTenantMenu)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="hidden md:block max-w-32 line-clamp-1 break-words">
                    {currentTenant?.tenant_name}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {/* Tenant Dropdown - RTL aware */}
                {showTenantMenu && (
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-xs text-gray-500">{t('switchTenant')}</p>
                    </div>
                    {availableTenants.map((tenant) => (
                      <button
                        key={tenant.tenant_id}
                        onClick={() => handleTenantSwitch(tenant.tenant_id)}
                        className={`
                          w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm hover:bg-gray-50
                          ${
                            currentTenant?.tenant_id === tenant.tenant_id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700'
                          }
                        `}
                      >
                        <div className="line-clamp-1 break-words">{tenant.tenant_name}</div>
                        <div className="text-xs text-gray-500">{tenant.user_role}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:block">
                  {user?.user_metadata?.display_name || user?.email}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* User Dropdown - RTL aware */}
              {showUserMenu && (
                <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1 break-words">
                      {user?.user_metadata?.display_name || user?.email}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1 break-words">{user?.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/dashboard/settings/general')
                    }}
                    className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <User className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('profile')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/dashboard/settings')
                    }}
                    className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('settings')}
                  </button>

                  <div className="border-t border-gray-200 mt-1"></div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <LogOut className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
