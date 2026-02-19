'use client'

/**
 * PRD-003: Customer Management Page
 *
 * Main customer list page with search, filters, and CRUD operations
 * Features:
 * - Customer list with pagination
 * - Search by name, phone, email, customer number
 * - Filter by type (guest/stub/full) and status (active/inactive)
 * - Quick customer creation (POS flow)
 * - Export to CSV
 * - Customer statistics cards
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { useAuth } from '@/lib/auth/auth-context'
import {
  fetchCustomers,
  fetchCustomerStats,
  exportCustomers,
  downloadCSV,
} from '@/lib/api/customers'
import { cmxMessage } from '@ui/feedback'
import type {
  CustomerListItem,
  CustomerSearchParams,
  CustomerStatistics,
} from '@/lib/types/customer'
import CustomerTable from '@features/customers/ui/customer-table'
import CustomerFiltersBar from '@features/customers/ui/customer-filters-bar'
import CustomerStatsCards from '@features/customers/ui/customer-stats-cards'
import CustomerCreateModal from '@features/customers/ui/customer-create-modal'

export default function CustomersPage() {
  const { currentTenant } = useAuth()
  const t = useTranslations('customers')
  const isRTL = useRTL()

  // State
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [stats, setStats] = useState<CustomerStatistics | null>(null)
  const [filters, setFilters] = useState<CustomerSearchParams>({
    search: '',
    type: undefined,
    status: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  // Fetch customers
  const loadCustomers = useCallback(async () => {
    if (!currentTenant) {
      setLoading(false)  // Stop loading state when no tenant
      return
    }

    setLoading(true)
    try {
      const params: CustomerSearchParams = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      }

      const { customers: fetchedCustomers, pagination: paginationData } =
        await fetchCustomers(params)

      setCustomers(fetchedCustomers || [])
      setPagination((prev) => ({
        ...prev,
        total: paginationData?.total ?? 0,
        totalPages: paginationData?.totalPages ?? 0,
      }))
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [currentTenant, pagination.page, pagination.limit, filters])

  // Fetch statistics
  const loadStats = useCallback(async () => {
    try {
      const statistics = await fetchCustomerStats()
      setStats(statistics)
    } catch {
      // Stats are optional; ignore failure
    }
  }, [])

  // Load customers on mount and when filters change
  useEffect(() => {
    if (currentTenant) {  // Only call when currentTenant is available
      loadCustomers()
    }
  }, [currentTenant, loadCustomers])  // Add currentTenant as dependency

  // Load statistics on mount
  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<CustomerSearchParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPagination((prev) => ({ ...prev, page: 1 })) // Reset to first page
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  // Handle customer creation success
  const handleCustomerCreated = () => {
    setShowCreateModal(false)
    loadCustomers()
    loadStats()
  }

  // Handle export
  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportCustomers({
        type: filters.type,
        status: filters.status,
      })

      const filename = `customers_${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(blob, filename)
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('errors.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  // Handle selection
  const handleSelectCustomer = (customerId: string, selected: boolean) => {
    setSelectedCustomers((prev) =>
      selected ? [...prev, customerId] : prev.filter((id) => id !== customerId)
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedCustomers(selected ? customers.map((c) => c.id) : [])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('manageDatabase')}
            </p>
          </div>

          <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <svg
                    className={`animate-spin h-4 w-4 text-gray-700 ${isRTL ? 'ml-2 -mr-1' : '-ml-1 mr-2'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('exporting')}
                </>
              ) : (
                <>
                  <svg
                    className={`h-5 w-5 text-gray-500 ${isRTL ? 'ml-2 -mr-1' : '-ml-1 mr-2'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {t('exportCSV')}
                </>
              )}
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className={`h-5 w-5 ${isRTL ? 'ml-2 -mr-1' : '-ml-1 mr-2'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t('addCustomer')}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && <CustomerStatsCards stats={stats} />}

      {/* Filters */}
      <CustomerFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        selectedCount={selectedCustomers.length}
      />

      {/* Customer Table */}
      <CustomerTable
        customers={customers}
        loading={loading}
        pagination={pagination}
        selectedCustomers={selectedCustomers}
        onSelectCustomer={handleSelectCustomer}
        onSelectAll={handleSelectAll}
        onPageChange={handlePageChange}
        onRefresh={loadCustomers}
      />

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CustomerCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCustomerCreated}
        />
      )}
    </div>
  )
}
