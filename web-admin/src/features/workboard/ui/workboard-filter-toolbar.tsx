'use client'

import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { CmxInput, CmxButton, Label } from '@ui/primitives'
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
  totalRows: number
  metadata?: WorkboardMetadata
  onSearchChange: (value: string) => void
  onBranchChange: (value?: string) => void
  onAssigneeChange: (value?: string) => void
  onPriorityChange: (value?: string) => void
  onBlockerChange: (value: WorkboardQueryInput['blocker']) => void
  onSlaChange: (value: WorkboardQueryInput['sla']) => void
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
  totalRows,
  metadata,
  onSearchChange,
  onBranchChange,
  onAssigneeChange,
  onPriorityChange,
  onBlockerChange,
  onSlaChange,
  onReset,
}: WorkboardFilterToolbarProps) {
  const t = useTranslations('workboard')
  const tPriorities = useTranslations('orders.priorities')

  const formatPriority = useCallback(
    (value: string): string => {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'normal' || normalized === 'urgent' || normalized === 'express') {
        return tPriorities(normalized)
      }
      return t('priority.label', {
        value: value
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      })
    },
    [t, tPriorities],
  )

  const activeFilters = useMemo(() => {
    const items: Array<{ key: string; label: string; onClear: () => void }> = []

    if (search.trim()) {
      items.push({
        key: 'search',
        label: t('filters.active.search', { value: search.trim() }),
        onClear: () => onSearchChange(''),
      })
    }

    if (branchId) {
      const branchName = metadata?.branches.find((branch) => branch.id === branchId)?.name ?? branchId
      items.push({
        key: 'branch',
        label: t('filters.active.branch', { value: branchName }),
        onClear: () => onBranchChange(undefined),
      })
    }

    if (assigneeId) {
      const assigneeName = metadata?.assignees.find((assignee) => assignee.id === assigneeId)?.name ?? assigneeId
      items.push({
        key: 'assignee',
        label: t('filters.active.assignee', { value: assigneeName }),
        onClear: () => onAssigneeChange(undefined),
      })
    }

    if (priority) {
      items.push({
        key: 'priority',
        label: t('filters.active.priority', { value: formatPriority(priority) }),
        onClear: () => onPriorityChange(undefined),
      })
    }

    if (blocker !== 'all') {
      items.push({
        key: 'blocker',
        label:
          blocker === 'blocked'
            ? t('filters.active.blocked')
            : t('filters.active.clear'),
        onClear: () => onBlockerChange('all'),
      })
    }

    if (sla !== 'all') {
      const slaLabels: Record<NonNullable<WorkboardQueryInput['sla']>, string> = {
        all: t('filters.allSla'),
        overdue: t('filters.overdue'),
        due_today: t('filters.dueToday'),
        not_due: t('filters.notDue'),
      }
      items.push({
        key: 'sla',
        label: t('filters.active.sla', { value: slaLabels[sla] }),
        onClear: () => onSlaChange('all'),
      })
    }

    return items
  }, [
    assigneeId,
    blocker,
    branchId,
    formatPriority,
    metadata,
    onAssigneeChange,
    onBlockerChange,
    onBranchChange,
    onPriorityChange,
    onSearchChange,
    onSlaChange,
    priority,
    search,
    sla,
    t,
  ])

  const hasActiveFilters = activeFilters.length > 0

  return (
    <CmxCard className="shadow-sm">
      <CmxCardHeader className="flex flex-col gap-2 border-b border-border p-3 pb-2 md:p-3 md:pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <CmxCardTitle>{t('filters.title')}</CmxCardTitle>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('filters.resultsCount', { count: totalRows })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {hasActiveFilters ? (
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t('filters.activeLabel')}
            </span>
          ) : null}

          {activeFilters.map((item) => (
            <CmxButton
              key={item.key}
              type="button"
              variant="ghost"
              size="xs"
              onClick={item.onClear}
              className="h-auto inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted/80"
            >
              <span>{item.label}</span>
              <X className="h-3 w-3 shrink-0" aria-hidden="true" />
            </CmxButton>
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

      <CmxCardContent className="grid gap-x-4 gap-y-2 p-3 pt-2 md:grid-cols-2 md:p-3 md:pt-2 xl:grid-cols-[minmax(17rem,1.5fr)_repeat(5,minmax(9rem,1fr))]">
        <div className="space-y-1.5">
          <Label htmlFor="workboard-search">{t('filters.searchLabel')}</Label>
          <CmxInput
            id="workboard-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('filters.search')}
            aria-label={t('filters.search')}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('filters.branch')}</Label>
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
        </div>

        <div className="space-y-1.5">
          <Label>{t('filters.assignee')}</Label>
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
        </div>

        <div className="space-y-1.5">
          <Label>{t('filters.priority')}</Label>
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
                  {formatPriority(value)}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>

        <div className="space-y-1.5">
          <Label>{t('filters.blocker')}</Label>
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
        </div>

        <div className="space-y-1.5">
          <Label>{t('filters.sla')}</Label>
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
        </div>
      </CmxCardContent>
    </CmxCard>
  )
}
