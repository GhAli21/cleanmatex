'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import type { SortingState } from '@tanstack/react-table'
import { ClipboardList, ExternalLink, RefreshCw } from 'lucide-react'
import { CmxButton } from '@ui/primitives'
import { CmxDataTable, CmxEmptyState } from '@ui/data-display'
import type { CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable'
import { CmxSummaryMessage, CmxStatusBadge, useMessage } from '@ui/feedback'

import { useWorkboard } from '@features/workboard/hooks/use-workboard'
import type {
  WorkboardOrderRow,
  WorkboardOwnerScreenKey,
  WorkboardQueryInput,
  WorkboardSort,
} from '@features/workboard/model/workboard-types'
import { WorkboardFilterToolbar } from '@features/workboard/ui/workboard-filter-toolbar'
import { WorkboardOverviewCards } from '@features/workboard/ui/workboard-overview-cards'

function formatAge(minutes: number, t: ReturnType<typeof useTranslations>): string {
  if (minutes < 60) return t('age.minutes', { count: minutes })
  if (minutes < 1_440) return t('age.hours', { count: Math.floor(minutes / 60) })
  return t('age.days', { count: Math.floor(minutes / 1_440) })
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatPriorityLabel(value: string, t: ReturnType<typeof useTranslations>): string {
  return t('priority.label', {
    value: value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  })
}

function isOverdue(row: WorkboardOrderRow): boolean {
  return !!row.readyByAt && new Date(row.readyByAt).getTime() < Date.now()
}

function isDueToday(row: WorkboardOrderRow): boolean {
  if (!row.readyByAt) {
    return false
  }

  const dueAt = new Date(row.readyByAt)
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  return dueAt.getTime() >= now.getTime() && dueAt.getTime() <= endOfToday.getTime()
}

function ownerBadgeVariant(ownerScreenKey: WorkboardOwnerScreenKey): Parameters<typeof CmxStatusBadge>[0]['variant'] {
  switch (ownerScreenKey) {
    case 'preparation':
      return 'info'
    case 'processing':
      return 'processing'
    case 'assembly':
      return 'default'
    case 'qa':
      return 'success'
    case 'packing':
      return 'outline'
    case 'ready_release':
      return 'success'
    case 'driver_delivery':
      return 'warning'
  }
}

/** Keeps table-header interaction aligned with the server's paginated ordering contract. */
function sortingFromWorkboardSort(sort: WorkboardSort): SortingState {
  const [column, direction] = sort.split(/_(?=[^_]+$)/) as [string, 'asc' | 'desc']
  const columnBySort: Record<string, string> = {
    age: 'age',
    ready_by: 'readyBy',
    order_no: 'order',
    customer: 'customer',
    stage: 'stage',
    priority: 'priority',
    assignee: 'assignee',
  }

  return [{ id: columnBySort[column] ?? 'age', desc: direction === 'desc' }]
}

/** Converts a CmxDataTable header choice into an API-owned sort value. */
function workboardSortFromSorting(sorting: SortingState): WorkboardSort {
  const next = sorting[0]
  if (!next) return 'age_desc'

  const prefixByColumn: Record<string, string> = {
    order: 'order_no',
    customer: 'customer',
    stage: 'stage',
    age: 'age',
    readyBy: 'ready_by',
    priority: 'priority',
    assignee: 'assignee',
  }
  const prefix = prefixByColumn[next.id]
  return prefix ? `${prefix}_${next.desc ? 'desc' : 'asc'}` as WorkboardSort : 'age_desc'
}

/** Preserves the supervisor's current queue context when a stage opens from Workboard. */
function buildWorkboardReturnUrl(input: WorkboardQueryInput): string {
  const params = new URLSearchParams()
  params.set('page', String(input.page))
  params.set('pageSize', String(input.pageSize))
  params.set('sort', input.sort ?? 'age_desc')

  if (input.search) params.set('search', input.search)
  if (input.branchId) params.set('branchId', input.branchId)
  if (input.assigneeId) params.set('assigneeId', input.assigneeId)
  if (input.priority) params.set('priority', input.priority)
  if (input.ownerScreenKey) params.set('ownerScreenKey', input.ownerScreenKey)
  if (input.blocker && input.blocker !== 'all') params.set('blocker', input.blocker)
  if (input.sla && input.sla !== 'all') params.set('sla', input.sla)

  return `/dashboard/workboard?${params.toString()}`
}

/** Supervisor view that triages work and routes it to the stage that owns actions. */
export function WorkboardScreen() {
  const t = useTranslations('workboard')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const message = useMessage()
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  const [pageSize, setPageSize] = useState(() => {
    const value = Number(searchParams.get('pageSize')) || 25
    return [10, 25, 50, 100].includes(value) ? value : 25
  })
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [branchId, setBranchId] = useState<string | undefined>(() => searchParams.get('branchId') ?? undefined)
  const [assigneeId, setAssigneeId] = useState<string | undefined>(() => searchParams.get('assigneeId') ?? undefined)
  const [priority, setPriority] = useState<string | undefined>(() => searchParams.get('priority') ?? undefined)
  const [ownerScreenKey, setOwnerScreenKey] = useState<WorkboardOwnerScreenKey | undefined>(() => {
    const value = searchParams.get('ownerScreenKey')
    return value === 'preparation' || value === 'processing' || value === 'assembly' || value === 'qa'
      || value === 'packing' || value === 'ready_release' || value === 'driver_delivery'
      ? value
      : undefined
  })
  const [blocker, setBlocker] = useState<WorkboardQueryInput['blocker']>(() => {
    const value = searchParams.get('blocker')
    return value === 'blocked' || value === 'clear' ? value : 'all'
  })
  const [sla, setSla] = useState<WorkboardQueryInput['sla']>(() => {
    const value = searchParams.get('sla')
    return value === 'overdue' || value === 'due_today' || value === 'not_due' ? value : 'all'
  })
  const [sort, setSort] = useState<WorkboardSort>(() => {
    const value = searchParams.get('sort')
    const supported: WorkboardSort[] = ['age_desc', 'age_asc', 'ready_by_asc', 'ready_by_desc', 'order_no_asc', 'order_no_desc', 'customer_asc', 'customer_desc', 'stage_asc', 'stage_desc', 'priority_asc', 'priority_desc', 'assignee_asc', 'assignee_desc']
    return supported.includes(value as WorkboardSort) ? value as WorkboardSort : 'age_desc'
  })
  const deferredSearch = useDeferredValue(search.trim())

  const query = useMemo<WorkboardQueryInput>(() => ({
    page,
    pageSize,
    search: deferredSearch || undefined,
    branchId,
    assigneeId,
    priority,
    ownerScreenKey,
    blocker,
    sla,
    sort,
  }), [assigneeId, blocker, branchId, deferredSearch, ownerScreenKey, page, pageSize, priority, sla, sort])
  const { data, error, isLoading, isFetching, refetch } = useWorkboard(query)
  const workboardReturnUrl = useMemo(() => buildWorkboardReturnUrl(query), [query])

  const resetPage = () => setPage(1)
  const resetFilters = () => {
    setSearch('')
    setBranchId(undefined)
    setAssigneeId(undefined)
    setPriority(undefined)
    setOwnerScreenKey(undefined)
    setBlocker('all')
    setSla('all')
    setPage(1)
  }

  const hasActiveFilters = !!(
    search.trim()
    || branchId
    || assigneeId
    || priority
    || ownerScreenKey
    || blocker !== 'all'
    || sla !== 'all'
  )

  const handleRefresh = async () => {
    try {
      await message.handlePromise(
        refetch().then((result) => {
          if (result.error) {
            throw result.error
          }

          return result
        }),
        {
          loading: t('messages.refreshLoading'),
          success: t('messages.refreshSuccess'),
          error: t('messages.refreshError'),
        },
      )
    } catch {
      // Message feedback is already handled above.
    }
  }

  const columns = useMemo<CmxDataTableSimpleColumn<WorkboardOrderRow>[]>(() => [
    {
      key: 'order',
      header: t('columns.order'),
      sortable: true,
      render: (row) => (
        <div className="space-y-1">
          <div className="font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{row.orderNo}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {row.customerPhone ?? t('noPhone')}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('columns.customer'),
      sortable: true,
      render: (row) => (
        <div className="space-y-1">
          <div className="font-medium">{row.customerName}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {row.branchName ?? t('noBranch')}
          </div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: t('columns.branch'),
      sortable: false,
      render: (row) => (
        <span className="text-sm">{row.branchName ?? t('noBranch')}</span>
      ),
    },
    {
      key: 'stage',
      header: t('columns.stage'),
      sortable: true,
      render: (row) => (
        <div className="space-y-1">
          <CmxStatusBadge
            label={locale === 'ar' && row.statusName2 ? row.statusName2 : row.statusName}
            size="sm"
            variant={ownerBadgeVariant(row.ownerScreenKey)}
          />
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t(`owners.${row.ownerScreenKey}`)}
          </div>
        </div>
      ),
    },
    {
      key: 'age',
      header: t('columns.age'),
      sortable: true,
      render: (row) => (
        <div className="text-sm">
          <div className={isOverdue(row) ? 'font-semibold text-[rgb(var(--cmx-destructive-rgb,220_38_38))]' : 'font-medium'}>
            {formatAge(row.ageMinutes, t)}
          </div>
        </div>
      ),
    },
    {
      key: 'readyBy',
      header: t('columns.readyBy'),
      sortable: true,
      render: (row) => (
        <div className="text-sm">
          <div className={isOverdue(row) ? 'font-semibold text-[rgb(var(--cmx-destructive-rgb,220_38_38))]' : 'font-medium'}>
            {row.readyByAt ? formatDateTime(row.readyByAt, locale) : t('noDueDate')}
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: t('columns.priority'),
      sortable: true,
      render: (row) => (
        row.priority
          ? (
            <CmxStatusBadge
              label={formatPriorityLabel(row.priority, t)}
              size="sm"
              variant="outline"
            />
          )
          : <span className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('noPriority')}</span>
      ),
    },
    {
      key: 'assignee',
      header: t('columns.assignee'),
      sortable: true,
      render: (row) => (
        <div className="space-y-1 text-sm">
          <div>{row.assigneeName ?? t('unassigned')}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t(`owners.${row.ownerScreenKey}`)}
          </div>
        </div>
      ),
    },
    {
      key: 'attention',
      header: t('columns.attention'),
      sortable: false,
      render: (row) => {
        if (row.isBlocked) {
          return <CmxStatusBadge label={t('attention.blocked')} size="sm" variant="warning" />
        }

        if (isOverdue(row)) {
          return <CmxStatusBadge label={t('attention.overdue')} size="sm" variant="error" />
        }

        if (isDueToday(row)) {
          return <CmxStatusBadge label={t('attention.dueToday')} size="sm" variant="info" />
        }

        return <CmxStatusBadge label={t('attention.clear')} size="sm" variant="success" />
      },
    },
    {
      key: 'open',
      header: t('columns.open'),
      sortable: false,
      align: 'right',
      render: (row) => (
        <CmxButton size="sm" variant="outline" className="whitespace-nowrap" asChild>
          <Link href={`${row.ownerPath}?returnUrl=${encodeURIComponent(workboardReturnUrl)}`}>
            {t('openStage')}
            <ExternalLink className="ms-1 h-4 w-4" aria-hidden />
          </Link>
        </CmxButton>
      ),
    },
  ], [locale, t, workboardReturnUrl])

  const metadata = data?.metadata
  const hasRows = (data?.rows.length ?? 0) > 0
  const errorMessage = error instanceof Error ? error.message : null

  return (
    <div className="w-full space-y-3 px-4 py-2 md:px-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-[rgb(var(--cmx-primary-rgb,37_99_235))]" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
        </div>
        <CmxButton type="button" variant="outline" loading={isFetching} onClick={() => void handleRefresh()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden />
          {t('refresh')}
        </CmxButton>
      </div>

      <WorkboardOverviewCards
        summary={data?.summary}
        ownerScreenKey={ownerScreenKey}
        blocker={blocker}
        sla={sla}
        onOwnerScreenKeyChange={(value) => {
          setOwnerScreenKey(value)
          resetPage()
        }}
        onBlockerChange={(value) => {
          setBlocker(value)
          resetPage()
        }}
        onSlaChange={(value) => {
          setSla(value)
          resetPage()
        }}
      />

      <WorkboardFilterToolbar
        search={search}
        branchId={branchId}
        assigneeId={assigneeId}
        priority={priority}
        blocker={blocker}
        sla={sla}
        totalRows={data?.total ?? 0}
        metadata={metadata}
        onSearchChange={(value) => {
          setSearch(value)
          resetPage()
        }}
        onBranchChange={(value) => {
          setBranchId(value)
          resetPage()
        }}
        onAssigneeChange={(value) => {
          setAssigneeId(value)
          resetPage()
        }}
        onPriorityChange={(value) => {
          setPriority(value)
          resetPage()
        }}
        onBlockerChange={(value) => {
          setBlocker(value)
          resetPage()
        }}
        onSlaChange={(value) => {
          setSla(value)
          resetPage()
        }}
        onReset={resetFilters}
      />

      {metadata?.configurationGaps.length ? (
        <CmxSummaryMessage
          type="warning"
          title={t('configurationGapTitle')}
          items={metadata.configurationGaps.map((gap) => t('configurationGapItem', { status: gap.statusCode }))}
        />
      ) : null}

      {errorMessage ? (
        <CmxSummaryMessage
          type="error"
          title={errorMessage}
          items={hasRows ? [] : [t('messages.loadRetryHint')]}
        />
      ) : null}

      {!isLoading && !hasRows && errorMessage ? (
        <CmxEmptyState
          icon={<ClipboardList className="h-10 w-10" />}
          title={t('messages.tableUnavailableTitle')}
          description={t('messages.tableUnavailableDescription')}
          action={
            <CmxButton type="button" variant="outline" onClick={() => void handleRefresh()}>
              {t('messages.retry')}
            </CmxButton>
          }
        />
      ) : (
        <CmxDataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          sorting={sortingFromWorkboardSort(sort)}
          onSortingChange={(nextSorting) => {
            setSort(workboardSortFromSorting(nextSorting))
            resetPage()
          }}
          currentPage={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value)
            resetPage()
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationFooter="always"
          showRowNumbers
          showColumnBorders
          headerSize="emphasized"
          headerClassName="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))]"
          className="w-full shadow-sm"
          tableClassName="min-w-[78rem]"
          stickyEndColumnIds={['open']}
          scrollAreaClassName="min-h-[24rem] max-h-[calc(100vh-15rem)] overflow-auto"
          emptyStateTitle={t('empty.title')}
          emptyStateDescription={hasActiveFilters ? t('empty.filteredDescription') : t('empty.description')}
          emptyStateIcon={<ClipboardList className="h-10 w-10" />}
          emptyStateAction={hasActiveFilters ? (
            <CmxButton type="button" variant="outline" onClick={resetFilters}>
              {t('filters.reset')}
            </CmxButton>
          ) : undefined}
        />
      )}
    </div>
  )
}
