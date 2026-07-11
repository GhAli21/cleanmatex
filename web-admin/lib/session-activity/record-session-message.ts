/**
 * Capture policy + append orchestration for Session Activity.
 * Never throws to callers — failures are swallowed.
 */

import { SESSION_ACTIVITY_DEDUPE_MS } from './session-activity-config'
import {
  redactSessionDescription,
  redactSessionTitle,
} from './redact-session-message'
import { sessionActivityStore } from './session-activity-store'
import type {
  RecordSessionMessageInput,
  SessionActivityDisplayMethod,
  SessionActivityMessageType,
} from './session-activity.types'

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getCurrentRoute(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname || ''
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Whether this message should be stored in the session activity log.
 */
export function shouldCaptureSessionMessage(input: RecordSessionMessageInput): boolean {
  if (input.skipSessionLog) return false

  const method = input.method ?? 'toast'
  if (method === 'inline' || method === 'console') return false
  if (method !== 'toast' && method !== 'alert') return false

  const type = input.type
  if (type === 'loading') return false

  if (input.forceSessionLog) {
    return type === 'error' || type === 'warning' || type === 'info' || type === 'success'
  }

  return type === 'error' || type === 'warning'
}

function toStoredType(type: string): SessionActivityMessageType | null {
  if (type === 'error' || type === 'warning' || type === 'info') return type
  // forceSessionLog success is stored as info for the UI type union
  if (type === 'success') return 'info'
  return null
}

function isDuplicate(
  type: SessionActivityMessageType,
  title: string,
  route: string
): boolean {
  const normalized = normalizeTitle(title)
  const now = Date.now()
  const recent = sessionActivityStore.getSnapshot().entries[0]
  if (!recent) return false
  if (recent.type !== type) return false
  if (recent.route !== route) return false
  if (normalizeTitle(recent.title) !== normalized) return false
  const age = now - new Date(recent.createdAt).getTime()
  return age < SESSION_ACTIVITY_DEDUPE_MS
}

/**
 * Record a displayed message into the session activity store.
 * Safe to call from any message path; never throws.
 */
export function recordSessionMessage(input: RecordSessionMessageInput): void {
  try {
    if (typeof window === 'undefined') return
    if (!shouldCaptureSessionMessage(input)) return

    const storedType = toStoredType(input.type)
    if (!storedType) return

    const title = redactSessionTitle(input.title || '')
    if (!title) return

    const description = redactSessionDescription(input.description)
    const route = getCurrentRoute()
    const method = (input.method === 'alert' ? 'alert' : 'toast') as SessionActivityDisplayMethod

    if (isDuplicate(storedType, title, route)) return

    sessionActivityStore.append({
      id: createId(),
      type: storedType,
      title,
      description,
      method,
      route,
      source: input.source,
      createdAt: new Date().toISOString(),
      read: false,
    })

    if (process.env.NODE_ENV === 'development') {
      console.debug('[session-activity] captured', storedType, title)
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[session-activity] record failed', error)
    }
  }
}
