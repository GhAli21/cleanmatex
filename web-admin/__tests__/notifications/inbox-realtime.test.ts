import {
  isInboxRealtimeRow,
  isInboxRowInScope,
  mergeRecentInboxRows,
} from '@features/notifications/model/inbox-realtime'
import type { NotificationRow } from '@lib/notifications/types'

const TENANT_A = 'tenant-a'
const USER_A = 'user-a'

function row(overrides: Partial<NotificationRow> & Pick<NotificationRow, 'id'>): NotificationRow {
  return {
    tenant_org_id: TENANT_A,
    recipient_user_id: USER_A,
    event_code: 'order.created',
    category_code: 'order',
    title: 'Title',
    title2: null,
    body: 'Body',
    body2: null,
    channel_code: 'IN_APP',
    priority: 'NORMAL',
    is_read: false,
    read_at: null,
    action_url: null,
    action_label: null,
    action_label2: null,
    source_entity_type: 'order',
    source_entity_id: 'ord-1',
    metadata: null,
    expires_at: null,
    created_at: '2026-09-16T00:00:00.000Z',
    ...overrides,
  }
}

describe('inbox realtime helpers', () => {
  it('rejects payloads missing identity fields', () => {
    expect(isInboxRealtimeRow(null)).toBe(false)
    expect(isInboxRealtimeRow({ id: 'n1' })).toBe(false)
    expect(
      isInboxRealtimeRow({
        id: 'n1',
        tenant_org_id: TENANT_A,
        recipient_user_id: USER_A,
      })
    ).toBe(true)
  })

  it('scopes rows to the active tenant and user', () => {
    const inbox = {
      id: 'n1',
      tenant_org_id: TENANT_A,
      recipient_user_id: USER_A,
    }
    expect(isInboxRowInScope(inbox, TENANT_A, USER_A)).toBe(true)
    expect(isInboxRowInScope(inbox, 'tenant-b', USER_A)).toBe(false)
    expect(isInboxRowInScope(inbox, TENANT_A, 'user-b')).toBe(false)
  })

  it('does not seed a recent cache from INSERT when none exists', () => {
    const inserted = row({ id: 'n-new' })
    expect(mergeRecentInboxRows(undefined, 'INSERT', inserted)).toBeUndefined()
  })

  it('prepends INSERT rows and drops them when marked read or inactive', () => {
    const existing = [row({ id: 'n1' })]
    const inserted = row({ id: 'n2', title: 'New' })
    const afterInsert = mergeRecentInboxRows(existing, 'INSERT', inserted, 10)
    expect(afterInsert?.map((item) => item.id)).toEqual(['n2', 'n1'])

    const afterRead = mergeRecentInboxRows(afterInsert, 'UPDATE', {
      id: 'n2',
      tenant_org_id: TENANT_A,
      recipient_user_id: USER_A,
      is_read: true,
    })
    expect(afterRead?.map((item) => item.id)).toEqual(['n1'])
  })

  it('removes DELETE rows without touching others', () => {
    const existing = [row({ id: 'n1' }), row({ id: 'n2' })]
    const next = mergeRecentInboxRows(existing, 'DELETE', {
      id: 'n1',
      tenant_org_id: TENANT_A,
      recipient_user_id: USER_A,
    })
    expect(next?.map((item) => item.id)).toEqual(['n2'])
  })
})
