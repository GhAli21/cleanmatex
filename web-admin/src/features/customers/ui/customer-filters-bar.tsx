/**
 * PRD-003: Customer Filters Bar
 * Search and filter controls for customer list
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <CmxInput
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('search')}
            dir={isRTL ? 'rtl' : 'ltr'}
            leftIcon={<Search className="h-5 w-5" />}
            rightIcon={
              searchInput ? (
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSearchInput('')}
                  className="h-6 w-6 p-0 pointer-events-auto"
                  aria-label={t('clear')}
                >
                  <X className="h-4 w-4" />
                </CmxButton>
              ) : undefined
            }
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Label className="shrink-0">{t('type')}:</Label>
            <div className="w-32">
              <CmxSelect
                value={filters.type || 'all'}
                onChange={(e) =>
                  handleTypeFilter(e.target.value as CustomerType | 'all')
                }
                dir={isRTL ? 'rtl' : 'ltr'}
                options={[
                  { value: 'all', label: t('all') },
                  { value: 'guest', label: t('types.guest') },
                  { value: 'stub', label: t('types.stub') },
                  { value: 'walk_in', label: t('types.walk_in') },
                ]}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Label className="shrink-0">{t('status')}:</Label>
            <div className="w-32">
              <CmxSelect
                value={filters.status || 'all'}
                onChange={(e) =>
                  handleStatusFilter(e.target.value as 'active' | 'inactive' | 'all')
                }
                dir={isRTL ? 'rtl' : 'ltr'}
                options={[
                  { value: 'all', label: t('all') },
                  { value: 'active', label: t('active') },
                  { value: 'inactive', label: t('inactive') },
                ]}
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <Label className="shrink-0">{t('sortBy')}</Label>
            <div className="w-40">
              <CmxSelect
                value={filters.sortBy || 'createdAt'}
                onChange={(e) => handleSortChange(e.target.value)}
                dir={isRTL ? 'rtl' : 'ltr'}
                options={[
                  { value: 'createdAt', label: t('newestFirst') },
                  { value: 'name', label: t('nameAZ') },
                  { value: 'lastOrderAt', label: t('recentOrder') },
                  { value: 'totalOrders', label: t('mostOrders') },
                ]}
              />
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <CmxButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
            >
              <X className="h-4 w-4 me-1.5" aria-hidden="true" />
              {t('clear')}
            </CmxButton>
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
