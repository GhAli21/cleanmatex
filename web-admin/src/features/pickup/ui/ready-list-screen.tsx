'use client'

import { CmxCodeChip } from '@ui/data-display/cmx-code-chip'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useScreenOrders } from '@/lib/hooks/use-screen-orders'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { useWorkflowSystemMode } from '@/lib/config/workflow-config'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode } from '@/lib/money/format-money'
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot'
import type { CanonicalOrderFinancialRowLike } from '@/lib/utils/order-financial-snapshot'
import { normalizeOrderPaymentStatus } from '@/lib/utils/order-payment-status'
import { PickupReleaseStatus } from '@features/pickup/ui/pickup-release-status'
import { ReadyListFocusChips } from '@features/pickup/ui/ready-list-focus-chips'
import { resolveScan } from '@features/scan/api/scan-api'
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal'
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
import { CmxButton, CmxCard, CmxSelect, CmxSkeleton } from '@ui/primitives'
import { CmxEmptyState } from '@ui/data-display'
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults'
import { CmxStatusBadge, CmxSummaryMessage, type CmxBadgeTone } from '@ui/feedback'
import { CmxCodeSearchInput, type CodeSearchSubmit } from '@ui/forms/cmx-code-search-input'
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
  branch_id?: string | null
  currency_code?: string | null
  org_customers_mst?: { id?: string | null } | Array<{ id?: string | null }> | null
  pickup_release?: PickupReleaseSummary
  customer?: { name?: string; phone?: string }
}

