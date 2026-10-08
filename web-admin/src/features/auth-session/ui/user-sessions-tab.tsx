'use client'

/**
 * UserSessionsTab — the "Sessions" tab of Users > User Details.
 *
 * Lists one user's ACTIVE sessions (devices) and lets an administrator sign out one or all of them.
 * Reuses the tenant sessions API with a `userId` filter, so the server still enforces
 * user_sessions:read / user_sessions:revoke and the caller's tenant. The tab is only offered to users
 * holding user_sessions:read (the parent decides), and actions additionally need user_sessions:revoke.
 */

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Laptop } from 'lucide-react'
import { Alert, AlertDescription, CmxButton, CmxSkeleton } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { SESSION_STATES } from '@/lib/constants/auth-session'
import type { SessionItem } from '../api/sessions-api'
import { useRevokeTenantSessions, useTenantSessions } from '../hooks/use-sessions'
import { formatAbsoluteTime, formatRelativeTime } from '../model/format-time'

/** One user's sessions are few (a handful of devices); a single page is enough. */
const PAGE_SIZE = 50

interface UserSessionsTabProps {
  /** Auth user id of the user being viewed. */
  userId: string
}

/**
 * @param props - Component props
 * @param props.userId - Auth user id whose sessions are shown
 */
export function UserSessionsTab({ userId }: UserSessionsTabProps) {
  const t = useTranslations('authSession.userSessions')
  const tSessions = useTranslations('authSession.sessions')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const canRevoke = useHasPermission('user_sessions', 'revoke')

  const { data, isLoading, isError, refetch, isFetching } = useTenantSessions({
    userId,
    status: SESSION_STATES.ACTIVE,
    limit: PAGE_SIZE,
    offset: 0,
  })
  const revoke = useRevokeTenantSessions()
  const [target, setTarget] = useState<SessionItem | 'all' | null>(null)

  const sessions = data?.sessions ?? []
  const revocable = sessions.filter((session) => !session.isCurrent)

  const handleConfirm = async () => {
    if (!target) return
    try {
      const ids = target === 'all' ? revocable.map((session) => session.id) : [target.id]
      const result = await revoke.mutateAsync({ sessionIds: ids })
      cmxMessage.success(t('revoked', { count: result.revoked }))
    } catch {
      cmxMessage.error(t('revokeFailed'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h3>
        {canRevoke && revocable.length > 0 ? (
          <CmxButton variant="secondary" size="sm" onClick={() => setTarget('all')} disabled={revoke.isPending}>
            {t('signOutAll')}
          </CmxButton>
        ) : null}
      </div>
      <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('hint')}</p>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <CmxSkeleton className="h-16 w-full" />
          <CmxSkeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="space-y-3">
          <Alert variant="error">
            <AlertDescription>{t('loadFailed')}</AlertDescription>
          </Alert>
          <CmxButton variant="secondary" onClick={() => void refetch()} loading={isFetching}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-8 text-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {t('empty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-3"
            >
              <Laptop className="h-5 w-5 shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {session.deviceLabel ?? tSessions('unknownDevice')}
                  </span>
                  {session.isCurrent ? <Badge variant="success">{tSessions('thisDevice')}</Badge> : null}
                  {session.isRememberMe ? <Badge variant="secondary">{tSessions('rememberMe')}</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  <span>{tSessions('ip', { ip: session.lastIp ?? session.loginIp ?? '—' })}</span>
                  <span aria-hidden> · </span>
                  <span title={formatAbsoluteTime(session.createdAt, locale)}>
                    {tSessions('signedIn', { when: formatRelativeTime(session.createdAt, locale) })}
                  </span>
                  <span aria-hidden> · </span>
                  <span title={formatAbsoluteTime(session.lastActivityAt, locale)}>
                    {tSessions('lastActive', { when: formatRelativeTime(session.lastActivityAt, locale) })}
                  </span>
                </p>
              </div>
              {canRevoke && !session.isCurrent ? (
                <CmxButton variant="secondary" size="sm" onClick={() => setTarget(session)} disabled={revoke.isPending}>
                  {tSessions('signOut')}
                </CmxButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CmxConfirmDialog
        open={target !== null}
        title={target === 'all' ? t('confirmAllTitle') : t('confirmOneTitle')}
        description={
          target === 'all'
            ? t('confirmAllDescription', { count: revocable.length })
            : t('confirmOneDescription', { device: target?.deviceLabel ?? tSessions('unknownDevice') })
        }
        confirmLabel={tSessions('signOut')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setTarget(null)}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
