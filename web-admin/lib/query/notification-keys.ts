import type { QueryClient } from '@tanstack/react-query'

/** Unread badge stays fresh this long; focus/reconnect refetch only after it expires. */
export const NOTIFICATION_UNREAD_STALE_TIME_MS = 2 * 60 * 1000

/** Bell dropdown page size; must match GET /api/v1/notifications?limit= */
export const NOTIFICATION_RECENT_LIMIT = 10

/**
 * Canonical TanStack Query keys for in-app inbox reads.
 * Always use this factory for useQuery, invalidateQueries, and removeQueries.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: (tenantId: string, userId: string) =>
    ['notifications', 'unread-count', tenantId, userId] as const,
  recent: (tenantId: string, userId: string) =>
    ['notifications', 'recent', tenantId, userId] as const,
  lists: ['notifications', 'list'] as const,
  list: (tenantId: string, userId: string, tab: string, page: number) =>
    ['notifications', 'list', tenantId, userId, tab, page] as const,
}

/**
 * Refresh unread badge, bell dropdown, and center-page lists after an inbox mutation.
 * @param queryClient - App QueryClient
 * @param tenantId - Active tenant; required so Tenant A cache is not mixed with Tenant B
 * @param userId - Recipient user id
 */
export function invalidateNotificationInbox(
  queryClient: QueryClient,
  tenantId: string,
  userId: string
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(tenantId, userId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.recent(tenantId, userId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.lists }),
  ]).then(() => undefined)
}

/**
 * Drop inbox queries so a later session cannot read a prior user or tenant badge.
 * @param queryClient - App QueryClient
 */
export function removeAllNotificationQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: notificationKeys.all })
}
