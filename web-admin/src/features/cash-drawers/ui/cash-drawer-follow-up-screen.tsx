'use client'

import Link from 'next/link'
import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import {
  fetchCashDrawerCatalogs,
  fetchCashDrawerFollowUp,
  updateSessionPostClose,
  type FollowUpSessionEntry,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import { cmxMessage } from '@ui/feedback'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

const PAGE_SIZE = 20

/**
 * Cash deposit follow-up worklist (CLF-8-9): closed sessions whose closing cash
 * was sent to a pending-deposit drawer, filterable by post-close status, with an
 * inline status/notes update (same endpoint and rules as the session detail
 * panel — one change log).
 */
export function CashDrawerFollowUpScreen() {
  const t = useTranslations('billing.cashDrawers.followUp')
  const tClosure = useTranslations('billing.cashDrawers.closure.postClose')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const locale = useLocale()
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const queryClient = useQueryClient()
  const { token: csrfToken } = useCSRFToken()
  const canUpdate = useHasPermissionCode('cash_drawer:post_close_update')

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<FollowUpSessionEntry | null>(null)
  const [statusDraft, setStatusDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    queryFn: fetchCashDrawerCatalogs,
    staleTime: 5 * 60_000,
  })
  const statuses = catalogsQuery.data?.postCloseStatuses ?? []
  const localized = (row: { name: string; name2: string | null } | undefined, fallback: string) =>
    row ? (locale === 'ar' && row.name2 ? row.name2 : row.name) : fallback

  const listQuery = useQuery({
    queryKey: ['cash-drawers', 'follow-up', page, statusFilter],
    queryFn: () => fetchCashDrawerFollowUp({ page, pageSize: PAGE_SIZE, postCloseStatusCode: statusFilter || undefined }),
    placeholderData: keepPreviousData,
  })

  const openEditor = (row: FollowUpSessionEntry) => {
    setEditing(row)
    setStatusDraft(row.postCloseStatusCode ?? '')
    setNotesDraft(row.postCloseNotes ?? '')
  }

  const selectedStatus = statuses.find((s) => s.code === statusDraft)

  const save = async () => {
    if (!editing) return
    if (!statusDraft) {
      cmxMessage.error(tClosure('statusRequired'))
      return
    }
    if (selectedStatus?.requiresNotes && !notesDraft.trim()) {
      cmxMessage.error(tClosure('notesRequired'))
      return
    }
    setSaving(true)
    try {
      await updateSessionPostClose({
        drawerId: editing.drawerId,
        sessionId: editing.sessionId,
        postCloseStatusCode: statusDraft,
        notes: notesDraft.trim() || undefined,
        csrfToken,
      })
      cmxMessage.success(tClosure('saved'))
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['cash-drawers', 'follow-up'] })
    } catch (error) {
      cmxMessage.error(errorMessage(error, tClosure('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
      </div>

      <div className="max-w-xs">
        <CmxSelect
          label={t('filterStatus')}
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          options={[
            { value: '', label: t('allStatuses') },
            ...statuses.map((s) => ({ value: s.code, label: localized(s, s.code) })),
          ]}
        />
      </div>

      {listQuery.isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <span>{t('loadFailed')}</span>
          <CmxButton size="sm" variant="outline" onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : (
        <CmxDataTable
          columns={[
            {
              key: 'sessionNo',
              header: t('columns.session'),
              render: (r: FollowUpSessionEntry) => (
                <Link
                  className="font-mono text-xs font-semibold underline-offset-2 hover:underline"
                  href={`/dashboard/internal_fin/cash-drawers/${r.drawerId}/session/${r.sessionId}`}
                >
                  {r.sessionNo}
                </Link>
              ),
            },
            { key: 'drawer', header: t('columns.drawer'), render: (r: FollowUpSessionEntry) => r.drawerName ?? '—' },
            { key: 'branch', header: t('columns.branch'), render: (r: FollowUpSessionEntry) => r.branchName ?? '—' },
            { key: 'closedAt', header: t('columns.closedAt'), render: (r: FollowUpSessionEntry) => fmtDateTime(r.closedAt) },
            {
              key: 'amount',
              header: t('columns.amount'),
              align: 'right' as const,
              render: (r: FollowUpSessionEntry) => (
                <div className="space-y-0.5">
                  {r.pendingDepositAmounts.map((a) => (
                    <div key={a.currencyCode}>{money(a.amount, a.currencyCode)}</div>
                  ))}
                </div>
              ),
            },
            {
              key: 'status',
              header: t('columns.status'),
              render: (r: FollowUpSessionEntry) => (
                <Badge variant="outline">
                  {r.postCloseStatusCode
                    ? localized(statuses.find((s) => s.code === r.postCloseStatusCode), r.postCloseStatusCode)
                    : t('noStatus')}
                </Badge>
              ),
            },
            { key: 'notes', header: t('columns.notes'), render: (r: FollowUpSessionEntry) => r.postCloseNotes ?? '—' },
            ...(canUpdate
              ? [
                  {
                    key: 'actions',
                    header: tCommon('actions'),
                    sortable: false,
                    align: 'right' as const,
                    render: (r: FollowUpSessionEntry) => (
                      <CmxButton size="sm" variant="outline" onClick={() => openEditor(r)}>
                        {t('update')}
                      </CmxButton>
                    ),
                  },
                ]
              : []),
          ]}
          data={listQuery.data?.rows ?? []}
          loading={listQuery.isLoading}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalCount={listQuery.data?.totalCount ?? 0}
          onPageChange={setPage}
          showPageSizeSelector={false}
          emptyStateTitle={t('emptyTitle')}
          emptyStateDescription={t('emptyDescription')}
        />
      )}

      <CmxDialog open={editing !== null} onOpenChange={(next) => { if (!next) setEditing(null) }}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {t('updateTitle')} — {editing?.sessionNo}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <CmxSelect
              label={tClosure('status')}
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              options={[
                { value: '', label: tClosure('selectStatus') },
                ...statuses.map((s) => ({ value: s.code, label: localized(s, s.code) })),
              ]}
            />
            <div className="space-y-2">
              <Label>{selectedStatus?.requiresNotes ? tClosure('notes') : tClosure('notesOptional')}</Label>
              <CmxTextarea value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton loading={saving} onClick={save}>
              {tClosure('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  )
}
