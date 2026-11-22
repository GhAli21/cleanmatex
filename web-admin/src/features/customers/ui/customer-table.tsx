/**
 * PRD-003: Customer Table Component
 * Displays customer list with actions
 */

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  CmxButton,
  CmxCheckbox,
  CmxSpinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives'
import { CmxStatusBadge } from '@ui/feedback'
import { CmxPagination } from '@ui/navigation'
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults'
import { CmxPhoneDisplay } from '@ui/data-display'
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
  onPageSizeChange?: (size: number) => void
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
    limit: CMX_DEFAULT_PAGE_SIZE,
    total: 1,
    totalPages: 1,
  },
  selectedCustomers = [],
  onSelectCustomer,
  onSelectAll,
  onPageChange,
  onPageSizeChange,
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

  const getTypeTone = (type: string): 'neutral' | 'warning' | 'success' => {
    if (type === 'stub') return 'warning'
    if (type === 'full') return 'success'
    return 'neutral'
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow">
        <div className="p-12 text-center">
          <div className="inline-flex justify-center">
            <CmxSpinner size="lg" />
          </div>
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
        <Table className="min-w-full divide-y divide-border">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead scope="col" className="w-12 px-6 py-3">
                <CmxCheckbox
                  size="sm"
                  aria-label={t('selectAll') || 'Select all customers'}
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </TableHead>
              <TableHead
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('customerName')}
              </TableHead>
              <TableHead
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('contact')}
              </TableHead>
              <TableHead
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('type')}
              </TableHead>
              <TableHead
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('orders')}
              </TableHead>
              <TableHead
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('points')}
              </TableHead>
              <TableHead
                scope="col"
                className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-start"
              >
                {t('lastOrder')}
              </TableHead>
              <TableHead scope="col" className="relative px-6 py-3">
                <span className="sr-only">{tCommon('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-card divide-y divide-border">
            {customers.map((customer) => (
              <TableRow key={customer.id} className="hover:bg-muted">
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <CmxCheckbox
                    size="sm"
                    aria-label={customer.displayName || `${customer.firstName} ${customer.lastName || ''}`}
                    checked={selectedCustomers.includes(customer.id)}
                    onChange={(e) =>
                      onSelectCustomer(customer.id, e.target.checked)
                    }
                  />
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">
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
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {customer.customerNumber ? (
                          <bdi dir="ltr">{customer.customerNumber}</bdi>
                        ) : (
                          t('noNumber')
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-start">
                  <div className="text-sm text-foreground text-start">
                    <CmxPhoneDisplay value={customer.phone} fallback={t('noPhone')} />
                  </div>
                  <div className="text-sm text-muted-foreground text-start">
                    {customer.email ? <bdi dir="ltr">{customer.email}</bdi> : t('noEmail')}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <CmxStatusBadge size="sm" tone={getTypeTone(customer.type)}>
                    {t(`types.${customer.type}`) || (customer.type.charAt(0).toUpperCase() + customer.type.slice(1))}
                  </CmxStatusBadge>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-start tabular-nums">
                  {customer.totalOrders || 0}
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-start tabular-nums">
                  {customer.loyaltyPoints || 0}
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                  {formatDate(customer.lastOrderAt)}
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-end">
                  <CmxButton variant="ghost" size="xs" className="px-0 h-auto" asChild>
                    <Link href={`/dashboard/customers/${customer.id}`}>
                      {t('view')}
                    </Link>
                  </CmxButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <CmxPagination
        currentPage={pagination.page}
        totalPages={Math.max(1, pagination.totalPages)}
        pageSize={pagination.limit}
        totalItems={pagination.total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange ?? (() => {})}
        showPageSizeSelector={Boolean(onPageSizeChange)}
        showWhenSinglePage
      />
    </div>
  )
}
