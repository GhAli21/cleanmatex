/**
 * In-memory Session Activity store (no React).
 * Snapshot references stay stable until a mutation occurs.
 */

import { SESSION_ACTIVITY_MAX_ENTRIES } from './session-activity-config'
import type {
  SessionActivityEntry,
  SessionActivityListener,
  SessionActivityState,
} from './session-activity.types'

function createEmptyState(): SessionActivityState {
  return { entries: [] }
}

class SessionActivityStore {
  private state: SessionActivityState = createEmptyState()
  private listeners = new Set<SessionActivityListener>()

  subscribe = (listener: SessionActivityListener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): SessionActivityState => this.state

  append(entry: SessionActivityEntry): void {
    const nextEntries = [entry, ...this.state.entries].slice(0, SESSION_ACTIVITY_MAX_ENTRIES)
    this.state = { entries: nextEntries }
    this.emit()
  }

  markRead(id: string): void {
    let changed = false
    const nextEntries = this.state.entries.map((entry) => {
      if (entry.id !== id || entry.read) return entry
      changed = true
      return { ...entry, read: true }
    })
    if (!changed) return
    this.state = { entries: nextEntries }
    this.emit()
  }

  markAllRead(): void {
    if (!this.state.entries.some((e) => !e.read)) return
    this.state = {
      entries: this.state.entries.map((entry) =>
        entry.read ? entry : { ...entry, read: true }
      ),
    }
    this.emit()
  }

  clear(): void {
    if (this.state.entries.length === 0) return
    this.state = createEmptyState()
    this.emit()
  }

  getUnreadCount(): number {
    return this.state.entries.filter(
      (e) => !e.read && (e.type === 'error' || e.type === 'warning')
    ).length
  }

  /** Test helper — reset without notifying if already empty. */
  resetForTests(): void {
    this.state = createEmptyState()
    this.listeners.clear()
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}

export const sessionActivityStore = new SessionActivityStore()
