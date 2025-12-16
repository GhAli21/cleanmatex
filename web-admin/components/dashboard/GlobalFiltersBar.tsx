'use client'

/**
 * Global Filters Bar Component
 *
 * Provides global filtering capabilities across pages:
 * - Date range selection
 * - Branch selector
 * - Status filters
 * - Priority filters
 *
 * Features:
 * - URL query parameter synchronization
 * - Persistent filter state
 * - Bilingual support (EN/AR)
 * - RTL-aware layout
 * - Clear filters option
 */

import { useState, useEffect } from 'react'
import { Calendar, Building2, Filter, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

export interface GlobalFilters {
  dateFrom?: string
  dateTo?: string
  branchId?: string
  status?: string[]
  priority?: string[]
}

interface GlobalFiltersBarProps {
  filters: GlobalFilters
  onFiltersChange: (filters: GlobalFilters) => void
  availableBranches?: Array<{ id: string; name: string }>
  availableStatuses?: Array<{ value: string; label: string }>
  availablePriorities?: Array<{ value: string; label: string }>
  showBranchFilter?: boolean
  showStatusFilter?: boolean
  showPriorityFilter?: boolean
  showDateFilter?: boolean
}

export function GlobalFiltersBar({
  filters,
  onFiltersChange,
  availableBranches = [],
  availableStatuses = [],
  availablePriorities = [],
  showBranchFilter = true,
  showStatusFilter = true,
  showPriorityFilter = false,
  showDateFilter = true
}: GlobalFiltersBarProps) {
  const t = useTranslations('common')
  const [isExpanded, setIsExpanded] = useState(false)
  const [localFilters, setLocalFilters] = useState<GlobalFilters>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const hasActiveFilters = () => {
    return !!(
      localFilters.dateFrom ||
      localFilters.dateTo ||
      localFilters.branchId ||
      localFilters.status?.length ||
      localFilters.priority?.length
    )
  }

  const clearFilters = () => {
    const emptyFilters: GlobalFilters = {}
    setLocalFilters(emptyFilters)
    onFiltersChange(emptyFilters)
  }

  const handleDateFromChange = (value: string) => {
    const newFilters = { ...localFilters, dateFrom: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleDateToChange = (value: string) => {
    const newFilters = { ...localFilters, dateTo: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleBranchChange = (value: string) => {
    const newFilters = { ...localFilters, branchId: value || undefined }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleStatusToggle = (value: string) => {
    const currentStatuses = localFilters.status || []
    const newStatuses = currentStatuses.includes(value)
      ? currentStatuses.filter(s => s !== value)
      : [...currentStatuses, value]

    const newFilters = {
      ...localFilters,
      status: newStatuses.length > 0 ? newStatuses : undefined
    }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handlePriorityToggle = (value: string) => {
    const currentPriorities = localFilters.priority || []
    const newPriorities = currentPriorities.includes(value)
      ? currentPriorities.filter(p => p !== value)
      : [...currentPriorities, value]

    const newFilters = {
      ...localFilters,
      priority: newPriorities.length > 0 ? newPriorities : undefined
    }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const activeFilterCount = [
    localFilters.dateFrom,
    localFilters.dateTo,
    localFilters.branchId,
    localFilters.status?.length,
    localFilters.priority?.length
  ].filter(Boolean).length

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-3">
        {/* Filter Toggle Button */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:text-gray-900 rounded-md transition-colors border border-transparent hover:border-gray-300"
          >
            <Filter className="h-4 w-4" />
            <span>{t('filters')}</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters() && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
              <span>{t('clearFilters')}</span>
            </button>
          )}
        </div>

        {/* Filters Grid */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-gray-200">
            {/* Date Range Filter */}
            {showDateFilter && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    {t('dateFrom')}
                  </label>
                  <input
                    type="date"
                    value={localFilters.dateFrom || ''}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    {t('dateTo')}
                  </label>
                  <input
                    type="date"
                    value={localFilters.dateTo || ''}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* Branch Filter */}
            {showBranchFilter && availableBranches.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="inline h-4 w-4 mr-1" />
                  {t('branch')}
                </label>
                <select
                  value={localFilters.branchId || ''}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('allBranches')}</option>
                  {availableBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            {showStatusFilter && availableStatuses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('status')}
                </label>
                <div className="space-y-2">
                  {availableStatuses.map((status) => (
                    <label key={status.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.status?.includes(status.value) || false}
                        onChange={() => handleStatusToggle(status.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Filter */}
            {showPriorityFilter && availablePriorities.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('priority')}
                </label>
                <div className="space-y-2">
                  {availablePriorities.map((priority) => (
                    <label key={priority.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={localFilters.priority?.includes(priority.value) || false}
                        onChange={() => handlePriorityToggle(priority.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">{priority.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
