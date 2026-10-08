'use client'

/**
 * TenantSessionsScreen — "Active sessions" (/dashboard/users/sessions) for administrators.
 *
 * Server-side paginated list of the tenant's sessions with per-row sign-out and an emergency
 * "sign out everyone" action behind a double confirmation. Tenant is resolved server-side from the
 * caller's session. Gated by user_sessions:read (view) and user_sessions:revoke (actions).
 */

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Alert, AlertDescription, CmxButton, CmxSelect } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display'
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { SESSION_STATES } from '@/lib/constants/auth-session'
import type { SessionItem } from '../api/sessions-api'
import { useRevokeTenantSessions, useTenantSessions } from '../hooks/use-sessions'
import { formatAbsoluteTime, formatRelativeTime } from '../model/format-time'

const PAGE_SIZE = 20
type StatusFilter = 'ALL' | typeof SESSION_STATES.ACTIVE | typeof SESSION_STATES.ENDED

/** Tenant-wide sessions screen. */
export function TenantSessionsScreen() {
  const t = useTranslations('authSession.tenantSessions')
  const tSessions = useTranslations('authSession.sessions')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const canRevoke = useHasPermission('user_sessions', 'revoke')

  const [status, setStatus] = useState<StatusFilter>(SESSION_STATES.ACTIVE)
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<SessionItem | null>(null)
  const [confirmAll, setConfirmAll] = useState<'closed' | 'first' | 'second'>('closed')

  const query = useMemo(
    () => ({
      status: status === 'ALL' ? undefined : status,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [status, page]
  )
  const { data, isLoading, isError, refetch, isFetching } = useTenantSessions(query)
  const revoke = useRevokeTenantSessions()

  const sessions = data?.sessions ?? []
  const total = data?.total ?? 0

  const reportResult = (result: { revoked: number; skippedCurrent: boolean }) => {
    cmxMessage.success(t('revoked', { count: result.revoked }))
    if (result.skippedCurrent) cmxMessage.info(t('currentSkipped'))
  }

  const handleRevokeOne = async () => {
    if (!target) return
    try {
      reportResult(await revoke.mutateAsync({ sessionIds: [target.id] }))
    } catch {
      cmxMessage.error(t('revokeFailed'))
    }
  }

  const handleRevokeAll = async () => {
    try {
      reportResult(await revoke.mutateAsync({ all: true }))
    } catch {
      cmxMessage.error(t('revokeFailed'))
    }
  }

  const columns: CmxDataTableSimpleColumn<SessionItem>[] = [
    {
      key: 'user',
      header: t('columns.user'),
      sortable: false,
      render: (row) => (
        <div className="min-w-0">
          <div className="text-sm font-medium">{row.user?.displayName ?? row.user?.email ?? '—'}</div>
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {[row.user?.userCode, row.user?.email].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      key: 'device',
      header: t('columns.device'),
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span>{row.deviceLabel ?? tSessions('unknownDevice')}</span>
          {row.isCurrent ? <Badge variant="success">{tSessions('thisDevice')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'ip',
      header: t('columns.ip'),
      sortable: false,
      render: (row) => row.lastIp ?? row.loginIp ?? '—',
    },
    {
      key: 'signedIn',
      header: t('columns.signedIn'),
      sortable: false,
      render: (row) => <span title={formatAbsoluteTime(row.createdAt, locale)}>{formatRelativeTime(row.createdAt, locale)}</span>,
    },
    {
      key: 'lastActive',
      header: t('columns.lastActive'),
      sortable: false,
      render: (row) => (
        <span title={formatAbsoluteTime(row.lastActivityAt, locale)}>{formatRelativeTime(row.lastActivityAt, locale)}</span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      sortable: false,
      render: (row) =>
        row.status === SESSION_STATES.ACTIVE ? (
          <Badge variant="success">{t('status.ACTIVE')}</Badge>
        ) : (
          <Badge variant="secondary">
            {row.endReasonCode ? t(`endReasons.${row.endReasonCode}`) : t('status.ENDED')}
          </Badge>
        ),
    },
    ...(canRevoke
      ? [
          {
            key: 'actions',
            header: tCommon('actions'),
            sortable: false,
            render: (row: SessionItem) =>
              row.status === SESSION_STATES.ACTIVE && !row.isCurrent ? (
                <CmxButton variant="secondary" size="sm" onClick={() => setTarget(row)} disabled={revoke.isPending}>
                  {tSessions('signOut')}
                </CmxButton>
              ) : null,
          } satisfies CmxDataTableSimpleColumn<SessionItem>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('subtitle')}</p>
        </div>
        {canRevoke ? (
          <CmxButton variant="destructive" onClick={() => setConfirmAll('first')} disabled={revoke.isPending}>
            {t('signOutEveryone')}
          </CmxButton>
        ) : null}
      </div>

      <div className="max-w-xs">
        <CmxSelect
          label={t('filters.status')}
          value={status}
          options={[
            { value: SESSION_STATES.ACTIVE, label: t('filters.active') },
            { value: SESSION_STATES.ENDED, label: t('filters.ended') },
            { value: 'ALL', label: tCommon('all') },
          ]}
          onChange={(event) => {
            setStatus(event.target.value as StatusFilter)
            setPage(1)
          }}
        />
      </div>

      {isError ? (
        <div className="space-y-3">
          <Alert variant="error">
            <AlertDescription>{t('loadFailed')}</AlertDescription>
          </Alert>
          <CmxButton variant="secondary" onClick={() => void refetch()} loading={isFetching}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : (
        <CmxDataTable<SessionItem>
          columns={columns}
          data={sessions}
          loading={isLoading}
          currentPage={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          showPageSizeSelector={false}
          emptyStateTitle={t('empty')}
        />
      )}

      <CmxConfirmDialog
        open={target !== null}
        title={t('confirmOneTitle')}
        description={t('confirmOneDescription', {
          user: target?.user?.displayName ?? target?.user?.email ?? '—',
          device: target?.deviceLabel ?? tSessions('unknownDevice'),
        })}
        confirmLabel={tSessions('signOut')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setTarget(null)}
        onConfirm={handleRevokeOne}
      />
      <CmxConfirmDialog
        open={confirmAll === 'first'}
        title={t('confirmAllTitle')}
        description={t('confirmAllDescription')}
        confirmLabel={t('continue')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setConfirmAll('closed')}
        // The confirm dialog closes itself via onCancel after confirming; reopen as step two on the next tick.
        onConfirm={() => {
          setTimeout(() => setConfirmAll('second'), 0)
        }}
      />
      <CmxConfirmDialog
        open={confirmAll === 'second'}
        title={t('confirmAllFinalTitle')}
        description={t('confirmAllFinalDescription', { count: total })}
        confirmLabel={t('signOutEveryone')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setConfirmAll('closed')}
        onConfirm={handleRevokeAll}
      />
    </div>
  )
}
