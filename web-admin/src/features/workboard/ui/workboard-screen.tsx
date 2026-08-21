'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Alert, CmxButton, CmxInput } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { CmxDataTable, CmxKpiStatCard } from '@ui/data-display'
import type { CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms'
import { ClipboardList, ExternalLink, RefreshCw, Search, ShieldAlert } from 'lucide-react'

import { useWorkboard } from '@features/workboard/hooks/use-workboard'
import type { WorkboardOrderRow, WorkboardQueryInput } from '@features/workboard/model/workboard-types'

function formatAge(minutes: number, t: ReturnType<typeof useTranslations>): string {
  if (minutes < 60) return t('age.minutes', { count: minutes })
  if (minutes < 1_440) return t('age.hours', { count: Math.floor(minutes / 60) })
  return t('age.days', { count: Math.floor(minutes / 1_440) })
}

/** Supervisor view that triages work and routes it to the stage that owns actions. */
export function WorkboardScreen() {
  const t = useTranslations('workboard')
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState<string>()
  const [assigneeId, setAssigneeId] = useState<string>()
  const [priority, setPriority] = useState<string>()
  const [blocker, setBlocker] = useState<WorkboardQueryInput['blocker']>('all')
  const [sla, setSla] = useState<WorkboardQueryInput['sla']>('all')
  const [sort, setSort] = useState<WorkboardQueryInput['sort']>('age_desc')
  const deferredSearch = useDeferredValue(search)

  const query = useMemo<WorkboardQueryInput>(() => ({
    page,
    pageSize,
    search: deferredSearch || undefined,
    branchId,
    assigneeId,
    priority,
    blocker,
    sla,
    sort,
  }), [assigneeId, blocker, branchId, deferredSearch, page, pageSize, priority, sla, sort])
  const { data, error, isLoading, isFetching, refetch } = useWorkboard(query)

  const resetPage = () => setPage(1)
  const columns = useMemo<CmxDataTableSimpleColumn<WorkboardOrderRow>[]>(() => [
    {
      key: 'order',
      header: t('columns.order'),
      render: (row) => (
        <div className="space-y-1">
          <div className="font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{row.orderNo}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{row.customerName}</div>
        </div>
      ),
    },
    {
      key: 'stage',
      header: t('columns.stage'),
      render: (row) => (
        <div className="space-y-1">
          <div className="font-medium">{locale === 'ar' && row.statusName2 ? row.statusName2 : row.statusName}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t(`owners.${row.ownerScreenKey}`)}</div>
        </div>
      ),
    },
    {
      key: 'assignment',
      header: t('columns.assignment'),
      render: (row) => (
        <div className="space-y-1 text-sm">
          <div>{row.assigneeName ?? t('unassigned')}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{row.branchName ?? t('noBranch')}</div>
        </div>
      ),
    },
    {
      key: 'timing',
      header: t('columns.timing'),
      render: (row) => (
        <div className="space-y-1 text-sm">
          <div className={row.readyByAt && new Date(row.readyByAt) < new Date() ? 'font-semibold text-red-600' : ''}>{formatAge(row.ageMinutes, t)}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {row.readyByAt
              ? t('dueAt', { value: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.readyByAt)) })
              : t('noDueDate')}
          </div>
        </div>
      ),
    },
    {
      key: 'risk',
      header: t('columns.risk'),
      render: (row) => row.isBlocked
        ? <span className="font-medium text-amber-700">{t('blocked')}</span>
        : <span className="text-emerald-700">{t('clear')}</span>,
    },
    {
      key: 'open',
      header: t('columns.open'),
      align: 'right',
      render: (row) => (
        <CmxButton size="sm" variant="outline" asChild>
          <Link href={row.ownerPath}>{t('openStage')} <ExternalLink className="ms-1 h-4 w-4" aria-hidden /></Link>
        </CmxButton>
      ),
    },
  ], [locale, t])

  const metadata = data?.metadata
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3"><ClipboardList className="h-8 w-8 text-[rgb(var(--cmx-primary-rgb,37_99_235))]" aria-hidden /><h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1></div>
          <p className="mt-2 max-w-3xl text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
        </div>
        <CmxButton type="button" variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="me-2 h-4 w-4" aria-hidden />{t('refresh')}</CmxButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('summary.total')} value={data?.summary.total ?? 0} icon={<ClipboardList className="h-5 w-5" />} />
        <CmxKpiStatCard title={t('summary.blocked')} value={data?.summary.blocked ?? 0} icon={<ShieldAlert className="h-5 w-5" />} />
        <CmxKpiStatCard title={t('summary.overdue')} value={data?.summary.overdue ?? 0} icon={<RefreshCw className="h-5 w-5" />} />
      </div>

      {metadata?.configurationGaps.length ? <Alert variant="warning" message={t('configurationGap', { statuses: metadata.configurationGaps.map((gap) => gap.statusCode).join(', ') })} /> : null}
      {error instanceof Error ? <Alert variant="error" message={error.message} /> : null}

      <CmxCard>
        <CmxCardHeader><CmxCardTitle>{t('filters.title')}</CmxCardTitle></CmxCardHeader>
        <CmxCardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CmxInput value={search} onChange={(event) => { setSearch(event.target.value); resetPage() }} placeholder={t('filters.search')} aria-label={t('filters.search')} leftIcon={<Search className="h-4 w-4" />} />
          <CmxSelectDropdown value={branchId ?? 'all'} onValueChange={(value) => { setBranchId(value === 'all' ? undefined : value); resetPage() }}><CmxSelectDropdownTrigger aria-label={t('filters.branch')}><CmxSelectDropdownValue placeholder={t('filters.branch')} /></CmxSelectDropdownTrigger><CmxSelectDropdownContent><CmxSelectDropdownItem value="all">{t('filters.allBranches')}</CmxSelectDropdownItem>{metadata?.branches.map((branch) => <CmxSelectDropdownItem key={branch.id} value={branch.id}>{branch.name}</CmxSelectDropdownItem>)}</CmxSelectDropdownContent></CmxSelectDropdown>
          <CmxSelectDropdown value={assigneeId ?? 'all'} onValueChange={(value) => { setAssigneeId(value === 'all' ? undefined : value); resetPage() }}><CmxSelectDropdownTrigger aria-label={t('filters.assignee')}><CmxSelectDropdownValue placeholder={t('filters.assignee')} /></CmxSelectDropdownTrigger><CmxSelectDropdownContent><CmxSelectDropdownItem value="all">{t('filters.allAssignees')}</CmxSelectDropdownItem>{metadata?.assignees.map((assignee) => <CmxSelectDropdownItem key={assignee.id} value={assignee.id}>{assignee.name}</CmxSelectDropdownItem>)}</CmxSelectDropdownContent></CmxSelectDropdown>
          <CmxSelectDropdown value={priority ?? 'all'} onValueChange={(value) => { setPriority(value === 'all' ? undefined : value); resetPage() }}><CmxSelectDropdownTrigger aria-label={t('filters.priority')}><CmxSelectDropdownValue placeholder={t('filters.priority')} /></CmxSelectDropdownTrigger><CmxSelectDropdownContent><CmxSelectDropdownItem value="all">{t('filters.allPriorities')}</CmxSelectDropdownItem>{metadata?.priorities.map((value) => <CmxSelectDropdownItem key={value} value={value}>{value}</CmxSelectDropdownItem>)}</CmxSelectDropdownContent></CmxSelectDropdown>
          <CmxSelectDropdown value={blocker} onValueChange={(value) => { setBlocker(value as WorkboardQueryInput['blocker']); resetPage() }}><CmxSelectDropdownTrigger aria-label={t('filters.blocker')}><CmxSelectDropdownValue /></CmxSelectDropdownTrigger><CmxSelectDropdownContent><CmxSelectDropdownItem value="all">{t('filters.allRisk')}</CmxSelectDropdownItem><CmxSelectDropdownItem value="blocked">{t('filters.blocked')}</CmxSelectDropdownItem><CmxSelectDropdownItem value="clear">{t('filters.clear')}</CmxSelectDropdownItem></CmxSelectDropdownContent></CmxSelectDropdown>
          <CmxSelectDropdown value={sla} onValueChange={(value) => { setSla(value as WorkboardQueryInput['sla']); resetPage() }}><CmxSelectDropdownTrigger aria-label={t('filters.sla')}><CmxSelectDropdownValue /></CmxSelectDropdownTrigger><CmxSelectDropdownContent><CmxSelectDropdownItem value="all">{t('filters.allSla')}</CmxSelectDropdownItem><CmxSelectDropdownItem value="overdue">{t('filters.overdue')}</CmxSelectDropdownItem><CmxSelectDropdownItem value="due_today">{t('filters.dueToday')}</CmxSelectDropdownItem><CmxSelectDropdownItem value="not_due">{t('filters.notDue')}</CmxSelectDropdownItem></CmxSelectDropdownContent></CmxSelectDropdown>
          <CmxSelectDropdown value={sort} onValueChange={(value) => { setSort(value as WorkboardQueryInput['sort']); resetPage() }}><CmxSelectDropdownTrigger aria-label={t('filters.sort')}><CmxSelectDropdownValue /></CmxSelectDropdownTrigger><CmxSelectDropdownContent><CmxSelectDropdownItem value="age_desc">{t('filters.oldest')}</CmxSelectDropdownItem><CmxSelectDropdownItem value="ready_by_asc">{t('filters.dueFirst')}</CmxSelectDropdownItem></CmxSelectDropdownContent></CmxSelectDropdown>
        </CmxCardContent>
      </CmxCard>

      <CmxDataTable columns={columns} data={data?.rows ?? []} loading={isLoading} currentPage={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); resetPage() }} pageSizeOptions={[10, 25, 50, 100]} paginationFooter="always" emptyStateTitle={t('empty.title')} emptyStateDescription={t('empty.description')} emptyStateIcon={<ClipboardList className="h-10 w-10" />} />
    </div>
  )
}
