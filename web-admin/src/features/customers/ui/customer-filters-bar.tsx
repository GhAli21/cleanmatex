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

/**
 *
 * @param root0
 * @param root0.filters
 * @param root0.onFilterChange
 * @param root0.selectedCount
 */
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

  // No frame or margin of its own: CmxCrudPageShell frames the filters slot.
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-muted-foreground"
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
              className="block w-full ps-10 pe-3 py-2 border border-border rounded-md leading-5 bg-card placeholder:text-muted-foreground focus:outline-none focus:placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:border-ring sm:text-sm"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute inset-y-0 end-0 pe-3 flex items-center"
              >
                <svg
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
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
        <div className="flex items-center space-x-4">
          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-foreground">{t('type')}:</label>
            <select
              value={filters.type || 'all'}
              onChange={(e) =>
                handleTypeFilter(e.target.value as CustomerType | 'all')
              }
              dir={isRTL ? 'rtl' : 'ltr'}
              className="block w-32 ps-3 pe-10 py-2 text-base border-border focus:outline-none focus:ring-ring focus:border-ring sm:text-sm rounded-md"
            >
              <option value="all">{t('all')}</option>
              <option value="guest">{t('types.guest')}</option>
              <option value="stub">{t('types.stub')}</option>
              <option value="walk_in">{t('types.walk_in')}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-foreground">{t('status')}:</label>
            <select
              value={filters.status || 'all'}
              onChange={(e) =>
                handleStatusFilter(e.target.value as 'active' | 'inactive' | 'all')
              }
              dir={isRTL ? 'rtl' : 'ltr'}
              className="block w-32 ps-3 pe-10 py-2 text-base border-border focus:outline-none focus:ring-ring focus:border-ring sm:text-sm rounded-md"
            >
              <option value="all">{t('all')}</option>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-foreground">{t('sortBy')}</label>
            <select
              value={filters.sortBy || 'createdAt'}
              onChange={(e) => handleSortChange(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="block w-40 ps-3 pe-10 py-2 text-base border-border focus:outline-none focus:ring-ring focus:border-ring sm:text-sm rounded-md"
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
              className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm leading-4 font-medium rounded-md text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              <svg
                className="h-4 w-4 -ms-0.5 me-2"
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
        <div className="mt-4 px-4 py-2 bg-info-bg rounded-md">
          <p className="text-sm text-primary-text">
            {selectedCount} {selectedCount === 1 ? t('customer') : t('customers')} {t('selected')}
          </p>
        </div>
      )}
    </div>
  )
}
