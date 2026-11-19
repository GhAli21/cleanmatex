'use client'

/**
 * MySessionsCard — the signed-in user's active sessions with per-device and "all other devices" sign-out.
 *
 * Sessions are addressed by registry row id only (the Supabase session id never reaches the browser).
 * The current session is badged and cannot be signed out here (use Sign out).
 */

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Laptop } from 'lucide-react'
import { CmxButton, CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { CmxConfirmDialog, cmxMessage, CmxStatusBadge } from '@ui/feedback'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { SESSION_ERROR_CODES } from '@/lib/constants/auth-session'
import { SessionsApiError, type SessionItem } from '../api/sessions-api'
import { useMySessions, useRevokeMyOtherSessions, useRevokeMySession } from '../hooks/use-sessions'
import { formatAbsoluteTime, formatRelativeTime } from '../model/format-time'

/** Active sessions of the current user. */
export function MySessionsCard() {
  const t = useTranslations('authSession.sessions')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { data, isLoading, isError, refetch, isFetching } = useMySessions()
  const revokeOne = useRevokeMySession()
  const revokeOthers = useRevokeMyOtherSessions()
  const [target, setTarget] = useState<SessionItem | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)

  const sessions = data ?? []
  const others = sessions.filter((session) => !session.isCurrent)

  const handleRevokeOne = async () => {
    if (!target) return
    try {
      await revokeOne.mutateAsync(target.id)
      cmxMessage.success(t('revoked'))
    } catch (error) {
      // Already gone (ended elsewhere) is not a failure from the user's point of view; the list refreshes.
      const code = error instanceof SessionsApiError ? error.code : undefined
      if (code === SESSION_ERROR_CODES.SESSION_NOT_FOUND) cmxMessage.info(t('alreadyEnded'))
      else cmxMessage.error(t('revokeFailed'))
    }
  }

  const handleRevokeOthers = async () => {
    try {
      const count = await revokeOthers.mutateAsync()
      cmxMessage.success(t('revokedOthers', { count }))
    } catch {
      cmxMessage.error(t('revokeFailed'))
    }
  }

  return (
    <CmxCard>
      <CmxCardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CmxCardTitle>{t('title')}</CmxCardTitle>
        {others.length > 0 ? (
          <CmxButton variant="secondary" size="sm" onClick={() => setConfirmOthers(true)} disabled={revokeOthers.isPending}>
            {t('signOutOthers')}
          </CmxButton>
        ) : null}
      </CmxCardHeader>
      <CmxCardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('hint')}</p>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <CmxSkeleton className="h-16 w-full" />
            <CmxSkeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <CmxSummaryMessage type="error">
              <div>{t('loadFailed')}</div>
            </CmxSummaryMessage>
            <CmxButton variant="secondary" onClick={() => void refetch()} loading={isFetching}>
              {tCommon('retry')}
            </CmxButton>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <Laptop className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {session.deviceLabel ?? t('unknownDevice')}
                    </span>
                    {session.isCurrent ? <CmxStatusBadge size="sm" tone="success">{t('thisDevice')}</CmxStatusBadge> : null}
                    {session.isRememberMe ? <CmxStatusBadge size="sm" tone="neutral">{t('rememberMe')}</CmxStatusBadge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span>{t('ip', { ip: session.lastIp ?? session.loginIp ?? '—' })}</span>
                    <span aria-hidden> · </span>
                    <span title={formatAbsoluteTime(session.createdAt, locale)}>
                      {t('signedIn', { when: formatRelativeTime(session.createdAt, locale) })}
                    </span>
                    <span aria-hidden> · </span>
                    <span title={formatAbsoluteTime(session.lastActivityAt, locale)}>
                      {t('lastActive', { when: formatRelativeTime(session.lastActivityAt, locale) })}
                    </span>
                  </p>
                </div>
                {!session.isCurrent ? (
                  <CmxButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setTarget(session)}
                    disabled={revokeOne.isPending}
                    aria-label={t('signOutDevice', { device: session.deviceLabel ?? t('unknownDevice') })}
                  >
                    {t('signOut')}
                  </CmxButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CmxCardContent>

      <CmxConfirmDialog
        open={target !== null}
        title={t('confirmOneTitle')}
        description={t('confirmOneDescription', { device: target?.deviceLabel ?? t('unknownDevice') })}
        confirmLabel={t('signOut')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setTarget(null)}
        onConfirm={handleRevokeOne}
      />
      <CmxConfirmDialog
        open={confirmOthers}
        title={t('confirmOthersTitle')}
        description={t('confirmOthersDescription', { count: others.length })}
        confirmLabel={t('signOutOthers')}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setConfirmOthers(false)}
        onConfirm={handleRevokeOthers}
      />
    </CmxCard>
  )
}
