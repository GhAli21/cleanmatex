'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useScreenOrders } from '@/lib/hooks/use-screen-orders'
import { useWorkflowSystemMode } from '@/lib/config/workflow-config'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode } from '@/lib/money/format-money'
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot'
import type { CanonicalOrderFinancialRowLike } from '@/lib/utils/order-financial-snapshot'
import { normalizeOrderPaymentStatus } from '@/lib/utils/order-payment-status'
import { PickupReleaseStatus } from '@features/pickup/ui/pickup-release-status'
import { ReadyListFocusChips } from '@features/pickup/ui/ready-list-focus-chips'
import {
  NOT_RELEASED_PICKUP_SUMMARY,
  type PickupReleaseSummary,
} from '@/lib/types/pickup-release'
import {
  parseReadyListQuery,
  readyListEmptyKey,
  readyListPath,
  readyListQueryToApiFilters,
  type ReadyListQuery,
} from '@/lib/constants/ready-list-focus'
import { CmxButton, CmxCard, CmxInput, CmxSelect, CmxSkeleton } from '@ui/primitives'
import { CmxEmptyState } from '@ui/data-display'
import { CmxSummaryMessage } from '@ui/feedback'
import { CmxPagination } from '@ui/navigation'
import { cn } from '@lib/utils'

interface ReadyListApiOrder extends CanonicalOrderFinancialRowLike {
  id: string
  order_no?: string | null
  current_status?: string | null
  status?: string | null
  rack_location?: string | null
  ready_by?: string | null
  ready_by_at_new?: string | null
  payment_status?: string | null
  payment_type_code?: string | null
  total_items?: number | null
  pickup_release?: PickupReleaseSummary
  customer?: { name?: string; phone?: string }
}

interface ReadyListRow {
  id: string
  order_no: string
  customer: { name: string; phone: string }
  total_items: number
  total: number
  remaining: number
  payment_status: string
  current_status: string
  rack_location: string
  ready_by: string
  pickup_release: PickupReleaseSummary
}

/**
 * Ready-area worklist. Desk filters stack in the URL so Pickup desk can alias
 * `/dashboard/ready?focus=counter` and still add due / rack / status toggles.
 */
