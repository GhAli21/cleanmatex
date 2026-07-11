'use client'

/**
 * React hook over the Session Activity in-memory store.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  sessionActivityStore,
  type SessionActivityEntry,
  type SessionActivityMessageType,
} from '@lib/session-activity'

export type SessionActivityFilter = 'all' | 'errors' | 'warnings'

function filterEntries(
  entries: SessionActivityEntry[],
  filter: SessionActivityFilter
): SessionActivityEntry[] {
  if (filter === 'errors') return entries.filter((e) => e.type === 'error')
  if (filter === 'warnings') return entries.filter((e) => e.type === 'warning')
  return entries
}

/**
 * Subscribe to session activity state for the top-bar panel.
 */
export function useSessionActivity(filter: SessionActivityFilter = 'all') {
  const state = useSyncExternalStore(
    sessionActivityStore.subscribe,
    sessionActivityStore.getSnapshot,
    sessionActivityStore.getSnapshot
  )

  const unreadCount = useMemo(
    () =>
      state.entries.filter(
        (e) => !e.read && (e.type === 'error' || e.type === 'warning')
      ).length,
    [state.entries]
  )

  const entries = useMemo(
    () => filterEntries(state.entries, filter),
    [state.entries, filter]
  )

  const markRead = useCallback((id: string) => {
    sessionActivityStore.markRead(id)
  }, [])

  const markAllRead = useCallback(() => {
    sessionActivityStore.markAllRead()
  }, [])

  const clear = useCallback(() => {
    sessionActivityStore.clear()
  }, [])

  return {
    entries,
    allEntries: state.entries,
    unreadCount,
    markRead,
    markAllRead,
    clear,
  }
}

export type { SessionActivityEntry, SessionActivityMessageType }