interface ReadyListRow {
  id: string
  order_no: string
  customer: { id?: string | null; name: string; phone: string }
  branchId?: string | null
  currencyCode: string
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
  const tCollect = useTranslations('orders.collectPayment')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currencyCode, decimalPlaces } = useTenantCurrency()
  const canCollectPayment = useHasPermissionCode('orders:collect_payment')
  const moneyLocale = locale === 'ar' ? 'ar' : 'en'
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale })
  const { currentTenant } = useAuth()
  const useNewWorkflowSystem = useWorkflowSystemMode()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [sortBy, setSortBy] = useState('ready_by')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [collectionOrder, setCollectionOrder] = useState<ReadyListRow | null>(null)

  const query = useMemo(() => parseReadyListQuery(searchParams), [searchParams])
  const emptyKey = readyListEmptyKey(query)
  const apiFilters = readyListQueryToApiFilters(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { orders: rawOrders, pagination, isLoading, isFetching, error, refetch } = useScreenOrders<ReadyListApiOrder>('ready', {
    page: query.page,
    limit: CMX_DEFAULT_PAGE_SIZE,
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
          id: Array.isArray(order.org_customers_mst)
            ? order.org_customers_mst[0]?.id
            : order.org_customers_mst?.id,
          name: order.customer?.name || t('labels.unknownCustomer'),
          phone: order.customer?.phone || '',
        },
        branchId: order.branch_id,
        currencyCode: order.currency_code || currencyCode,
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
  }, [currencyCode, rawOrders, t])

  const listPath = readyListPath(query)

  const handleSearchSubmit = useCallback(
    async (submit: CodeSearchSubmit) => {
      if (submit.mode === 'text') {
        setDebouncedSearch(submit.text)
        return
      }
      const localMatch = orders.find(
        (o) => o.order_no.toLowerCase() === submit.code.toLowerCase(),
      )
      if (localMatch) {
        router.push(`/dashboard/ready/${localMatch.id}?returnUrl=${encodeURIComponent(listPath)}`)
        return
      }
      setScanBusy(true)
      try {
        const found = await resolveScan(submit.code, 'any')
        if (found.ok && found.data.order?.id) {
          router.push(`/dashboard/ready/${found.data.order.id}?returnUrl=${encodeURIComponent(listPath)}`)
          return
        }
      } catch {
        // Fall back to list search.
      } finally {
        setScanBusy(false)
      }
      setSearchInput(submit.code)
      setDebouncedSearch(submit.code)
    },
    [listPath, orders, router],
  )

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
    const tone: CmxBadgeTone = status === 'PAID'
      ? 'success'
      : status === 'PARTIALLY_PAID'
        ? 'warning'
        : 'neutral'
    return (
      <CmxStatusBadge
        size="sm"
        tone={tone}
        label={t(`ready.${key}`)}
      />
    )
  }

  const showInitialSkeleton = isLoading && orders.length === 0

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {query.desk ? t('ready.focus.counterTitle') : t('screens.ready')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {query.desk ? t('ready.focus.counterDescription') : t('ready.description')}
          </p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={() => void refetch()}
        >
          {tCommon('refresh')}
        </CmxButton>
      </div>

      <div className="mb-4">
        <ReadyListFocusChips query={query} onChange={replaceQuery} />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1" aria-busy={scanBusy || undefined}>
          <CmxCodeSearchInput
            value={searchInput}
            onChange={setSearch}
            onSubmit={(submit) => void handleSearchSubmit(submit)}
            placeholder={t('ready.searchPlaceholder')}
            aria-label={t('ready.searchPlaceholder')}
            disabled={scanBusy}
          />
        </div>
        <div className="flex gap-2">
          <CmxSelect
            fullWidth={false}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label={t('preparation.list.sortBy')}
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
            {sortOrder === 'asc' ? (
              <ArrowUp className="me-1.5 h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowDown className="me-1.5 h-4 w-4" aria-hidden="true" />
            )}
            {sortOrder === 'asc' ? t('ready.sortOrder.asc') : t('ready.sortOrder.desc')}
          </CmxButton>
        </div>
      </div>

      {error ? (
        <div className="mb-6 space-y-2">
          <CmxSummaryMessage type="error" title={t('ready.messages.loadFailed')} items={[error]} />
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            {tCommon('retry')}
          </CmxButton>
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
          {orders.map((order) => {
            const formattedReadyBy = order.ready_by && !Number.isNaN(new Date(order.ready_by).getTime())
              ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(order.ready_by),
              )
              : null

            return (
              <CmxCard key={order.id} className="h-full p-6 transition-shadow hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/ready/${order.id}?returnUrl=${encodeURIComponent(listPath)}`}
                    className="rounded text-xl font-bold text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                  </Link>
                    <div className="flex flex-col items-end gap-1">
                      <PickupReleaseStatus
                        release={order.pickup_release}
                        workflowStatus={order.current_status}
                      />
                      {paymentStatusBadge(order.payment_status)}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('labels.customer')}:</span>
                      <span>{order.customer.name}</span>
                    </div>
                    {order.customer.phone ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t('labels.phone')}:</span>
                        <span dir="ltr" className="inline-block tabular-nums [unicode-bidi:isolate]">
                          {order.customer.phone}
                        </span>
                      </div>
                    ) : null}
                    {order.rack_location ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t('ready.rack')}:</span>
                        <span className="font-bold text-foreground">{order.rack_location}</span>
                      </div>
                    ) : null}
                    {formattedReadyBy ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t('ready.sortBy.readyBy')}:</span>
                        <span className="tabular-nums">{formattedReadyBy}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t('ready.total')}:</span>
                      <bdi dir="ltr" className="font-bold text-foreground tabular-nums">
                        {fmt(Number(order.total ?? 0))}
                      </bdi>
                    </div>
                    {order.remaining > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t('ready.paymentSection.remainingDue')}:</span>
                        <bdi dir="ltr" className="font-bold text-warning-text tabular-nums">
                          {fmt(order.remaining)}
                        </bdi>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    <CmxButton asChild variant="primary" className="flex-1">
                      <Link href={`/dashboard/ready/${order.id}?returnUrl=${encodeURIComponent(listPath)}`}>
                        {t('ready.actions.open')}
                      </Link>
                    </CmxButton>
                    {canCollectPayment && order.remaining > 0.001 ? (
                      <CmxButton
                        type="button"
                        variant="outline"
                        onClick={() => setCollectionOrder(order)}
                      >
                        {tCollect('collectButton')}
                      </CmxButton>
                    ) : null}
                  </div>
                </CmxCard>
            )
          })}
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

      {collectionOrder ? (
        <OrderCollectPaymentModal
          open
          onOpenChange={(open) => {
            if (!open) setCollectionOrder(null)
          }}
          orderId={collectionOrder.id}
          customerId={collectionOrder.customer.id}
          branchId={collectionOrder.branchId}
          outstandingAmount={collectionOrder.remaining}
          currencyCode={collectionOrder.currencyCode}
          onCollected={() => {
            setCollectionOrder(null)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}
