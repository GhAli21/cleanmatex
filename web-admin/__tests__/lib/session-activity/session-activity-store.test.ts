/**
 * Unit tests for session-activity-store
 */

import { sessionActivityStore } from '@/lib/session-activity/session-activity-store'
import { SESSION_ACTIVITY_MAX_ENTRIES } from '@/lib/session-activity/session-activity-config'
import type { SessionActivityEntry } from '@/lib/session-activity/session-activity.types'

function makeEntry(overrides: Partial<SessionActivityEntry> = {}): SessionActivityEntry {
  return {
    id: overrides.id ?? `id-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? 'error',
    title: overrides.title ?? 'Test error',
    description: overrides.description,
    method: overrides.method ?? 'toast',
    route: overrides.route ?? '/dashboard',
    source: overrides.source,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    read: overrides.read ?? false,
  }
}

describe('sessionActivityStore', () => {
  beforeEach(() => {
    sessionActivityStore.resetForTests()
  })

  it('returns stable snapshot when unchanged', () => {
    const a = sessionActivityStore.getSnapshot()
    const b = sessionActivityStore.getSnapshot()
    expect(a).toBe(b)
  })

  it('appends newest first and notifies listeners', () => {
    const listener = jest.fn()
    sessionActivityStore.subscribe(listener)

    sessionActivityStore.append(makeEntry({ id: '1', title: 'First' }))
    sessionActivityStore.append(makeEntry({ id: '2', title: 'Second' }))

    expect(listener).toHaveBeenCalledTimes(2)
    expect(sessionActivityStore.getSnapshot().entries.map((e) => e.id)).toEqual(['2', '1'])
  })

  it('evicts oldest when exceeding max entries', () => {
    for (let i = 0; i < SESSION_ACTIVITY_MAX_ENTRIES + 5; i++) {
      sessionActivityStore.append(makeEntry({ id: `e-${i}`, title: `Msg ${i}` }))
    }
    expect(sessionActivityStore.getSnapshot().entries).toHaveLength(SESSION_ACTIVITY_MAX_ENTRIES)
    expect(sessionActivityStore.getSnapshot().entries[0].id).toBe(
      `e-${SESSION_ACTIVITY_MAX_ENTRIES + 4}`
    )
  })

  it('markRead and markAllRead update unread count', () => {
    sessionActivityStore.append(makeEntry({ id: 'a', type: 'error' }))
    sessionActivityStore.append(makeEntry({ id: 'b', type: 'warning' }))
    sessionActivityStore.append(makeEntry({ id: 'c', type: 'info', read: false }))

    expect(sessionActivityStore.getUnreadCount()).toBe(2)

    sessionActivityStore.markRead('a')
    expect(sessionActivityStore.getUnreadCount()).toBe(1)

    sessionActivityStore.markAllRead()
    expect(sessionActivityStore.getUnreadCount()).toBe(0)
  })

  it('clear empties entries', () => {
    sessionActivityStore.append(makeEntry())
    sessionActivityStore.clear()
    expect(sessionActivityStore.getSnapshot().entries).toHaveLength(0)
  })
})
