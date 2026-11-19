/**
 * PRD-003: Customer Table Component
 * Displays customer list with actions
 */

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { useLocale } from '@/lib/hooks/useRTL'
import type { CustomerListItem } from '@/lib/types/customer'

interface CustomerTableProps {
  customers: CustomerListItem[]
  loading: boolean
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  selectedCustomers: string[]
  onSelectCustomer: (customerId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onPageChange: (page: number) => void
  onRefresh: () => void
}

/**
 *
 * @param root0
 * @param root0.customers
 * @param root0.loading
 * @param root0.pagination
 * @param root0.selectedCustomers
 * @param root0.onSelectCustomer
 * @param root0.onSelectAll
 * @param root0.onPageChange
 * @param root0.onRefresh
 */
export default function CustomerTable({
  customers = [],
  loading = false,
  pagination = {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
  selectedCustomers = [],
  onSelectCustomer,
  onSelectAll,
  onPageChange,
  onRefresh,
}: CustomerTableProps) {
  const t = useTranslations('customers')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const allSelected =
    customers.length > 0 && selectedCustomers.length === customers.length

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('never')
    return new Date(dateString).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getTypeBadge = (type: string) => {
    const badges = {
      guest: 'bg-muted text-foreground',
      stub: 'bg-warning-bg text-warning-text',
      full: 'bg-success-bg text-success-text',
    }
    return badges[type as keyof typeof badges] || badges.guest
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow">
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-muted-foreground">{t('loadingCustomers')}</p>
        </div>
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">{t('noCustomersFound')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('getStartedCreateCustomer')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 text-primary-text focus:ring-ring border-border rounded"
                />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('customerName')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('contact')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('type')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('orders')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('points')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('lastOrder')}
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">{tCommon('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-muted">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.includes(customer.id)}
                    onChange={(e) =>
                      onSelectCustomer(customer.id, e.target.checked)
                    }
                    className="h-4 w-4 text-primary-text focus:ring-ring border-border rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-medium text-muted-foreground">
                          {customer.firstName?.charAt(0).toUpperCase()}
                          {customer.lastName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ms-4">
                      <div className="text-sm font-medium text-foreground">
                        {customer.displayName ||
                          `${customer.firstName} ${customer.lastName || ''}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {customer.customerNumber || t('noNumber')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {customer.phone || t('noPhone')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {customer.email || t('noEmail')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadge(
                      customer.type
                    )}`}
                  >
                    {t(`types.${customer.type}`) || (customer.type.charAt(0).toUpperCase() + customer.type.slice(1))}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-start">
                  {customer.totalOrders || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-start">
                  {customer.loyaltyPoints || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(customer.lastOrderAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-end">
                  <Link
                    href={`/dashboard/customers/${customer.id}`}
                    className="text-primary-text hover:text-primary-text/80"
                  >
                    {t('view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-card px-4 py-3 flex items-center border-t border-border sm:px-6 justify-between">
        <div className="flex-1 flex sm:hidden justify-between">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted disabled:opacity-50"
          >
            {t('previous')}
          </button>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted disabled:opacity-50 ms-3"
          >
            {t('next')}
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-foreground">
              {t('showing')}{' '}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              {t('to')}{' '}
              <span className="font-medium">
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}
              </span>{' '}
              {t('of')} <span className="font-medium">{pagination.total}</span> {t('results')}
            </p>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-s-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Page numbers */}
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === pagination.totalPages ||
                    (page >= pagination.page - 2 &&
                      page <= pagination.page + 2)
                )
                .map((page, index, array) => (
                  <span key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="relative inline-flex items-center px-4 py-2 border border-border bg-card text-sm font-medium text-foreground">
                        ...
                      </span>
                    )}
                    <button
                      onClick={() => onPageChange(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === pagination.page
                          ? 'z-10 bg-info-bg border-primary text-info-text'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {page}
                    </button>
                  </span>
                ))}

              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-e-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}
