'use client'
/* eslint-disable jsdoc/require-jsdoc */

/**
 * CmxTopBar - Dashboard top bar with search, notifications, user menu
 * @module ui/navigation
 */

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, Search, User, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { getPageAccessContractByPath } from '@features/access/page-access-registry'
import { CmxLanguageSwitcher } from './cmx-language-switcher'
import { CmxPermissionsInspectorTrigger } from './permissions-inspector'
import { useRTL } from '@/lib/hooks/useRTL'
import { NotificationBell } from '@features/notifications/ui/notification-bell'
import { SessionActivityTrigger } from '@features/session-activity'

export default function CmxTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, currentTenant, signOut } = useAuth()
  const isRTL = useRTL()
  const t = useTranslations('layout.topBar')
  const [showUserMenu, setShowUserMenu] = useState(false)

  const currentPageContract = getPageAccessContractByPath(pathname)
  const pageTitle = currentPageContract?.label ?? 'Dashboard'

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white lg:top-0">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block">
              <div className="relative">
                <div
                  className={`pointer-events-none absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center`}
                >
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="global-search"
                  name="search"
                  placeholder={t('searchPlaceholder')}
                  className={`block w-64 ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} rounded-md border border-gray-300 bg-white py-2 leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            </div>

            <CmxLanguageSwitcher />

            <CmxPermissionsInspectorTrigger title={t('permissionsDialog.title')} />

            <SessionActivityTrigger />

            <NotificationBell />

            {/* A session is bound to one tenant at sign-in; to use another tenant the user signs out and signs in there. */}
            {currentTenant?.tenant_name ? (
              <span
                className="line-clamp-1 hidden max-w-40 break-words rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 md:block"
                title={currentTenant.tenant_name}
              >
                {currentTenant.tenant_name}
              </span>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-medium text-white">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:block">{user?.user_metadata?.display_name || user?.email}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {showUserMenu && (
                <div
                  className={`absolute ${isRTL ? 'left-0' : 'right-0'} z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg`}
                >
                  <div className="border-b border-gray-200 px-4 py-3">
                    <p className="line-clamp-1 break-words text-sm font-medium text-gray-900">
                      {user?.user_metadata?.display_name || user?.email}
                    </p>
                    <p className="line-clamp-1 break-words text-xs text-gray-500">{user?.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/dashboard/settings/general')
                    }}
                    className={`flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
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
                    className={`flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('settings')}
                  </button>

                  <div className="mt-1 border-t border-gray-200" />

                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className={`flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
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
