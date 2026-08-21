'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
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

/** Supervisor view that triages work and routes it to the stage that owns actions. */
export function WorkboardScreen() {
  const t = useTranslations('workboard')
  const locale = useLocale()
  const message = useMessage()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState<string>()
  const [assigneeId, setAssigneeId] = useState<string>()
  const [priority, setPriority] = useState<string>()
  const [ownerScreenKey, setOwnerScreenKey] = useState<WorkboardOwnerScreenKey>()
  const [blocker, setBlocker] = useState<WorkboardQueryInput['blocker']>('all')
  const [sla, setSla] = useState<WorkboardQueryInput['sla']>('all')
  const [sort, setSort] = useState<WorkboardQueryInput['sort']>('age_desc')
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

  const resetPage = () => setPage(1)
  const resetFilters = () => {
    setSearch('')
    setBranchId(undefined)
    setAssigneeId(undefined)
    setPriority(undefined)
    setOwnerScreenKey(undefined)
    setBlocker('all')
    setSla('all')
    setSort('age_desc')
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
    || sort !== 'age_desc'
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
      sortable: false,
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
      sortable: false,
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
      key: 'stage',
      header: t('columns.stage'),
      sortable: false,
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
      header: t('columns.ageSla'),
      sortable: false,
      render: (row) => (
        <div className="space-y-1 text-sm">
          <div className={isOverdue(row) ? 'font-semibold text-[rgb(var(--cmx-destructive-rgb,220_38_38))]' : 'font-medium'}>
            {formatAge(row.ageMinutes, t)}
          </div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {row.readyByAt
              ? t('dueAt', { value: formatDateTime(row.readyByAt, locale) })
              : t('noDueDate')}
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: t('columns.priority'),
      sortable: false,
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
      sortable: false,
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
          <Link href={row.ownerPath}>
            {t('openStage')}
            <ExternalLink className="ms-1 h-4 w-4" aria-hidden />
          </Link>
        </CmxButton>
      ),
    },
  ], [locale, t])

  const metadata = data?.metadata
  const hasRows = (data?.rows.length ?? 0) > 0
  const errorMessage = error instanceof Error ? error.message : null

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-[rgb(var(--cmx-primary-rgb,37_99_235))]" aria-hidden />
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="mt-2 max-w-3xl text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
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

      {metadata?.configurationGaps.length ? (
        <CmxSummaryMessage
          type="warning"
          title={t('configurationGapTitle')}
          items={metadata.configurationGaps.map((gap) => t('configurationGapItem', { status: gap.statusCode }))}
        />
      ) : null}

      <WorkboardFilterToolbar
        search={search}
        branchId={branchId}
        assigneeId={assigneeId}
        priority={priority}
        blocker={blocker}
        sla={sla}
        sort={sort}
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
        onSortChange={(value) => {
          setSort(value)
          resetPage()
        }}
        onReset={resetFilters}
      />

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