export function ReadyListScreen() {
  const t = useTranslations('workflow')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currencyCode, decimalPlaces } = useTenantCurrency()
  const moneyLocale = locale === 'ar' ? 'ar' : 'en'
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale })
  const { currentTenant } = useAuth()
  const useNewWorkflowSystem = useWorkflowSystemMode()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('ready_by')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const query = useMemo(() => parseReadyListQuery(searchParams), [searchParams])
  const emptyKey = readyListEmptyKey(query)
  const apiFilters = readyListQueryToApiFilters(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { orders: rawOrders, pagination, isLoading, isFetching, error } = useScreenOrders<ReadyListApiOrder>('ready', {
    page: query.page,
    limit: 20,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
    additionalFilters: Object.keys(apiFilters).length > 0 ? apiFilters : undefined,
    keepPreviousData: true,
  })

  const orders: ReadyListRow[] = useMemo(() => {
    return (rawOrders ?? []).map((order) => {
      const financialSnapshot = readCanonicalOrderFinancialSnapshot(order)
      const remaining = financialSnapshot.outstandingAmount
      const paymentStatus = normalizeOrderPaymentStatus(order.payment_status, {
        paymentTypeCode: order.payment_type_code,
        payOnCollectionAmount: financialSnapshot.payOnCollectionAmount,
        outstandingAmount: remaining,
      })
      return {
        id: order.id,
        order_no: order.order_no || '',
        customer: {
          name: order.customer?.name || t('labels.unknownCustomer'),
          phone: order.customer?.phone || '',
        },
        total_items: order.total_items || 0,
        total: financialSnapshot.totalAmount,
        remaining,
        payment_status: paymentStatus,
        current_status: order.current_status || order.status || 'ready',
        rack_location: order.rack_location || '',
        ready_by: order.ready_by || order.ready_by_at_new || '',
        pickup_release: order.pickup_release ?? { ...NOT_RELEASED_PICKUP_SUMMARY },
      }
    })
  }, [rawOrders, t])

  const listPath = readyListPath(query)

  const replaceQuery = (next: ReadyListQuery) => {
    router.replace(readyListPath(next))
  }

  const setSearch = (value: string) => {
    setSearchInput(value)
    if (query.page > 1) {
      replaceQuery({ ...query, page: 1 })
    }
  }

  const paymentStatusBadge = (status: string) => {
    const key = status === 'PAID'
      ? 'paymentStatus.paid'
      : status === 'PARTIALLY_PAID'
        ? 'paymentStatus.partial'
        : 'paymentStatus.pending'
    const cls = status === 'PAID'
      ? 'bg-[rgb(var(--cmx-success-rgb,22_163_74)/0.12)] text-[rgb(var(--cmx-success-rgb,22_163_74))]'
      : status === 'PARTIALLY_PAID'
        ? 'bg-[rgb(var(--cmx-warning-rgb,217_119_6)/0.12)] text-[rgb(var(--cmx-warning-rgb,180_83_9))]'
        : 'bg-[rgb(var(--cmx-muted-rgb,241_245_249))] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
        {t(`ready.${key}`)}
      </span>
    )
  }

  const showInitialSkeleton = isLoading && orders.length === 0

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {query.desk ? t('ready.focus.counterTitle') : t('screens.ready')}
        </h1>
        <p className="mt-1 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {query.desk ? t('ready.focus.counterDescription') : t('ready.description')}
        </p>
      </div>

      <div className="mb-4">
        <ReadyListFocusChips query={query} onChange={replaceQuery} />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <CmxInput
            type="search"
            value={searchInput}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('ready.searchPlaceholder')}
            leftIcon={<Search className="h-4 w-4" aria-hidden />}
            aria-label={t('ready.searchPlaceholder')}
          />
        </div>
        <div className="flex gap-2">
          <CmxSelect
            fullWidth={false}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label={t('ready.sortBy.orderNo')}
            options={[
              { value: 'order_no', label: t('ready.sortBy.orderNo') },
              { value: 'received_at', label: t('ready.sortBy.receivedAt') },
              { value: 'ready_by', label: t('ready.sortBy.readyBy') },
              { value: 'total', label: t('ready.sortBy.total') },
            ]}
          />
          <CmxButton
            type="button"
            variant="outline"
            onClick={() => setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
          >
            {sortOrder === 'asc' ? t('ready.sortOrder.asc') : t('ready.sortOrder.desc')}
          </CmxButton>
        </div>
      </div>

      {error ? (
        <div className="mb-6">
          <CmxSummaryMessage type="error" title={t('ready.messages.loadFailed')} items={[error]} />
        </div>
      ) : null}

      {showInitialSkeleton ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CmxSkeleton className="h-48 w-full" />
          <CmxSkeleton className="h-48 w-full" />
          <CmxSkeleton className="h-48 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <CmxEmptyState
          title={t(`ready.focus.empty.${emptyKey}`)}
          description={t('ready.focus.emptyHint')}
        />
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
            isFetching ? 'opacity-70' : undefined,
          )}
        >
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/ready/${order.id}?returnUrl=${encodeURIComponent(listPath)}`}
              className="block"
            >
              <CmxCard className="h-full p-6 transition-shadow hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <h3 className="text-xl font-bold text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
                    {order.order_no}
                  </h3>
                  <div className="flex flex-col items-end gap-1">
                    <PickupReleaseStatus
                      release={order.pickup_release}
                      workflowStatus={order.current_status}
                    />
                    {paymentStatusBadge(order.payment_status)}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.customer')}:</span>
                    <span>{order.customer.name}</span>
                  </div>
                  {order.customer.phone ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('labels.phone')}:</span>
                      <span>{order.customer.phone}</span>
                    </div>
                  ) : null}
                  {order.rack_location ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('ready.rack')}:</span>
                      <span className="font-bold">{order.rack_location}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('ready.total')}:</span>
                    <span className="font-bold">{fmt(Number(order.total ?? 0))}</span>
                  </div>
                  {order.remaining > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('ready.paymentSection.remainingDue')}:</span>
                      <span className="font-bold">{fmt(order.remaining)}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] pt-4">
                  <span className="block w-full rounded-lg bg-[rgb(var(--cmx-success-rgb,22_163_74))] px-4 py-2 text-center text-white">
                    {t('ready.actions.open')}
                  </span>
                </div>
              </CmxCard>
            </Link>
          ))}
        </div>
      )}

      <CmxPagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.limit}
        totalItems={pagination.total}
        onPageChange={(page) => replaceQuery({ ...query, page })}
        onPageSizeChange={() => undefined}
        showPageSizeSelector={false}
        showWhenSinglePage={false}
        labels={{
          noItems: t(`ready.focus.empty.${emptyKey}`),
        }}
      />
    </div>
  )
}
