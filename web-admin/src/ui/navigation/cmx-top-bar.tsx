'use client'

/**
 * CmxTopBar - Dashboard top bar with search, notifications, user menu
 * @module ui/navigation
 */

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, ChevronDown, Search, User, LogOut, Settings, ShieldCheck, Check, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { findNavigationByPath, NAVIGATION_SECTIONS } from '@/config/navigation'
import { getPageAccessContractByPath } from '@/src/features/access/page-access-registry'
import { hasPermissionRequirement } from '@/lib/auth/access-contracts'
import { CmxLanguageSwitcher } from './cmx-language-switcher'
import { useRTL } from '@/lib/hooks/useRTL'

export default function CmxTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, currentTenant, availableTenants, signOut, switchTenant, permissions } = useAuth()
  const isRTL = useRTL()
  const t = useTranslations('layout.topBar')
  const tCommon = useTranslations('common')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showTenantMenu, setShowTenantMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPermsDialog, setShowPermsDialog] = useState(false)

  const currentSection = findNavigationByPath(pathname)
  const pageTitle = currentSection?.label || 'Dashboard'
  const currentPageContract = getPageAccessContractByPath(pathname)
  const currentPageDetails = (() => {
    for (const section of NAVIGATION_SECTIONS) {
      if (section.path === pathname) {
        return {
          label: section.label,
          path: section.path,
          permissions: section.permissions ?? [],
        }
      }

      const child = section.children?.find((item) => item.path === pathname)
      if (child) {
        return {
          label: child.label,
          path: child.path,
          permissions: child.permissions ?? [],
        }
      }
    }

    return {
      label: pageTitle,
      path: pathname,
      permissions: [] as string[],
    }
  })()
  const currentPagePermissionSource = currentPageContract?.page.permissions ?? currentPageDetails.permissions
  const currentPageHasAccess = hasPermissionRequirement(
    currentPageContract?.page ?? {
      permissions: currentPageDetails.permissions,
      requireAllPermissions: false,
    },
    permissions ?? []
  )

  const handleSignOut = async () => {
    try { await signOut() } catch (error) { console.error('Error signing out:', error) }
  }

  const handleTenantSwitch = async (tenantId: string) => {
    try {
      await switchTenant(tenantId)
      setShowTenantMenu(false)
    } catch (error) { console.error('Error switching tenant:', error) }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:top-0">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          </div>

          <div className="flex items-center space-x-4">
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

            <CmxLanguageSwitcher />

            {/* Debug: Permissions Inspector */}
            <button
              type="button"
              onClick={() => setShowPermsDialog(true)}
              title="Debug: Show My Permissions"
              className="p-2 text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
            >
              <ShieldCheck className="h-5 w-5" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md relative"
                aria-label="Notifications"
              >
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              </button>

              {showNotifications && (
                <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">{t('notifications')}</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="px-4 py-8 text-center text-sm text-gray-500">{t('noNotifications')}</div>
                  </div>
                </div>
              )}
            </div>

            {availableTenants.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTenantMenu(!showTenantMenu)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="hidden md:block max-w-32 line-clamp-1 break-words">{currentTenant?.tenant_name}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showTenantMenu && (
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-xs text-gray-500">{t('switchTenant')}</p>
                    </div>
                    {availableTenants.map((tenant) => (
                      <button
                        key={tenant.tenant_id}
                        onClick={() => handleTenantSwitch(tenant.tenant_id)}
                        className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm hover:bg-gray-50 ${
                          currentTenant?.tenant_id === tenant.tenant_id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="line-clamp-1 break-words">{tenant.tenant_name}</div>
                        <div className="text-xs text-gray-500">{tenant.user_role}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:block">{user?.user_metadata?.display_name || user?.email}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {showUserMenu && (
                <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1 break-words">{user?.user_metadata?.display_name || user?.email}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 break-words">{user?.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); router.push('/dashboard/settings/general') }}
                    className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <User className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('profile')}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); router.push('/dashboard/settings') }}
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

      {/* Permissions Debug Dialog */}
      {showPermsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPermsDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">My Permissions</h2>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                {permissions?.length ?? 0} total
              </span>
            </div>
            <div className="overflow-y-auto px-5 py-4 flex flex-col gap-1">
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Current Page Access</h3>
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Page:</span> {currentPageDetails.label}
                  </p>
                  <p className="break-all">
                    <span className="font-medium">Path:</span> {currentPageDetails.path}
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                    <span className="text-xs font-medium text-gray-700">Page access</span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        currentPageHasAccess ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {currentPageHasAccess ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      {currentPageHasAccess ? 'Allowed' : 'Missing'}
                    </span>
                  </div>

                  {currentPagePermissionSource.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No explicit page permissions are defined for this route.
                    </p>
                  ) : (
                    currentPagePermissionSource.map((permissionCode) => {
                      const hasAccess = hasPermissionRequirement(
                        { permissions: [permissionCode], requireAllPermissions: true },
                        permissions ?? []
                      )

                      return (
                        <div
                          key={permissionCode}
                          className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2"
                        >
                          <span className="text-xs font-mono text-gray-700">{permissionCode}</span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              hasAccess ? 'text-green-700' : 'text-red-600'
                            }`}
                          >
                            {hasAccess ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            {hasAccess ? 'Allowed' : 'Missing'}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
                {currentPageContract?.actions && Object.keys(currentPageContract.actions).length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </h4>
                    {Object.entries(currentPageContract.actions).map(([actionKey, action]) => {
                      const hasAccess = hasPermissionRequirement(action.requirement, permissions ?? [])
                      const actionPermissions = action.requirement.permissions ?? []

                      return (
                        <div key={actionKey} className="rounded-md bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-gray-700">{action.label}</span>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                hasAccess ? 'text-green-700' : 'text-red-600'
                              }`}
                            >
                              {hasAccess ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                              {hasAccess ? 'Allowed' : 'Missing'}
                            </span>
                          </div>
                          {actionPermissions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {actionPermissions.map((permissionCode) => {
                                const hasActionPermission = hasPermissionRequirement(
                                  { permissions: [permissionCode], requireAllPermissions: true },
                                  permissions ?? []
                                )

                                return (
                                  <span
                                    key={permissionCode}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-mono ${
                                      hasActionPermission
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-600'
                                    }`}
                                  >
                                    {hasActionPermission ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                    {permissionCode}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-gray-500">
                              No explicit action permissions are defined.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              {(permissions ?? []).length === 0 ? (
                <p className="text-sm text-red-600 text-center py-8">No permissions found.</p>
              ) : (
                [...(permissions ?? [])].sort().map((p) => (
                  <span key={p} className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {p}
                  </span>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPermsDialog(false)}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
