'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Check, X, RefreshCw, GripHorizontal } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  evaluateAccessRequirement,
  hasExplicitPermissionGate,
  type ApiAccessDependency,
  type AccessEvaluationDetail,
  type AccessRequirement,
} from '@/lib/auth/access-contracts'
import { getAllPageAccessContracts, getPageAccessContractByPath } from '@features/access/page-access-registry'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { useDraggablePanel } from '@/lib/hooks/useDraggablePanel'
import { HELP_PERMISSIONS } from '@/lib/constants/permissions/help'
import { CmxInput } from '@ui/primitives'
import type { PermissionsInspectorTab } from './permissions-inspector-types'

function RequirementBadge({ passed, label }: { passed: boolean; label: string }) {
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
        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">No explicit page permissions.</p>
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

export interface CmxPermissionsInspectorPanelProps {
  open: boolean
  onClose: () => void
  initialTab?: PermissionsInspectorTab
  routePathOverride?: string
}

/**
 * Draggable permissions / access inspector panel.
 */
export function CmxPermissionsInspectorPanel({
  open,
  onClose,
  initialTab = 'ui',
  routePathOverride,
}: CmxPermissionsInspectorPanelProps) {
  const pathname = usePathname()
  const effectivePath = routePathOverride ?? pathname ?? ''
  const t = useTranslations('layout.topBar')
  const queryClient = useQueryClient()
  const {
    permissions,
    workflowRoles,
    currentTenant,
    refreshPermissions,
  } = useAuth()

  const [activeInspectorTab, setActiveInspectorTab] = useState<PermissionsInspectorTab>(initialTab)
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const {
    offset: inspectorOffset,
    resetPosition: resetInspectorPosition,
    dragHandleProps: inspectorDragHandleProps,
  } = useDraggablePanel()

  const normalizedPermissionSearch = permissionSearchQuery.trim().toLowerCase()
  const canViewPlatformInventories = useHasPermissionCode(HELP_PERMISSIONS.PLATFORM_INVENTORIES)

  useEffect(() => {
    if (open) {
      setActiveInspectorTab(initialTab)
    }
  }, [open, initialTab])

  const handleClose = useCallback(() => {
    setPermissionSearchQuery('')
    resetInspectorPosition()
    onClose()
  }, [onClose, resetInspectorPosition])

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        refreshPermissions(),
        queryClient.invalidateQueries({ queryKey: ['feature-flags', currentTenant?.tenant_id] }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  const { data: featureFlags = {} } = useQuery({
    queryKey: ['feature-flags', currentTenant?.tenant_id],
    queryFn: async () => {
      const response = await fetch('/api/feature-flags')
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags')
      }
      return (await response.json()) as Record<string, boolean>
    },
    enabled: !!currentTenant?.tenant_id && open,
  })

  const currentPageContract = getPageAccessContractByPath(effectivePath)
  const sortedFeatureFlags = Object.entries(featureFlags).sort(
    ([leftKey, leftEnabled], [rightKey, rightEnabled]) => {
      if (leftEnabled !== rightEnabled) {
        return leftEnabled ? -1 : 1
      }
      return leftKey.localeCompare(rightKey)
    }
  )

  const pageEvaluation = currentPageContract
    ? evaluateAccessRequirement(currentPageContract.page, {
        userPermissions: permissions ?? [],
        userWorkflowRoles: workflowRoles ?? [],
        userTenantRole: currentTenant?.user_role ?? null,
        featureFlags,
      })
    : null

  const filteredUserPermissions = useMemo(() => {
    const sorted = [...(permissions ?? [])].sort()
    if (!normalizedPermissionSearch) return sorted
    return sorted.filter((code) => code.toLowerCase().includes(normalizedPermissionSearch))
  }, [normalizedPermissionSearch, permissions])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permissions-inspector-title"
        className="fixed left-1/2 top-1/2 z-[101] flex w-[min(100vw-2rem,42rem)] max-h-[85vh] flex-col rounded-lg border border-gray-200 bg-white shadow-2xl"
        style={{
          transform: `translate(calc(-50% + ${inspectorOffset.x}px), calc(-50% + ${inspectorOffset.y}px))`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div
            {...inspectorDragHandleProps}
            title={t('permissionsDialog.dragToMove')}
            className={`flex min-w-0 flex-1 items-center gap-2 ${inspectorDragHandleProps.className}`}
          >
            <GripHorizontal className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
            <h2 id="permissions-inspector-title" className="truncate text-base font-semibold text-gray-900">
              {t('permissionsDialog.title')}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 ps-3" data-no-drag>
            <button
              type="button"
              onClick={() => void handleRefreshAll()}
              disabled={isRefreshing}
              title="Refresh permissions & feature flags"
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
              {t('permissionsDialog.total', { count: permissions?.length ?? 0 })}
            </span>
          </div>
        </div>

        <div className="border-b border-gray-200 px-5 py-3">
          <CmxInput
            type="search"
            value={permissionSearchQuery}
            onChange={(event) => setPermissionSearchQuery(event.target.value)}
            placeholder={t('permissionsDialog.searchPlaceholder')}
            aria-label={t('permissionsDialog.searchPlaceholder')}
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('permissionsDialog.currentPageAccess')}
                </h3>
              </div>
              <div className="inline-flex flex-wrap rounded-md border border-gray-200 bg-white p-1">
                {(['ui', 'api', 'flags', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveInspectorTab(tab)}
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      activeInspectorTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab === 'ui'
                      ? t('permissionsDialog.uiAccessTab')
                      : tab === 'api'
                        ? t('permissionsDialog.apiAccessTab')
                        : tab === 'flags'
                          ? t('permissionsDialog.featureFlagsTab')
                          : t('permissionsDialog.allPermissionsTab')}
                  </button>
                ))}
              </div>
            </div>

            {activeInspectorTab === 'all' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">{t('permissionsDialog.allPermissionsHelp')}</p>
                {(permissions ?? []).length === 0 ? (
                  <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-red-600">
                    {t('permissionsDialog.noPermissionsLoaded')}
                  </p>
                ) : filteredUserPermissions.length === 0 ? (
                  <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
                    {t('permissionsDialog.noSearchResults')}
                  </p>
                ) : (
                  <div className="max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto pr-1">
                    {filteredUserPermissions.map((permissionCode) => (
                      <div
                        key={permissionCode}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <p className="break-all text-xs font-mono text-gray-700">{permissionCode}</p>
                        <RequirementBadge passed label={t('permissionsDialog.granted')} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentPageContract && pageEvaluation ? (
              activeInspectorTab === 'ui' ? (
                <div className="space-y-4">
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-medium">Page:</span> {currentPageContract.label}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">Path:</span> {effectivePath}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">Route Pattern:</span> {currentPageContract.routePattern}
                    </p>
                    {canViewPlatformInventories ? (
                      <p className="pt-1">
                        <Link
                          href={`/dashboard/help/platform-inventories?tab=contracts&route=${encodeURIComponent(currentPageContract.routePattern)}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          {t('permissionsDialog.viewFullInventory')}
                        </Link>
                      </p>
                    ) : null}
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
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</h4>
                      {Object.entries(currentPageContract.actions)
                        .filter(([actionKey, action]) => {
                          if (!normalizedPermissionSearch) return true
                          const haystack = [
                            actionKey,
                            action.label,
                            ...(action.requirement.permissions ?? []),
                            ...(action.requirement.featureFlags ?? []),
                            ...(action.notes ?? []),
                          ]
                            .join(' ')
                            .toLowerCase()
                          return haystack.includes(normalizedPermissionSearch)
                        })
                        .map(([actionKey, action]) => {
                          const actionEvaluation = evaluateAccessRequirement(action.requirement, {
                            userPermissions: permissions ?? [],
                            userWorkflowRoles: workflowRoles ?? [],
                            userTenantRole: currentTenant?.user_role ?? null,
                            featureFlags,
                          })

                          return (
                            <div
                              key={actionKey}
                              className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3"
                            >
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
                                  <RequirementDetailRow
                                    key={`${actionKey}:${detail.kind}:${detail.value}`}
                                    detail={detail}
                                  />
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
                      <span className="font-medium">{t('permissionsDialog.pageLabel')}</span>{' '}
                      {currentPageContract.label}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">{t('permissionsDialog.pathLabel')}</span> {effectivePath}
                    </p>
                  </div>

                  {(() => {
                    const filteredApiDependencies = (currentPageContract.apiDependencies ?? []).filter(
                      (dependency) => {
                        if (!normalizedPermissionSearch) return true
                        const haystack = [
                          dependency.label,
                          dependency.method,
                          dependency.path,
                          ...(dependency.requirement?.permissions ?? []),
                          ...(dependency.notes ?? []),
                        ]
                          .join(' ')
                          .toLowerCase()
                        return haystack.includes(normalizedPermissionSearch)
                      }
                    )

                    if (!filteredApiDependencies.length) {
                      return (
                        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                          {normalizedPermissionSearch
                            ? t('permissionsDialog.noSearchResults')
                            : t('permissionsDialog.noApiDependencies')}
                        </p>
                      )
                    }

                    return (
                      <div className="space-y-3">
                        {filteredApiDependencies.map((dependency) => {
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
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-medium">{t('permissionsDialog.pageLabel')}</span>{' '}
                      {currentPageContract.label}
                    </p>
                    <p className="break-all">
                      <span className="font-medium">{t('permissionsDialog.pathLabel')}</span> {effectivePath}
                    </p>
                  </div>

                  {(() => {
                    const filteredFlags = sortedFeatureFlags.filter(([flagKey]) =>
                      !normalizedPermissionSearch
                        ? true
                        : flagKey.toLowerCase().includes(normalizedPermissionSearch)
                    )

                    if (!filteredFlags.length) {
                      return (
                        <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                          {normalizedPermissionSearch
                            ? t('permissionsDialog.noSearchResults')
                            : t('permissionsDialog.noFeatureFlags')}
                        </p>
                      )
                    }

                    return (
                      <div className="space-y-3">
                        {filteredFlags.map(([flagKey, enabled]) => (
                          <div
                            key={flagKey}
                            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                {t('permissionsDialog.flagKeyLabel')}
                              </p>
                              <p className="break-all text-xs font-mono text-gray-700">{flagKey}</p>
                            </div>
                            <RequirementBadge
                              passed={enabled}
                              label={
                                enabled ? t('permissionsDialog.enabled') : t('permissionsDialog.disabled')
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )
                  })()}
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
                <p className="break-all font-mono text-xs text-gray-700">{effectivePath}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
