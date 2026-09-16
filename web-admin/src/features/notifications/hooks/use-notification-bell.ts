'use client'

/**
 * Notification bell data: one unread-count query, Realtime for live badge,
 * and a recent-list query that starts only when the dropdown opens.
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/auth-context'
import type { NotificationRow } from '@lib/notifications/types'
import {
  NOTIFICATION_RECENT_LIMIT,
  NOTIFICATION_UNREAD_STALE_TIME_MS,
  notificationKeys,
} from '@/lib/query/notification-keys'
import {
  fetchRecentUnreadNotifications,
  fetchUnreadNotificationCount,
} from '../api/notification-bell-api'
import {
  isInboxRealtimeRow,
  isInboxRowInScope,
  mergeRecentInboxRows,
  type InboxRealtimeEvent,
} from '../model/inbox-realtime'

interface UseNotificationBellOptions {
  /** When false, the recent-list query does not start a network request. */
  dropdownOpen?: boolean
}

function isInboxRealtimeEvent(value: string): value is InboxRealtimeEvent {
  return value === 'INSERT' || value === 'UPDATE' || value === 'DELETE'
}

/**
 * Shared inbox queries for the top-bar bell.
 * Unread count is tenant+user scoped and does not poll.
 * @param options.dropdownOpen - Fetch recent rows only while the dropdown is open
 * @returns Badge count, recent rows, and recent-list loading flag
 */
export function useNotificationBell(options: UseNotificationBellOptions = {}) {
  const { dropdownOpen = false } = options
  const { currentTenant, user, isTenantContextReady } = useAuth()
  const tenantId = currentTenant?.tenant_id ?? ''
  const userId = user?.id ?? ''
  const qc = useQueryClient()
  const scoped = Boolean(tenantId && userId && isTenantContextReady)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: notificationKeys.unreadCount(tenantId, userId),
    queryFn: fetchUnreadNotificationCount,
    enabled: scoped,
    staleTime: NOTIFICATION_UNREAD_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const { data: recentNotifications = [], isLoading: isRecentLoading } = useQuery({
    queryKey: notificationKeys.recent(tenantId, userId),
    queryFn: fetchRecentUnreadNotifications,
    enabled: scoped && dropdownOpen,
    staleTime: NOTIFICATION_UNREAD_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  useEffect(() => {
    if (!scoped) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`ntf-bell-${tenantId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'org_ntf_inbox_mst',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const event = payload.eventType
          if (!isInboxRealtimeEvent(event)) {
            return
          }
          const row = event === 'DELETE' ? payload.old : payload.new
          if (!isInboxRealtimeRow(row) || !isInboxRowInScope(row, tenantId, userId)) {
            return
          }

          void qc.invalidateQueries({
            queryKey: notificationKeys.unreadCount(tenantId, userId),
          })
          void qc.invalidateQueries({ queryKey: notificationKeys.lists })

          const recentKey = notificationKeys.recent(tenantId, userId)
          if (qc.getQueryState(recentKey)?.status === 'success') {
            qc.setQueryData(recentKey, (prev: NotificationRow[] | undefined) =>
              mergeRecentInboxRows(prev, event, row, NOTIFICATION_RECENT_LIMIT)
            )
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc, scoped, tenantId, userId])

  return { unreadCount, recentNotifications, isRecentLoading }
}
