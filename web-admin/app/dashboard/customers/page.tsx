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
import { useAuth } from '@/lib/auth/auth-context'
import {
  fetchCustomers,
  fetchCustomerStats,
  exportCustomers,
  downloadCSV,
} from '@/lib/api/customers'
import { cmxMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives'
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell'
import { Download, Plus } from 'lucide-react'
import type {
  CustomerListItem,
  CustomerSearchParams,
  CustomerStatistics,
} from '@/lib/types/customer'
import CustomerTable from '@features/customers/ui/customer-table'
import CustomerFiltersBar from '@features/customers/ui/customer-filters-bar'
import CustomerStatsCards from '@features/customers/ui/customer-stats-cards'
import CustomerCreateModal from '@features/customers/ui/customer-create-modal'

/**
 *
 */
export default function CustomersPage() {
  const { currentTenant } = useAuth()
  const t = useTranslations('customers')

  // State
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [stats, setStats] = useState<CustomerStatistics | null>(null)
  const [filters, setFilters] = useState<CustomerSearchParams>({
    search: '',
    type: undefined,
    status: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    excludeB2b: true, // This screen is for guest/stub/walk_in only
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
        excludeB2b: true,
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
    <CmxCrudPageShell
      className="min-h-screen bg-muted p-6"
      title={t('title')}
      subtitle={t('manageDatabase')}
      actions={
        <>
          <CmxButton variant="outline" onClick={handleExport} loading={exporting}>
            {exporting ? t('exporting') : (
              <>
                <Download className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {t('exportCSV')}
              </>
            )}
          </CmxButton>
          <CmxButton onClick={() => setShowCreateModal(true)}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            {t('addCustomer')}
          </CmxButton>
        </>
      }
      kpis={stats ? <CustomerStatsCards stats={stats} /> : undefined}
      filters={
        <CustomerFiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          selectedCount={selectedCustomers.length}
        />
      }
    >
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
          hideB2B
        />
      )}
    </CmxCrudPageShell>
  )
}
