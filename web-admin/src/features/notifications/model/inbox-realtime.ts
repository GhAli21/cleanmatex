import type { NotificationRow } from '@lib/notifications/types'
import { NOTIFICATION_RECENT_LIMIT } from '@/lib/query/notification-keys'

/**
 * Realtime inbox event names from postgres_changes.
 */
export type InboxRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * Subset of org_ntf_inbox_mst required to scope a Realtime payload.
 * UPDATE/DELETE may omit UI fields; INSERT usually includes the full row.
 */
export interface InboxRealtimeRow {
  id: string
  tenant_org_id: string
  recipient_user_id: string
  is_read?: boolean
  is_active?: boolean
}

/**
 * Narrow an unknown Realtime payload to the inbox identity fields.
 * @param value - payload.new or payload.old
 */
export function isInboxRealtimeRow(value: unknown): value is InboxRealtimeRow {
  if (!value || typeof value !== 'object') {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string' &&
    typeof row.tenant_org_id === 'string' &&
    typeof row.recipient_user_id === 'string'
  )
}

/**
 * Realtime is filtered by recipient only; drop rows for another tenant.
 * @param row - Inbox payload
 * @param tenantId - Active tenant
 * @param userId - Signed-in user
 */
export function isInboxRowInScope(
  row: InboxRealtimeRow,
  tenantId: string,
  userId: string
): boolean {
  return row.tenant_org_id === tenantId && row.recipient_user_id === userId
}

function isVisibleUnread(row: Pick<InboxRealtimeRow, 'is_read' | 'is_active'>): boolean {
  return row.is_read !== true && row.is_active !== false
}

/**
 * Patch the bell dropdown cache. Returns undefined when there is no cache to patch
 * so an INSERT cannot seed a one-row list and skip the first network fetch.
 * @param prev - Existing recent rows, or undefined if never fetched
 * @param event - postgres_changes event
 * @param row - New or old inbox row
 * @param limit - Max rows to keep
 */
export function mergeRecentInboxRows(
  prev: NotificationRow[] | undefined,
  event: InboxRealtimeEvent,
  row: InboxRealtimeRow,
  limit: number = NOTIFICATION_RECENT_LIMIT
): NotificationRow[] | undefined {
  if (!prev) {
    return prev
  }

  if (event === 'DELETE') {
    return prev.filter((item) => item.id !== row.id)
  }

  if (event === 'INSERT') {
    if (!isVisibleUnread(row)) {
      return prev
    }
    if (prev.some((item) => item.id === row.id)) {
      return prev
    }
    const asRow = row as NotificationRow
    return [asRow, ...prev].slice(0, limit)
  }

  const merged = prev.map((item) =>
    item.id === row.id ? ({ ...item, ...row } as NotificationRow) : item
  )
  return merged.filter((item) => item.id !== row.id || isVisibleUnread(item))
}
