'use client'

/**
 * User Filters Bar Component
 *
 * Search, filters, and bulk actions for the user list.
 * Bulk actions (activate/deactivate) call platform-api directly.
 * No Supabase imports.
 */

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
import { useAuth } from '@/lib/auth/auth-context'
import { activateUser, deactivateUser } from '@/lib/api/users'
import { cmxMessage } from '@ui/feedback'
import type { UserFilters } from '@/lib/api/users'

interface UserFiltersBarProps {
  filters: UserFilters
  onFilterChange: (filters: Partial<UserFilters>) => void
  selectedCount: number
  /** IDs of currently selected users — required for bulk actions */
  selectedUserIds?: string[]
  onBulkActionComplete?: () => void
  /** Optional dynamic role list. If provided, overrides the hardcoded role options. */
  availableRoles?: { code: string; name: string }[]
}

/**
 *
 * @param root0
 * @param root0.filters
 * @param root0.onFilterChange
 * @param root0.selectedCount
 * @param root0.selectedUserIds
 * @param root0.onBulkActionComplete
 * @param root0.availableRoles
 */
export default function UserFiltersBar({
  filters,
  onFilterChange,
  selectedCount,
  selectedUserIds = [],
  onBulkActionComplete,
  availableRoles,
}: UserFiltersBarProps) {
  const t = useTranslations('users.filters')
  const tTable = useTranslations('users.table')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')

  const { currentTenant, session } = useAuth()
  const accessToken = session?.access_token ?? ''
  const tenantId = currentTenant?.tenant_id ?? ''

  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value })
  }

  const handleRoleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ role: e.target.value })
  }

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ status: e.target.value })
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortBy: e.target.value })
  }

  const handleClearFilters = () => {
    onFilterChange({
      search: '',
      role: 'all',
      status: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
    })
  }

  const handleBulkActivate = async () => {
    if (!selectedUserIds.length || !tenantId) return
    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedUserIds.map((id) => activateUser(tenantId, id, accessToken))
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        cmxMessage.error(`${failed} user(s) failed to activate`)
      } else {
        cmxMessage.success(`${selectedUserIds.length} user(s) activated`)
      }
      onBulkActionComplete?.()
    } catch (error) {
      console.error('Bulk activate error:', error)
      cmxMessage.error(tCommon('error'))
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDeactivate = async () => {
    if (!selectedUserIds.length || !tenantId) return
    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedUserIds.map((id) => deactivateUser(tenantId, id, accessToken))
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        cmxMessage.error(`${failed} user(s) failed to deactivate`)
      } else {
        cmxMessage.success(`${selectedUserIds.length} user(s) deactivated`)
      }
      onBulkActionComplete?.()
    } catch (error) {
      console.error('Bulk deactivate error:', error)
      cmxMessage.error(tCommon('error'))
    } finally {
      setBulkActionLoading(false)
    }
  }

  const hasActiveFilters = filters.search || filters.role !== 'all' || filters.status !== 'all'

  // Use dynamic roles if provided, fall back to hardcoded defaults
  const tModal = useTranslations('users.modal.roles')
  const roleOptions = availableRoles
    ? availableRoles.map((r) => ({ value: r.code, label: r.name }))
    : [
        { value: 'admin', label: tModal('admin') },
        { value: 'operator', label: tModal('operator') },
        { value: 'viewer', label: tModal('viewer') },
      ]

  return (
    <div className="bg-card rounded-lg shadow">
      {/* Search and Filters */}
      <div className="p-4 space-y-4">
        {/* Search Bar */}
        <CmxInput
          type="text"
          placeholder={t('searchPlaceholder')}
          value={filters.search || ''}
          onChange={handleSearch}
          leftIcon={<Search className="h-5 w-5" />}
        />

        {/* Filters Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {/* Role Filter */}
          <div>
            <Label htmlFor="role-filter" className="mb-1 block">
              {tSettings('role')}
            </Label>
            <CmxSelect
              id="role-filter"
              value={filters.role || 'all'}
              onChange={handleRoleFilter}
              options={[
                { value: 'all', label: t('allRoles') },
                ...roleOptions,
              ]}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Label htmlFor="status-filter" className="mb-1 block">
              {tCommon('status')}
            </Label>
            <CmxSelect
              id="status-filter"
              value={filters.status || 'all'}
              onChange={handleStatusFilter}
              options={[
                { value: 'all', label: t('allStatus') },
                { value: 'active', label: tCommon('active') },
                { value: 'inactive', label: tCommon('inactive') },
              ]}
            />
          </div>

          {/* Sort By */}
          <div>
            <Label htmlFor="sort-filter" className="mb-1 block">
              {t('sortBy')}
            </Label>
            <CmxSelect
              id="sort-filter"
              value={filters.sortBy || 'created_at'}
              onChange={handleSortChange}
              options={[
                { value: 'created_at', label: t('dateCreated') },
                { value: 'email', label: tSettings('email') },
                { value: 'name', label: tCommon('name') },
                { value: 'role', label: tSettings('role') },
                { value: 'last_login', label: t('lastLogin') },
              ]}
            />
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <CmxButton
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="w-full"
            >
              {tCommon('clearFilters')}
            </CmxButton>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <div className="bg-info-bg border-t border-info-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-primary-text me-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium text-primary-text tabular-nums">
                {t('selectedCount', { count: selectedCount })}
              </span>
            </div>

            <div className="flex space-x-3">
              {bulkActionLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary me-2"></div>
                  <span className="text-sm text-primary-text">{t('processing')}</span>
                </div>
              ) : (
                <>
                  <CmxButton
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={handleBulkActivate}
                    disabled={selectedUserIds.length === 0}
                    className="text-success-text bg-success-bg hover:bg-success-border/50"
                  >
                    {tTable('activate')}
                  </CmxButton>
                  <CmxButton
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={handleBulkDeactivate}
                    disabled={selectedUserIds.length === 0}
                    className="text-warning-text bg-warning-bg hover:bg-warning-border/50"
                  >
                    {tTable('deactivate')}
                  </CmxButton>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="bg-muted border-t border-border px-4 py-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('activeFilters')}</span>
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-info-bg text-info-text">
                {tCommon('search')}: &quot;{filters.search}&quot;
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onFilterChange({ search: '' })}
                  className="ms-1 h-4 w-4 p-0"
                  aria-label={tCommon('clear')}
                >
                  <X className="h-3 w-3" />
                </CmxButton>
              </span>
            )}
            {filters.role && filters.role !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-info-bg text-info-text">
                {tSettings('role')}: {filters.role}
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onFilterChange({ role: 'all' })}
                  className="ms-1 h-4 w-4 p-0"
                  aria-label={tCommon('clear')}
                >
                  <X className="h-3 w-3" />
                </CmxButton>
              </span>
            )}
            {filters.status && filters.status !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-bg text-success-text">
                {tCommon('status')}: {filters.status}
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onFilterChange({ status: 'all' })}
                  className="ms-1 h-4 w-4 p-0"
                  aria-label={tCommon('clear')}
                >
                  <X className="h-3 w-3" />
                </CmxButton>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
