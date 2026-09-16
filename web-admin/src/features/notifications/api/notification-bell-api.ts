import type { NotificationRow } from '@lib/notifications/types'
import { NOTIFICATION_RECENT_LIMIT } from '@/lib/query/notification-keys'

/**
 * GET /api/v1/notifications/unread-count for the session user and tenant.
 * Tenant is resolved server-side from the session; do not pass tenant in the URL.
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const response = await fetch('/api/v1/notifications/unread-count', {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to fetch unread notification count')
  }
  const json = (await response.json()) as { count?: unknown }
  if (typeof json.count !== 'number' || !Number.isFinite(json.count) || json.count < 0) {
    throw new Error('Invalid unread notification count')
  }
  return json.count
}

/**
 * GET unread inbox rows for the bell dropdown.
 * Tenant is resolved server-side from the session.
 */
export async function fetchRecentUnreadNotifications(): Promise<NotificationRow[]> {
  const params = new URLSearchParams({
    limit: String(NOTIFICATION_RECENT_LIMIT),
    is_read: 'false',
  })
  const response = await fetch(`/api/v1/notifications?${params.toString()}`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to fetch recent notifications')
  }
  const json = (await response.json()) as { data?: NotificationRow[] }
  return Array.isArray(json.data) ? json.data : []
}

/**
 * PATCH one inbox row as read.
 * @param id - Inbox row id
 */
export async function markNotificationRead(id: string): Promise<void> {
  const response = await fetch(`/api/v1/notifications/${id}/read`, {
    method: 'PATCH',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to mark notification as read')
  }
}

/**
 * PATCH every unread inbox row for the session user as read.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch('/api/v1/notifications/read-all', {
    method: 'PATCH',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to mark all notifications as read')
  }
}
