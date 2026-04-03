'use client'

/**
 * CmxTopBar - Dashboard top bar with search, notifications, user menu
 * @module ui/navigation
 */

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, Search, User, LogOut, Settings, ShieldCheck, Check, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  evaluateAccessRequirement,
  hasExplicitPermissionGate,
  type ApiAccessDependency,
  type AccessEvaluationDetail,
  type AccessRequirement,
} from '@/lib/auth/access-contracts'
import { getAllPageAccessContracts, getPageAccessContractByPath } from '@features/access/page-access-registry'
import { CmxLanguageSwitcher } from './cmx-language-switcher'
import { useRTL } from '@/lib/hooks/useRTL'

function RequirementBadge({
  passed,
  label,
}: {
  passed: boolean
  label: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        passed ? 'text-green-700' : 'text-red-600'
      }`}
    >
      {passed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {label}
    </span>
  )
}

function RequirementDetailRow({ detail }: { detail: AccessEvaluationDetail }) {
  const labels: Record<AccessEvaluationDetail['kind'], string> = {
    permission: 'Permission',
    permission_prefix: 'Permission Prefix',
    feature_flag: 'Feature Flag',
    workflow_role: 'Workflow Role',
    tenant_role: 'Tenant Role',
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {labels[detail.kind]}
        </p>
        <p className="break-all text-xs font-mono text-gray-700">{detail.value}</p>
      </div>
      <RequirementBadge passed={detail.passed} label={detail.passed ? 'Allowed' : 'Missing'} />
    </div>
  )
}

function RequirementBlock({
  title,
  requirement,
  details,
  passed,
  showNoExplicitPermissions = false,
}: {
  title: string
  requirement: AccessRequirement
  details: AccessEvaluationDetail[]
  passed: boolean
  showNoExplicitPermissions?: boolean
}) {
  const explicitPermissionGate = hasExplicitPermissionGate(requirement)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
        <span className="text-xs font-medium text-gray-700">{title}</span>
        <RequirementBadge passed={passed} label={passed ? 'Allowed' : 'Missing'} />
      </div>

      {showNoExplicitPermissions && !explicitPermissionGate ? (
        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
          No explicit page permissions.
        </p>
      ) : null}

      {details.map((detail) => (
        <RequirementDetailRow key={`${detail.kind}:${detail.value}`} detail={detail} />
      ))}
    </div>
  )
}

function ApiDependencyCard({
  dependency,
  passed,
  details,
}: {
  dependency: ApiAccessDependency
  passed: boolean
  details: AccessEvaluationDetail[]
}) {
  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{dependency.label}</p>
          <p className="break-all text-xs font-mono text-gray-600">
            {dependency.method} {dependency.path}
          </p>
        </div>
        <RequirementBadge passed={passed} label={passed ? 'Allowed' : 'Missing'} />
      </div>

      {!dependency.requirement || details.length === 0 ? (
        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
          No explicit API permission requirement recorded.
        </p>
      ) : (
        details.map((detail) => (
          <RequirementDetailRow
            key={`${dependency.method}:${dependency.path}:${detail.kind}:${detail.value}`}
            detail={detail}
          />
        ))
      )}

      {dependency.notes?.map((note) => (
        <p key={note} className="text-xs text-gray-500">
          {note}
        </p>
      ))}
    </div>
  )
}

export default function CmxTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const {
    user,
    currentTenant,
    availableTenants,
    signOut,
    switchTenant,
    permissions,
    workflowRoles,
  } = useAuth()
  const isRTL = useRTL()
  const t = useTranslations('layout.topBar')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showTenantMenu, setShowTenantMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPermsDialog, setShowPermsDialog] = useState(false)
  const [activeInspectorTab, setActiveInspectorTab] = useState<'ui' | 'api' | 'flags'>('ui')

  const { data: featureFlags = {} } = useQuery({
    queryKey: ['feature-flags', currentTenant?.tenant_id],
    queryFn: async () => {
      const response = await fetch('/api/feature-flags')
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags')
      }

      return (await response.json()) as Record<string, boolean>
    },
    enabled: !!currentTenant?.tenant_id && showPermsDialog,
  })

  const currentPageContract = getPageAccessContractByPath(pathname)
  const pageTitle = currentPageContract?.label ?? 'Dashboard'
  const sortedFeatureFlags = Object.entries(featureFlags).sort(
    ([leftKey, leftEnabled], [rightKey, rightEnabled]) => {
      if (leftEnabled !== rightEnabled) {
        return leftEnabled ? -1 : 1
      }

      return leftKey.localeCompare(rightKey)
    },
  )
  const pageEvaluation = currentPageContract
    ? evaluateAccessRequirement(currentPageContract.page, {
        userPermissions: permissions ?? [],
        userWorkflowRoles: workflowRoles ?? [],
        userTenantRole: currentTenant?.user_role ?? null,
        featureFlags,
      })
    : null

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

            <button
              type="button"
              onClick={() => {
                setActiveInspectorTab('ui')
                setShowPermsDialog(true)
              }}
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

      {showPermsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPermsDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">{t('permissionsDialog.title')}</h2>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                {t('permissionsDialog.total', { count: permissions?.length ?? 0 })}
              </span>
            </div>

            <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Current Page Access</h3>
                  </div>
                  <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setActiveInspectorTab('ui')}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        activeInspectorTab === 'ui'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      UI Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveInspectorTab('api')}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        activeInspectorTab === 'api'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t('permissionsDialog.apiAccessTab')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveInspectorTab('flags')}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        activeInspectorTab === 'flags'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t('permissionsDialog.featureFlagsTab')}
                    </button>
                  </div>
                </div>

                {currentPageContract && pageEvaluation ? (
                  activeInspectorTab === 'ui' ? (
                    <div className="space-y-4">
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>
                          <span className="font-medium">Page:</span> {currentPageContract.label}
                        </p>
                        <p className="break-all">
                          <span className="font-medium">Path:</span> {pathname}
                        </p>
                        <p className="break-all">
                          <span className="font-medium">Route Pattern:</span> {currentPageContract.routePattern}
                        </p>
                      </div>

                      <RequirementBlock
                        title="Page access"
                        requirement={currentPageContract.page}
                        details={pageEvaluation.details}
                        passed={pageEvaluation.passed}
                        showNoExplicitPermissions
                      />

                      {currentPageContract.actions && Object.keys(currentPageContract.actions).length > 0 ? (
                        <div className="space-y-3 border-t border-gray-200 pt-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Actions
                          </h4>
                          {Object.entries(currentPageContract.actions).map(([actionKey, action]) => {
                            const actionEvaluation = evaluateAccessRequirement(action.requirement, {
                              userPermissions: permissions ?? [],
                              userWorkflowRoles: workflowRoles ?? [],
                              userTenantRole: currentTenant?.user_role ?? null,
                              featureFlags,
                            })

                            return (
                              <div key={actionKey} className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium text-gray-800">{action.label}</span>
                                  <RequirementBadge
                                    passed={actionEvaluation.passed}
                                    label={actionEvaluation.passed ? 'Allowed' : 'Missing'}
                                  />
                                </div>
                                {actionEvaluation.details.length === 0 ? (
                                  <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                                    No explicit action requirements.
                                  </p>
                                ) : (
                                  actionEvaluation.details.map((detail) => (
                                    <RequirementDetailRow key={`${actionKey}:${detail.kind}:${detail.value}`} detail={detail} />
                                  ))
                                )}
                                {action.notes?.map((note) => (
                                  <p key={note} className="text-xs text-gray-500">
                                    {note}
                                  </p>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {currentPageContract.notes?.length ? (
                        <div className="space-y-1 border-t border-gray-200 pt-3">
                          {currentPageContract.notes.map((note) => (
                            <p key={note} className="text-xs text-gray-500">
                              {note}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : activeInspectorTab === 'api' ? (
                    <div className="space-y-4">
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>
                          <span className="font-medium">{t('permissionsDialog.pageLabel')}</span> {currentPageContract.label}
                        </p>
                        <p className="break-all">
                          <span className="font-medium">{t('permissionsDialog.pathLabel')}</span> {pathname}
                        </p>
                      </div>

                      {currentPageContract.apiDependencies?.length ? (
                        <div className="space-y-3">
                          {currentPageContract.apiDependencies.map((dependency) => {
                            const apiEvaluation = evaluateAccessRequirement(dependency.requirement, {
                              userPermissions: permissions ?? [],
                              userWorkflowRoles: workflowRoles ?? [],
                              userTenantRole: currentTenant?.user_role ?? null,
                              featureFlags,
                            })

                            return (
                              <ApiDependencyCard
                                key={`${dependency.method}:${dependency.path}`}
                                dependency={dependency}
                                passed={apiEvaluation.passed}
                                details={apiEvaluation.details}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                          No API dependencies recorded for this page yet.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>
                          <span className="font-medium">{t('permissionsDialog.pageLabel')}</span> {currentPageContract.label}
                        </p>
                        <p className="break-all">
                          <span className="font-medium">{t('permissionsDialog.pathLabel')}</span> {pathname}
                        </p>
                      </div>

                      {sortedFeatureFlags.length ? (
                        <div className="space-y-3">
                          {sortedFeatureFlags.map(([flagKey, enabled]) => (
                            <div key={flagKey} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                  {t('permissionsDialog.flagKeyLabel')}
                                </p>
                                <p className="break-all text-xs font-mono text-gray-700">{flagKey}</p>
                              </div>
                              <RequirementBadge
                                passed={enabled}
                                label={enabled ? t('permissionsDialog.enabled') : t('permissionsDialog.disabled')}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                          {t('permissionsDialog.noFeatureFlags')}
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">
                      Missing route access contract for this page.
                    </p>
                    <p className="text-xs text-gray-500">
                      Registered contracts: {getAllPageAccessContracts().length}
                    </p>
                    <p className="text-xs font-mono text-gray-700 break-all">{pathname}</p>
                  </div>
                )}
              </div>

              {(permissions ?? []).length === 0 ? (
                <p className="text-sm text-red-600 text-center py-8">No permissions found.</p>
              ) : (
                [...(permissions ?? [])].sort().map((permissionCode) => (
                  <span key={permissionCode} className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {permissionCode}
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
