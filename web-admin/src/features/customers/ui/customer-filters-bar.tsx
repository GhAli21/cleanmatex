/**
 * PRD-003: Customer Filters Bar
 * Search and filter controls for customer list
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import type { CustomerSearchParams, CustomerType } from '@/lib/types/customer'

interface CustomerFiltersBarProps {
  filters: CustomerSearchParams
  onFilterChange: (filters: Partial<CustomerSearchParams>) => void
  selectedCount?: number
}

export default function CustomerFiltersBar({
  filters,
  onFilterChange,
  selectedCount = 0,
}: CustomerFiltersBarProps) {
  const t = useTranslations('customers')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
  const [searchInput, setSearchInput] = useState(filters.search || '')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, filters.search, onFilterChange])

  const handleTypeFilter = (type: CustomerType | 'all') => {
    onFilterChange({ type: type === 'all' ? undefined : type })
  }

  const handleStatusFilter = (status: 'active' | 'inactive' | 'all') => {
    onFilterChange({ status: status === 'all' ? undefined : status })
  }

  const handleSortChange = (sortBy: string) => {
    onFilterChange({ sortBy: sortBy as any })
  }

  const handleClearFilters = () => {
    setSearchInput('')
    onFilterChange({
      search: '',
      type: undefined,
      status: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
  }

  const hasActiveFilters =
    filters.search ||
    filters.type ||
    filters.status ||
    (filters.sortBy && filters.sortBy !== 'createdAt')

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className={`flex flex-col md:flex-row md:items-center ${isRTL ? 'md:flex-row-reverse md:justify-between' : 'md:justify-between'} space-y-4 md:space-y-0`}>
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('search')}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`block w-full ${isRTL ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className={`absolute inset-y-0 ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center`}
              >
                <svg
                  className="h-5 w-5 text-gray-400 hover:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
          {/* Type Filter */}
          <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
            <label className="text-sm font-medium text-gray-700">{t('type')}:</label>
            <select
              value={filters.type || 'all'}
              onChange={(e) =>
                handleTypeFilter(e.target.value as CustomerType | 'all')
              }
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`block w-32 ${isRTL ? 'pr-10 pl-3 text-right' : 'pl-3 pr-10'} py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md`}
            >
              <option value="all">{t('all')}</option>
              <option value="guest">{t('types.guest')}</option>
              <option value="stub">{t('types.stub')}</option>
              <option value="full">{t('types.full')}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
            <label className="text-sm font-medium text-gray-700">{t('status')}:</label>
            <select
              value={filters.status || 'all'}
              onChange={(e) =>
                handleStatusFilter(e.target.value as 'active' | 'inactive' | 'all')
              }
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`block w-32 ${isRTL ? 'pr-10 pl-3 text-right' : 'pl-3 pr-10'} py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md`}
            >
              <option value="all">{t('all')}</option>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>

          {/* Sort By */}
          <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
            <label className="text-sm font-medium text-gray-700">{t('sortBy')}</label>
            <select
              value={filters.sortBy || 'createdAt'}
              onChange={(e) => handleSortChange(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`block w-40 ${isRTL ? 'pr-10 pl-3 text-right' : 'pl-3 pr-10'} py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md`}
            >
              <option value="createdAt">{t('newestFirst')}</option>
              <option value="name">{t('nameAZ')}</option>
              <option value="lastOrderAt">{t('recentOrder')}</option>
              <option value="totalOrders">{t('mostOrders')}</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <svg
                className={`h-4 w-4 ${isRTL ? 'ml-2 -mr-0.5' : '-ml-0.5 mr-2'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      {/* Selected Count */}
      {selectedCount > 0 && (
        <div className="mt-4 px-4 py-2 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            {selectedCount} {selectedCount === 1 ? t('customer') : t('customers')} {t('selected')}
          </p>
        </div>
      )}
    </div>
  )
}
