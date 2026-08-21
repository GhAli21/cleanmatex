'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { CmxInput, CmxButton } from '@ui/primitives'
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'

import type {
  WorkboardMetadata,
  WorkboardQueryInput,
} from '@features/workboard/model/workboard-types'

interface WorkboardFilterToolbarProps {
  search: string
  branchId?: string
  assigneeId?: string
  priority?: string
  blocker: WorkboardQueryInput['blocker']
  sla: WorkboardQueryInput['sla']
  sort: WorkboardQueryInput['sort']
  totalRows: number
  metadata?: WorkboardMetadata
  onSearchChange: (value: string) => void
  onBranchChange: (value?: string) => void
  onAssigneeChange: (value?: string) => void
  onPriorityChange: (value?: string) => void
  onBlockerChange: (value: WorkboardQueryInput['blocker']) => void
  onSlaChange: (value: WorkboardQueryInput['sla']) => void
  onSortChange: (value: WorkboardQueryInput['sort']) => void
  onReset: () => void
}

/** Filter toolbar for the supervisor queue. */
export function WorkboardFilterToolbar({
  search,
  branchId,
  assigneeId,
  priority,
  blocker,
  sla,
  sort,
  totalRows,
  metadata,
  onSearchChange,
  onBranchChange,
  onAssigneeChange,
  onPriorityChange,
  onBlockerChange,
  onSlaChange,
  onSortChange,
  onReset,
}: WorkboardFilterToolbarProps) {
  const t = useTranslations('workboard')
  const locale = useLocale()

  const activeFilters = useMemo(() => {
    const items: string[] = []

    if (search.trim()) {
      items.push(t('filters.active.search', { value: search.trim() }))
    }

    if (branchId) {
      const branchName = metadata?.branches.find((branch) => branch.id === branchId)?.name ?? branchId
      items.push(t('filters.active.branch', { value: branchName }))
    }

    if (assigneeId) {
      const assigneeName = metadata?.assignees.find((assignee) => assignee.id === assigneeId)?.name ?? assigneeId
      items.push(t('filters.active.assignee', { value: assigneeName }))
    }

    if (priority) {
      items.push(t('filters.active.priority', { value: priority }))
    }

    if (blocker !== 'all') {
      items.push(
        blocker === 'blocked'
          ? t('filters.active.blocked')
          : t('filters.active.clear'),
      )
    }

    if (sla !== 'all') {
      const slaLabels: Record<NonNullable<WorkboardQueryInput['sla']>, string> = {
        all: t('filters.allSla'),
        overdue: t('filters.overdue'),
        due_today: t('filters.dueToday'),
        not_due: t('filters.notDue'),
      }
      items.push(t('filters.active.sla', { value: slaLabels[sla] }))
    }

    if (sort !== 'age_desc') {
      const sortLabels: Record<NonNullable<WorkboardQueryInput['sort']>, string> = {
        age_desc: t('filters.oldest'),
        ready_by_asc: t('filters.dueFirst'),
      }
      items.push(t('filters.active.sort', { value: sortLabels[sort] }))
    }

    return items
  }, [assigneeId, blocker, branchId, locale, metadata, priority, search, sla, sort, t])

  const hasActiveFilters = activeFilters.length > 0

  return (
    <CmxCard>
      <CmxCardHeader className="flex flex-col gap-3 border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <CmxCardTitle>{t('filters.title')}</CmxCardTitle>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('filters.resultsCount', { count: totalRows })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters ? (
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('filters.activeLabel')}
            </span>
          ) : null}

          {activeFilters.map((item) => (
            <span
              key={item}
              className="inline-flex items-center rounded-full border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] px-3 py-1 text-xs text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
            >
              {item}
            </span>
          ))}

          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasActiveFilters}
            onClick={onReset}
          >
            {t('filters.reset')}
          </CmxButton>
        </div>
      </CmxCardHeader>

      <CmxCardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-4">
        <CmxInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('filters.search')}
          aria-label={t('filters.search')}
          leftIcon={<Search className="h-4 w-4" />}
        />

        <CmxSelectDropdown
          value={branchId ?? 'all'}
          onValueChange={(value) => onBranchChange(value === 'all' ? undefined : value)}
        >
          <CmxSelectDropdownTrigger aria-label={t('filters.branch')}>
            <CmxSelectDropdownValue placeholder={t('filters.branch')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="all">{t('filters.allBranches')}</CmxSelectDropdownItem>
            {metadata?.branches.map((branch) => (
              <CmxSelectDropdownItem key={branch.id} value={branch.id}>
                {branch.name}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxSelectDropdown
          value={assigneeId ?? 'all'}
          onValueChange={(value) => onAssigneeChange(value === 'all' ? undefined : value)}
        >
          <CmxSelectDropdownTrigger aria-label={t('filters.assignee')}>
            <CmxSelectDropdownValue placeholder={t('filters.assignee')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="all">{t('filters.allAssignees')}</CmxSelectDropdownItem>
            {metadata?.assignees.map((assignee) => (
              <CmxSelectDropdownItem key={assignee.id} value={assignee.id}>
                {assignee.name}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxSelectDropdown
          value={priority ?? 'all'}
          onValueChange={(value) => onPriorityChange(value === 'all' ? undefined : value)}
        >
          <CmxSelectDropdownTrigger aria-label={t('filters.priority')}>
            <CmxSelectDropdownValue placeholder={t('filters.priority')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="all">{t('filters.allPriorities')}</CmxSelectDropdownItem>
            {metadata?.priorities.map((value) => (
              <CmxSelectDropdownItem key={value} value={value}>
                {value}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxSelectDropdown
          value={blocker}
          onValueChange={(value) => onBlockerChange(value as WorkboardQueryInput['blocker'])}
        >
          <CmxSelectDropdownTrigger aria-label={t('filters.blocker')}>
            <CmxSelectDropdownValue />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="all">{t('filters.allRisk')}</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="blocked">{t('filters.blocked')}</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="clear">{t('filters.clear')}</CmxSelectDropdownItem>
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxSelectDropdown
          value={sla}
          onValueChange={(value) => onSlaChange(value as WorkboardQueryInput['sla'])}
        >
          <CmxSelectDropdownTrigger aria-label={t('filters.sla')}>
            <CmxSelectDropdownValue />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="all">{t('filters.allSla')}</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="overdue">{t('filters.overdue')}</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="due_today">{t('filters.dueToday')}</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="not_due">{t('filters.notDue')}</CmxSelectDropdownItem>
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxSelectDropdown
          value={sort}
          onValueChange={(value) => onSortChange(value as WorkboardQueryInput['sort'])}
        >
          <CmxSelectDropdownTrigger aria-label={t('filters.sort')}>
            <CmxSelectDropdownValue />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="age_desc">{t('filters.oldest')}</CmxSelectDropdownItem>
            <CmxSelectDropdownItem value="ready_by_asc">{t('filters.dueFirst')}</CmxSelectDropdownItem>
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
      </CmxCardContent>
    </CmxCard>
  )
}
