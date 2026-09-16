'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { cmxMessage } from '@ui/feedback'
import { useAuth } from '@/lib/auth/auth-context'
import { invalidateNotificationInbox } from '@/lib/query/notification-keys'
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notification-bell-api'

/**
 * Shared inbox mutations used by the bell and the notification center.
 * Invalidates tenant+user scoped queries so both surfaces stay aligned.
 * @returns markRead and markAllRead handlers that toast on failure
 */
export function useInboxMutations() {
  const t = useTranslations('notifications')
  const qc = useQueryClient()
  const { currentTenant, user } = useAuth()
  const tenantId = currentTenant?.tenant_id ?? ''
  const userId = user?.id ?? ''

  const markRead = useCallback(
    async (id: string) => {
      if (!tenantId || !userId) {
        return
      }
      try {
        await markNotificationRead(id)
        await invalidateNotificationInbox(qc, tenantId, userId)
      } catch {
        cmxMessage.error(t('markReadFailed'))
      }
    },
    [qc, t, tenantId, userId]
  )

  const markAllRead = useCallback(async () => {
    if (!tenantId || !userId) {
      return
    }
    try {
      await markAllNotificationsRead()
      await invalidateNotificationInbox(qc, tenantId, userId)
    } catch {
      cmxMessage.error(t('markAllReadFailed'))
    }
  }, [qc, t, tenantId, userId])

  return { markRead, markAllRead }
}
